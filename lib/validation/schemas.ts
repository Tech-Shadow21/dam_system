import { z } from 'zod'
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/lib/env'

/**
 * Server-side validation for every form and action payload.
 *
 * Per 03-security-access.md, server-side validation re-checks regardless of
 * client state — these schemas are the authority, and the client uses the same
 * definitions so messages match exactly.
 */

const requiredText = (label: string, max = 200) =>
  z
    .string({ required_error: 'This field is required' })
    .trim()
    .min(1, 'This field is required')
    .max(max, `${label} must be ${max} characters or fewer`)

export const emailSchema = z
  .string({ required_error: 'This field is required' })
  .trim()
  .min(1, 'This field is required')
  .email('Enter a valid email address')
  .toLowerCase()

/** Password rules kept modest but non-trivial; Supabase enforces a 6-char floor. */
export const passwordSchema = z
  .string({ required_error: 'This field is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be 72 characters or fewer')

export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Enter a 6-digit hex color, e.g. #1B2A4A')

/* -------------------------------- TICKET-004 ------------------------------- */

export const signUpSchema = z.object({
  organizationName: requiredText('Organization name', 120),
  fullName: requiredText('Full name', 120),
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'This field is required'),
})

export const inviteSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().max(120).optional(),
  // Owner is intentionally not assignable via invite — that's a transfer.
  role: z.enum(['admin', 'manager', 'contributor', 'viewer'], {
    errorMap: () => ({ message: 'Choose a role' }),
  }),
})

export const acceptInviteSchema = z.object({
  fullName: requiredText('Full name', 120),
  password: passwordSchema,
})

/* -------------------------------- TICKET-006 ------------------------------- */

export const createFolderSchema = z.object({
  name: requiredText('Folder name', 120),
  parentFolderId: z.string().uuid().nullable().optional(),
})

export const renameFolderSchema = z.object({
  folderId: z.string().uuid(),
  name: requiredText('Folder name', 120),
})

/* -------------------------------- TICKET-007 ------------------------------- */

export const uploadRequestSchema = z.object({
  filename: requiredText('Filename', 255),
  fileType: z.string().trim().min(1, 'File type is required'),
  fileSizeBytes: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_FILE_SIZE_BYTES, 'File exceeds the 5 GB limit'),
  folderId: z.string().uuid().nullable().optional(),
})

/** Accepted-type gate, shared by the client picker and the server action. */
export function isAcceptedMimeType(mimeType: string): boolean {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(mimeType)
}

/* -------------------------------- TICKET-009 ------------------------------- */

export const updateAssetSchema = z.object({
  assetId: z.string().uuid(),
  filename: requiredText('Filename', 255).optional(),
  folderId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.null()])).optional(),
})

/* -------------------------------- TICKET-011 ------------------------------- */

export const metadataFieldSchema = z.object({
  fieldKey: z
    .string()
    .trim()
    .min(1, 'This field is required')
    .max(60)
    .regex(
      /^[a-z0-9_]+$/,
      'Use lowercase letters, numbers and underscores only'
    ),
  label: requiredText('Label', 80),
  fieldType: z.enum(['text', 'number', 'date', 'select']),
  options: z.array(z.string().trim().min(1)).optional(),
})
  // A select field with no options would render an unusable empty dropdown.
  .refine(
    (v) => v.fieldType !== 'select' || (v.options?.length ?? 0) > 0,
    { message: 'Add at least one option for a select field', path: ['options'] }
  )

/* -------------------------------- TICKET-012 ------------------------------- */

export const tagNameSchema = z
  .string({ required_error: 'This field is required' })
  .trim()
  .min(1, 'This field is required')
  .max(60, 'Tag must be 60 characters or fewer')

/* -------------------------------- TICKET-014 ------------------------------- */

export const collectionSchema = z.object({
  name: requiredText('Collection name', 120),
  description: z.string().trim().max(500).optional().nullable(),
})

/* -------------------------------- TICKET-015 ------------------------------- */

export const createShareLinkSchema = z
  .object({
    targetType: z.enum(['asset', 'folder', 'collection']),
    targetId: z.string().uuid(),
    // Required — no permanent public links in v1.
    expiresAt: z
      .string()
      .min(1, 'An expiration date is required')
      .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date')
      .refine((v) => Date.parse(v) > Date.now(), 'Expiration must be in the future'),
    password: z
      .string()
      .max(72, 'Password must be 72 characters or fewer')
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    allowDownload: z.boolean().default(true),
  })
  .refine((v) => !v.password || v.password.length >= 6, {
    message: 'Password must be at least 6 characters',
    path: ['password'],
  })

export const sharePasswordSchema = z.object({
  password: z.string().min(1, 'This field is required'),
})

/* -------------------------------- TICKET-017 ------------------------------- */

export const brandingSchema = z.object({
  brandPrimaryColor: hexColorSchema.nullable().optional(),
  brandSecondaryColor: hexColorSchema.nullable().optional(),
})

export const organizationSchema = z.object({
  name: requiredText('Organization name', 120),
})

/* -------------------------------- TICKET-018 ------------------------------- */

export const changeRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'manager', 'contributor', 'viewer']),
})

export const setUserStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(['active', 'deactivated']),
})

/* --------------------------------- helpers -------------------------------- */

export type FieldErrors = Record<string, string>

/** Flattens a ZodError into the { field: message } shape the forms consume. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    if (!out[key]) out[key] = issue.message
  }
  return out
}

/** Reads and validates a FormData payload in one step. */
export function parseFormData<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData
): { success: true; data: z.infer<T> } | { success: false; errors: FieldErrors } {
  const raw = Object.fromEntries(formData.entries())
  const result = schema.safeParse(raw)
  if (result.success) return { success: true, data: result.data }
  return { success: false, errors: fieldErrors(result.error) }
}
