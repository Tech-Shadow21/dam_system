'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  acceptInviteSchema,
  fieldErrors,
  loginSchema,
  signUpSchema,
} from '@/lib/validation/schemas'

/**
 * Auth Server Actions, colocated with the (auth) route group.
 */

export interface ActionState {
  errors?: Record<string, string>
  message?: string
}

/**
 * Sign up: creates an organization and its first Owner.
 *
 * This is the one place an organization can be created. It runs through the
 * service-role client because no membership row exists yet to authorise
 * against, and there is deliberately no INSERT policy on `organizations` for
 * authenticated sessions (see 0002_rls_policies.sql).
 */
export async function signUpAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    organizationName: formData.get('organizationName'),
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) return { errors: fieldErrors(parsed.error) }
  const { organizationName, fullName, email, password } = parsed.data

  const supabase = createClient()
  const admin = createAdminClient()

  // Create the auth user first: if this fails (e.g. email already registered) we
  // have not left a stranded organization behind.
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (signUpError || !signUpData.user) {
    const msg = signUpError?.message ?? 'Could not create your account'
    // Don't leak whether an address is already registered beyond what Supabase
    // already reveals here; keep the wording neutral.
    return {
      errors: {
        email: /already registered|already exists/i.test(msg)
          ? 'An account with this email already exists.'
          : msg,
      },
    }
  }

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({ name: organizationName, plan: 'trial' })
    .select('id')
    .single()

  if (orgError || !org) {
    // Roll back the auth user so a retry isn't blocked by a half-created account.
    await admin.auth.admin.deleteUser(signUpData.user.id).catch(() => {})
    return { errors: { form: 'Could not create your organization — please try again.' } }
  }

  const { error: profileError } = await admin.from('users').insert({
    id: signUpData.user.id,
    organization_id: org.id,
    full_name: fullName,
    email,
    role: 'owner',
    status: 'active',
  })

  if (profileError) {
    await admin.from('organizations').delete().eq('id', org.id)
    await admin.auth.admin.deleteUser(signUpData.user.id).catch(() => {})
    return { errors: { form: 'Could not finish setting up your account — please try again.' } }
  }

  // When email confirmation is enabled in Supabase, signUp returns no session.
  if (!signUpData.session) {
    return {
      message:
        'Check your email to confirm your address, then sign in to reach your dashboard.',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/?welcome=1')
}

/** Login. Error wording avoids revealing which field was wrong. */
export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const next = String(formData.get('next') ?? '') || '/'
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    // Single combined message — no user enumeration (03-security-access.md).
    return { errors: { form: 'Incorrect email or password.' } }
  }

  // A deactivated user must not get in even with valid credentials.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('status')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.status === 'deactivated') {
      await supabase.auth.signOut()
      return {
        errors: {
          form: 'This account has been deactivated. Contact an administrator for access.',
        },
      }
    }
  }

  revalidatePath('/', 'layout')
  // Only allow internal redirects, so ?next= can't be used as an open redirect.
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/')
}

export async function logoutAction() {
  const supabase = createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * Invite acceptance: the invited user sets their name and password.
 *
 * The token in the URL has already been exchanged for a session by the invite
 * page before this runs, so we update the authenticated user in place and flip
 * their profile from 'invited' to 'active'. The role was fixed by the admin at
 * invite time and is never taken from user input here.
 */
export async function acceptInviteAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = acceptInviteSchema.safeParse({
    fullName: formData.get('fullName'),
    password: formData.get('password'),
  })

  if (!parsed.success) return { errors: fieldErrors(parsed.error) }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      errors: {
        form: 'This invite link is no longer valid — ask an admin to resend it.',
      },
    }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: { full_name: parsed.data.fullName },
  })

  if (updateError) {
    return { errors: { password: updateError.message } }
  }

  // status/role changes are trigger-protected, so this runs service-role.
  const admin = createAdminClient()
  const { error: profileError } = await admin
    .from('users')
    .update({ full_name: parsed.data.fullName, status: 'active' })
    .eq('id', user.id)

  if (profileError) {
    return { errors: { form: 'Could not activate your account — please try again.' } }
  }

  revalidatePath('/', 'layout')
  redirect('/?welcome=1')
}
