# Feature Ticket List — Vaultra

## TICKET-001: Project Scaffolding & Design System Setup
- **Description:** Initialize the Next.js (App Router) + TypeScript + Tailwind project. Configure Tailwind theme with the Vaultra color palette and typography (Fraunces, IBM Plex Sans, IBM Plex Mono) as CSS variables. Build core UI primitives: Button, Input, Card, Modal, Badge/Tag chip, Toast.
- **Acceptance Criteria:**
  - [ ] Repo boots locally with `npm run dev`
  - [ ] Tailwind config exposes primary/accent/background/surface/text/error/success/warning colors as theme tokens
  - [ ] Fraunces, IBM Plex Sans, IBM Plex Mono loaded and applied per `04-frontend-specification.md`
  - [ ] Button, Input, Card, Modal, Badge, Toast components exist in `components/ui/` and match spec (states: default, hover, focus, disabled, error where applicable)
- **Dependencies:** None
- **Priority:** Must-have
- **Status:** Not started

## TICKET-002: Supabase Project & Database Schema
- **Description:** Create the Supabase project, write SQL migrations for every table defined in `02-technical-architecture.md` (organizations, users, folders, collections, assets, asset_versions, collection_assets, tags, asset_tags, metadata_fields, share_links), and generate TypeScript types from the schema.
- **Acceptance Criteria:**
  - [ ] All 11 tables exist in Supabase matching the documented schema
  - [ ] Foreign keys and constraints match the relationships described in `02-technical-architecture.md`
  - [ ] `types/database.ts` generated and imported without errors
- **Dependencies:** None
- **Priority:** Must-have
- **Status:** Not started

## TICKET-003: Row-Level Security Policies
- **Description:** Implement RLS policies on every organization-scoped table enforcing tenant isolation, plus a `has_permission()` Postgres function used by write-policies to enforce role-based restrictions as described in `03-security-access.md`.
- **Acceptance Criteria:**
  - [ ] RLS enabled on all 9 org-scoped tables
  - [ ] A user from Org A cannot read or write any row belonging to Org B (verified with a manual test using two seeded orgs)
  - [ ] A Viewer-role user cannot perform insert/update/delete on assets/folders/tags/share_links even via a direct API call
- **Dependencies:** TICKET-002
- **Priority:** Must-have
- **Status:** Not started

## TICKET-004: Authentication — Sign Up, Login, Invite Flow
- **Description:** Build the sign-up flow that creates a new organization + Owner user, the login flow, and the admin-driven invite flow (admin enters an email → invite record created → invited user receives a link → sets password → account activated with the assigned role).
- **Acceptance Criteria:**
  - [ ] New user can create an organization and land in the dashboard as Owner
  - [ ] Existing user can log in with email/password
  - [ ] Admin can invite a user by email and select their role
  - [ ] Invited user can complete signup via the invite link and lands in the dashboard with the assigned role
  - [ ] Expired invite link shows the correct error state per `03-security-access.md`
- **Dependencies:** TICKET-002, TICKET-003
- **Priority:** Must-have
- **Status:** Not started

## TICKET-005: App Shell & Navigation
- **Description:** Build the authenticated dashboard shell: navy sidebar with nav items (Home, Library, Collections, Search, Shares, Settings), top bar with global search and user menu, responsive main content area.
- **Acceptance Criteria:**
  - [ ] Sidebar and top bar match `04-frontend-specification.md` layout and color spec
  - [ ] Active nav item shows the brass accent state
  - [ ] Nav items restricted by role are hidden for users without access (e.g. Settings > Users hidden for non-admins)
- **Dependencies:** TICKET-001, TICKET-004
- **Priority:** Must-have
- **Status:** Not started

## TICKET-006: Folder Structure — Create, Rename, Nest, Delete
- **Description:** Build folder CRUD: create folder (optionally nested under a parent), rename, delete (with confirmation), and a folder tree/breadcrumb navigation component.
- **Acceptance Criteria:**
  - [ ] User with permission can create a folder at root or nested under another folder
  - [ ] Folder rename and delete work with confirmation modal for delete
  - [ ] Breadcrumb accurately reflects current folder depth and is clickable to navigate up
  - [ ] Users without folder-management permission cannot see create/rename/delete controls
