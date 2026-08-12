# Security & Access Document — Vaultra

## Authentication Method
Email + password via Supabase Auth for all internal users. New users join through an email invite (admin sends invite → user sets their own password via a tokenized link) rather than open self-signup, since Vaultra is a B2B tool where organizations control who gets access. External recipients of share links never authenticate — access is controlled entirely by the share token, optional password, and expiration date. SSO/SAML is deferred post-MVP but the auth layer (Supabase Auth) supports adding it later without a rework.

## User Roles & Permissions
| Role | Can Do | Cannot Do |
|---|---|---|
| Owner | Everything Admin can, plus: manage billing, delete the organization, transfer ownership | N/A (highest role) |
| Admin | Invite/remove/deactivate users, assign roles, manage all folders/assets org-wide, configure branding, create/revoke any share link, view all activity | Delete the organization, manage billing |
| Manager | Upload/edit/delete assets and folders, create/manage tags and metadata fields, create/revoke share links | Manage users or roles, change org branding/settings |
| Contributor | Upload assets, edit/tag assets they uploaded, view and download all assets they have folder access to, create share links for their own assets | Edit or delete assets uploaded by others, manage users, manage folders' structure org-wide, change settings |
| Viewer | View and download assets they have folder access to | Upload, edit, delete, tag, create share links, manage anything |
| Guest (external, via share link) | View and (if permitted) download the specific assets/folder covered by the link, within the expiration window | Log in, browse anything outside the shared scope, see other organization data |

Role assignment happens at the organization level (one role per user per org) for MVP simplicity; folder-level ACL overrides are a natural post-MVP extension once the core model is validated.

## Row-Level Security Rules
Every table that carries `organization_id` (users, folders, collections, assets, asset_versions, tags, asset_tags, metadata_fields, share_links) has RLS enabled with a policy requiring `organization_id = (select organization_id from users where id = auth.uid())`. This means:
- A user can only ever read or write rows belonging to their own organization — enforced at the database level, not just in application code, so a bug in a Server Action can't leak cross-tenant data.
- Within an organization, write actions (insert/update/delete on assets, folders, tags, share_links) are further gated by role, checked via a Postgres function (e.g. `has_permission(auth.uid(), 'asset:delete')`) referenced in the RLS policy, so a Viewer's session literally cannot execute a delete at the database layer even if the UI were somehow bypassed.
- The `share_links` table is the one exception with a public read path: the `(public)/share/[token]` route uses a scoped server-side function (via the service-role client, never the anon client) that validates the token, checks `expires_at` and `revoked_at`, and returns only the specific asset/folder/collection referenced — never a general query surface.
- `asset_versions` inherits its organization scope through its parent `asset_id`, checked via a join in the RLS policy.

## Error Handling
| Failure Point | User-Facing Response |
|---|---|
| API timeout / no response | Toast notification: "Something went wrong on our end — please try again." Retry button shown; action is not silently retried automatically to avoid duplicate uploads/writes. |
| Wrong password (login) | Inline field error: "Incorrect email or password." No indication of which field was wrong, to avoid user enumeration. |
| Wrong password (share link) | Inline error on the share portal: "Incorrect password." After 5 failed attempts, a short cooldown (e.g. 60 seconds) before retrying. |
| File upload failure (network drop, R2 error) | Upload row shows a failed state with a "Retry" action; partial/corrupt uploads are never marked as a completed asset version. |
| File too large / unsupported type | Inline error before upload starts: "File exceeds the 5 GB limit" or "File type not supported," listing accepted types. |
| Share link expired | Branded portal shows: "This link has expired. Contact [org name] for access," not a generic 404. |
| Share link revoked | Same expired-link messaging — recipients can't distinguish revocation from natural expiry, avoiding awkward "someone cut you off" signaling. |
| Unauthorized action attempted (role lacks permission) | Action is hidden/disabled in the UI where possible; if attempted directly (e.g. stale session, direct API call), a 403 with "You don't have permission to do this" is returned. |
| Database/Supabase outage | Global banner: "We're experiencing connection issues — some features may be temporarily unavailable." Read-heavy views degrade gracefully (cached last-known state) where feasible. |

## Edge Cases
| Scenario | Expected Behavior |
|---|---|
| Empty form submission (e.g. blank folder name, blank tag) | Client-side validation blocks submit with an inline "This field is required" message; server-side validation (zod schemas) re-checks regardless of client state. |
| Unauthorized page access attempt (e.g. Viewer navigates directly to `/settings/users`) | Redirect to the dashboard home with a toast: "You don't have access to that page." No partial render of restricted content. |
| Slow/dropped connection mid-upload | Upload shows progress and pauses/retries automatically for transient drops; if the connection doesn't recover within a timeout, the upload is marked failed with a manual retry option — never left in an ambiguous "maybe uploaded" state. |
| Share link accessed after the org deletes the underlying asset | Portal shows "This asset is no longer available," not a broken preview or error stack trace. |
| Last Owner tries to leave/deactivate their own account | Blocked with a message requiring them to transfer ownership to another user first — an organization can never end up with zero owners. |
| Duplicate filename uploaded to the same folder | Both are kept as separate assets (not auto-merged as versions) since same filename doesn't imply same asset; user can manually version them if intended. |
| User's role changed while they have an active session | Session permissions are re-checked on next request (server-side, not cached client-side), so a demoted user loses access immediately rather than at next login. |
| Invite link expired before the invited user accepts | Invite page shows "This invite has expired — ask an admin to resend it," rather than a generic broken-link page. |
