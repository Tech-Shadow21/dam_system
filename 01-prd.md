# Product Requirements Document — Vaultra
*(working name — tentative, see Notes)*

## Problem Statement
Mid-size and large organizations accumulate thousands of brand, marketing, and product assets — logos, photography, videos, templates, campaign files — scattered across shared drives, email threads, and local folders. Nobody can find the current version of anything. Old, off-brand, or expired assets get reused by mistake. External partners and agencies are given raw folder access (or none at all), creating both a security risk and a bottleneck. Existing enterprise DAM tools (Bynder, Brandfolder, Widen) solve this but are priced and scoped for large marketing departments with dedicated admins — there's no credible, leaner alternative for organizations that want enterprise-grade control without enterprise-grade complexity and cost.

## Target Users
Enterprise and large-organization marketing, brand, and creative operations teams (typically 20–500 people touching brand assets). Primary users:
- **Brand/Marketing Admins** — manage the asset library, control access, maintain brand consistency. Moderate-to-high tech comfort.
- **Internal Contributors** (design, marketing, product teams) — upload, tag, and organize assets daily. Frustrated by version confusion and slow search.
- **External Viewers** (agencies, partners, press, resellers) — need controlled, time-limited access to specific assets without a full account.

All primary users are professionals working in a business context, not casual consumers — they expect precision, speed, and clear permission boundaries over playful UX.

## Product Vision
Vaultra becomes the trusted single source of truth for an organization's digital assets — the place every brand-approved file lives, is found in seconds, and is shared with total control over who sees what and for how long.

## Core Features
| Feature | Description | Priority |
|---|---|---|
| Asset Upload | Drag-and-drop or bulk upload of images, video, documents, design files into the library | Must-have |
| Folder & Collection Structure | Nested folders plus flat "collections" (saved groupings that don't require moving files) | Must-have |
| Metadata & Manual Tagging | Custom metadata fields per organization + free-text and controlled-vocabulary tags on every asset | Must-have |
| Search & Filter | Full-text search across filenames/tags/metadata, with filter facets (file type, tag, uploader, date, folder) | Must-have |
| Role-Based Permissions | Organization-level roles controlling who can view, upload, edit, delete, and administer | Must-have |
| Shareable Links with Expiration | Generate a public or password-protected link to an asset/folder with an expiry date, revocable anytime | Must-have |
| Basic Branding Portal | Org-level branded landing page (logo, colors) for external share links, presenting a curated set of assets | Must-have |
| Asset Preview | In-browser preview for images, video, PDF without downloading | Must-have |
| Version History (basic) | Re-upload replaces the asset while preserving prior versions for rollback/audit | Must-have |
| AI Auto-Tagging | Automatic tag suggestion via image/video recognition | Deferred (Post-MVP) |
| SSO / SAML | Enterprise single sign-on | Deferred (Post-MVP) |
| Approval Workflows | Multi-step review/approve before an asset is published | Deferred (Post-MVP) |
| Comments & Annotation | In-app commenting/markup on assets | Deferred (Post-MVP) |
| Analytics Dashboard | Usage/download/view analytics per asset | Deferred (Post-MVP) |
| Third-Party Integrations | Figma, Slack, Adobe CC, Zapier, etc. | Deferred (Post-MVP) |

## App Flow
1. **Sign-up / Sign-in** — Admin creates an organization account (email + password via Supabase Auth). Subsequent users are invited by email and set their own password.
2. **Onboarding** — Admin sets org name, uploads logo, picks brand colors for the share portal, defines initial folder structure (optional).
3. **Dashboard (Home)** — Grid/list of recent assets, quick-access folders, search bar front and center.
4. **Upload** — User drags files or selects from disk → files land in a chosen folder → prompted to add tags/metadata (can skip and do later) → upload progress → confirmation.
5. **Browse / Search** — User navigates folders or searches by keyword; applies filters (type, tag, date, uploader); switches between grid and list view.
6. **Asset Detail** — Click an asset → full preview, metadata panel, tag editor, version history, "Share" and "Download" actions, "Replace file" (new version) if permitted.
7. **Organize** — User creates/renames folders and collections, moves or copies assets, bulk-selects assets to tag/move/delete.
8. **Share** — User selects one or more assets/a folder → "Create share link" → sets expiration date, optional password, optional download permission → link generated → optionally previews the branded external landing page.
9. **External Recipient Flow** — Recipient opens the link → sees the branded portal (org logo/colors) → views/downloads permitted assets → no account required → link stops working after expiration or manual revocation.
10. **User & Role Management** (Admin only) — Invite users, assign roles, deactivate users, view pending invites.
11. **Org Settings** (Admin only) — Branding (logo, colors for portal), organization profile, storage usage overview.

## MVP Scope
Everything marked **Must-have** above: authenticated multi-user asset library with folders/collections, upload, metadata + manual tagging, search/filter, role-based permissions, basic version history, shareable expiring links, and a branded external share portal. Single organization per account tier (no cross-org asset sharing in v1).

## Explicitly Out of Scope (v1)
AI-powered auto-tagging or visual search, SSO/SAML enterprise login, multi-step approval/review workflows, in-app comments and annotation, usage analytics dashboards, and third-party integrations (Figma, Slack, Adobe CC, Zapier, etc.). All are deferred to post-MVP phases once the core library/permissions/sharing loop is proven.

## Success Metrics
- **Activation:** % of invited users who upload at least one asset within their first session.
- **Search effectiveness:** % of searches that result in an asset being opened (proxy for findability).
- **Sharing adoption:** number of share links created per active organization per week.
- **Retention:** organizations still actively uploading/sharing 30 and 90 days after onboarding.
- **Time-to-find:** qualitative/timed benchmark of how long it takes a new user to locate a specific known asset (target: under 30 seconds).

## Notes
- **Product name is not finalized.** "Vaultra" is used as the working name throughout these documents for consistency. Other candidates on the table: Bastion, Assetly, Cortex DAM, Ledgerbox. Renaming later is a find-and-replace exercise across `docs/`, not a re-architecture.