- **Dependencies:** TICKET-003, TICKET-005
- **Priority:** Must-have
- **Status:** Not started

## TICKET-007: Asset Upload (Single & Bulk)
- **Description:** Build drag-and-drop and file-picker upload into a selected folder, using presigned R2 URLs for direct browser-to-storage upload. Support bulk multi-file upload with a per-file progress list.
- **Acceptance Criteria:**
  - [ ] User can drag files onto the library view or use a picker to upload into the current folder
  - [ ] Multiple files upload in parallel with individual progress indicators
  - [ ] Failed uploads show a retry action; successful uploads create an `assets` row and an initial `asset_versions` row
  - [ ] Oversized or unsupported file types are rejected client-side with the error messaging defined in `03-security-access.md`
- **Dependencies:** TICKET-002, TICKET-006
- **Priority:** Must-have
- **Status:** Not started

## TICKET-008: Asset Grid & List Views
- **Description:** Build the folder browse view showing assets as a responsive grid (thumbnail cards) with a toggle to a dense list/table view. Includes multi-select for bulk actions.
- **Acceptance Criteria:**
  - [ ] Grid view renders asset thumbnails via `sharp`-generated R2 variants served through Next.js Image Optimization, matching card spec in `04-frontend-specification.md`
  - [ ] List view shows filename, type, size, uploader, date in a sortable table
  - [ ] Multi-select allows selecting several assets and triggers a bulk action bar (move, tag, delete, share)
- **Dependencies:** TICKET-007
- **Priority:** Must-have
- **Status:** Not started

## TICKET-009: Asset Detail View & Preview
- **Description:** Build the asset detail page: large in-browser preview (image/video/PDF), metadata panel, tag editor, and action buttons (download, share, replace file, delete).
- **Acceptance Criteria:**
  - [ ] Images, video, and PDF render an in-browser preview without forcing a download
  - [ ] Metadata panel displays and allows editing of custom metadata fields defined for the org
  - [ ] Tags can be added/removed inline
  - [ ] Download button fetches the current version's file
- **Dependencies:** TICKET-007, TICKET-008
- **Priority:** Must-have
- **Status:** Not started

## TICKET-010: Version History
- **Description:** Support re-uploading a file to an existing asset, preserving prior versions. Build a version history panel showing each version with uploader/date and a rollback (restore-as-current) action.
- **Acceptance Criteria:**
  - [ ] Uploading a replacement file creates a new `asset_versions` row and increments `current_version`
  - [ ] Version history panel lists all versions in reverse-chronological order
  - [ ] User can preview or restore a prior version
- **Dependencies:** TICKET-009
- **Priority:** Must-have
- **Status:** Not started

## TICKET-011: Metadata Fields Configuration
- **Description:** Build an org-settings screen for Admins/Managers to define custom metadata fields (text, number, date, select) that then appear on every asset's metadata panel.
- **Acceptance Criteria:**
  - [ ] Admin/Manager can create, edit, and delete metadata field definitions
  - [ ] New fields appear immediately on the asset detail metadata panel org-wide
  - [ ] Field type validation is enforced on input (e.g. date picker for date fields)
- **Dependencies:** TICKET-009
- **Priority:** Must-have
- **Status:** Not started

## TICKET-012: Tagging System
- **Description:** Build org-wide tag creation/management and the ability to attach/remove tags on individual or bulk-selected assets, with autocomplete against existing tags.
- **Acceptance Criteria:**
  - [ ] Typing a tag on an asset autocompletes against existing org tags or offers to create a new one
  - [ ] Tags display as chips on asset cards and in the detail view
  - [ ] Bulk-tagging from the grid multi-select works
- **Dependencies:** TICKET-008
- **Priority:** Must-have
- **Status:** Not started

## TICKET-013: Search & Filter
- **Description:** Build the global search bar (filename, tag, metadata full-text) and a filter panel (file type, tag, uploader, date range, folder scope) on the library and dedicated search views.
- **Acceptance Criteria:**
  - [ ] Search returns matching assets across filename, tags, and metadata values
  - [ ] Filters combine correctly (AND logic across filter types)
  - [ ] Empty search/filter results show a clear empty state, not a blank screen
- **Dependencies:** TICKET-008, TICKET-012
- **Priority:** Must-have
- **Status:** Not started

## TICKET-014: Collections
- **Description:** Build collections as a saved grouping of assets independent of folder location — create a collection, add/remove assets from the grid or detail view, browse a collection like a filtered view.
- **Acceptance Criteria:**
  - [ ] User can create a named collection
  - [ ] Assets can be added to one or more collections without moving them from their folder
  - [ ] Collection view lists all member assets using the same grid component as folders
- **Dependencies:** TICKET-008
- **Priority:** Must-have
- **Status:** Not started

## TICKET-015: Share Link Creation & Management
- **Description:** Build the "Create Share Link" flow for a single asset, folder, or collection: set expiration date (required), optional password, optional download permission, generate the link, and a "Shares" dashboard view listing all active/expired links with revoke capability.
- **Acceptance Criteria:**
  - [ ] Share link can be created for an asset, folder, or collection with a required expiration date
  - [ ] Optional password protection and download-permission toggle work as configured
  - [ ] Shares dashboard lists all links with status (active/expired/revoked), and allows manual revocation
  - [ ] Revoked or expired links immediately stop granting access
- **Dependencies:** TICKET-008, TICKET-014
- **Priority:** Must-have
- **Status:** Not started

## TICKET-016: Branded External Share Portal
- **Description:** Build the public, unauthenticated `/share/[token]` route: validates the token/password/expiration server-side, renders the organization's branding (logo, colors), and displays only the shared asset(s) with view/download per link settings.
- **Acceptance Criteria:**
  - [ ] Visiting a valid link shows the org's branded portal with the correct asset(s)
  - [ ] Password-protected links prompt for a password before revealing content, with the cooldown behavior from `03-security-access.md`
  - [ ] Expired/revoked links show the correct messaging, not an error page
  - [ ] Download is disabled on the frontend and blocked server-side when the link doesn't permit it
- **Dependencies:** TICKET-015
- **Priority:** Must-have
- **Status:** Not started

## TICKET-017: Organization Branding Settings
- **Description:** Build the Settings > Branding screen where Admins upload a logo and set primary/secondary brand colors used on the external share portal.
- **Acceptance Criteria:**
  - [ ] Admin can upload/replace a logo (stored in R2, resized via `sharp`)
  - [ ] Admin can set primary/secondary colors via a color picker with hex input
  - [ ] Changes reflect immediately on a new share portal visit
- **Dependencies:** TICKET-016
- **Priority:** Must-have
- **Status:** Not started

## TICKET-018: User & Role Management
- **Description:** Build the Settings > Users screen: list all org users with role and status, invite new users (ties into TICKET-004), change a user's role, deactivate a user, and enforce the "last Owner can't leave" rule.
- **Acceptance Criteria:**
  - [ ] Admin/Owner can view all users with current role and status (active/invited/deactivated)
  - [ ] Role changes take effect immediately per the edge case in `03-security-access.md`
  - [ ] Deactivating a user revokes their session access
  - [ ] Attempting to remove/deactivate the last Owner is blocked with the documented error message
- **Dependencies:** TICKET-004
- **Priority:** Must-have
- **Status:** Not started

## TICKET-019: Empty States, Loading States & Error Boundaries
- **Description:** Pass over every major view (library, search, collections, shares, settings) to add proper empty states, loading skeletons, and error boundaries per the design and error-handling specs.
- **Acceptance Criteria:**
  - [ ] Every list/grid view has a designed empty state (not a blank page)
  - [ ] Loading states use skeletons matching card/row shapes, not generic spinners where content shape is known
  - [ ] Unhandled errors are caught by an error boundary showing the toast/message pattern from `03-security-access.md`
- **Dependencies:** TICKET-006 through TICKET-018
- **Priority:** Should-have
- **Status:** Not started

## TICKET-020: Responsive & Accessibility Pass
- **Description:** Ensure the dashboard and external share portal are usable on tablet widths and meet baseline accessibility (keyboard navigation, focus states, contrast ratios per the defined palette, alt text on asset thumbnails).
- **Acceptance Criteria:**
  - [ ] Core flows (browse, upload, share) usable at tablet width (768px+)
  - [ ] All interactive elements reachable and operable via keyboard
  - [ ] Color contrast between text and background colors meets WCAG AA
- **Dependencies:** TICKET-019
- **Priority:** Should-have
- **Status:** Not started
