import { cn } from '@/lib/utils'
import type { AssetKind } from '@/lib/utils'

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number
}

function base(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    className: cn('shrink-0', className),
  }
}

export const HomeIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9.5V20h14V9.5" />
  </svg>
)

export const LibraryIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
)

export const CollectionIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)

export const SearchIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21" />
  </svg>
)

export const ShareIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M10 13a5 5 0 007.07 0l2.5-2.5a5 5 0 00-7.07-7.07L11 4.93" />
    <path d="M14 11a5 5 0 00-7.07 0l-2.5 2.5a5 5 0 007.07 7.07L13 19.07" />
  </svg>
)

export const SettingsIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1A1.7 1.7 0 007 19.4a1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.7 1.7 0 003 15a1.7 1.7 0 00-1.7-1.7H1a2 2 0 110-4h.1A1.7 1.7 0 003 7.6a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 009 3V2a2 2 0 114 0v.1A1.7 1.7 0 0016.4 3a1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06A1.7 1.7 0 0021 9h.1a2 2 0 110 4H21a1.7 1.7 0 00-1.6 2z" />
  </svg>
)

export const FolderIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M3 7a2 2 0 012-2h3.5l2 2.5H19a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
)

export const UploadIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M12 16V4" />
    <path d="M7.5 8.5L12 4l4.5 4.5" />
    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
  </svg>
)

export const DownloadIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M12 4v12" />
    <path d="M7.5 11.5L12 16l4.5-4.5" />
    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
  </svg>
)

export const TrashIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" />
    <path d="M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" />
  </svg>
)

export const PencilIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M4 20h4L20 8l-4-4L4 16v4z" />
  </svg>
)

export const PlusIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const ChevronRightIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M9 5l7 7-7 7" />
  </svg>
)

export const ChevronDownIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M5 9l7 7 7-7" />
  </svg>
)

export const GridIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </svg>
)

export const ListIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
)

export const UsersIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <path d="M16 5.5a3.5 3.5 0 010 6.9M18 20c0-2.2-.8-4-2-5.2" />
  </svg>
)

export const LockIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <rect x="4.5" y="10" width="15" height="10" rx="2" />
    <path d="M8 10V7.5a4 4 0 018 0V10" />
  </svg>
)

export const ClockIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

export const TagIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M11 3H5a2 2 0 00-2 2v6l9.5 9.5a2 2 0 002.8 0l5.2-5.2a2 2 0 000-2.8L11 3z" />
    <circle cx="7.5" cy="7.5" r="1.2" />
  </svg>
)

export const VersionIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M3 12a9 9 0 1015.5-6.2" />
    <path d="M20 3v5h-5" />
    <path d="M12 8v4l3 2" />
  </svg>
)

export const MoveIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M12 3v18M3 12h18" />
    <path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
  </svg>
)

export const CheckIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
)

export const AlertIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M12 4l9 16H3l9-16z" />
    <path d="M12 10v4M12 17v.01" />
  </svg>
)

export const LogoutIcon = ({ size = 20, className, ...p }: IconProps) => (
  <svg {...base(size, className)} {...p}>
    <path d="M9 20H6a2 2 0 01-2-2V6a2 2 0 012-2h3" />
    <path d="M14 8l4 4-4 4M18 12H9" />
  </svg>
)

/* ---------- File-type icons ----------
 * PDFs, video and other non-image types use a generic file-type icon in
 * grid/card views for MVP — real preview-frame generation is out of scope
 * per 04-frontend-specification.md.
 */

const FileShell = ({ size, className, label }: IconProps & { label: string }) => (
  <svg
    width={size ?? 40}
    height={size ?? 40}
    viewBox="0 0 40 48"
    fill="none"
    aria-hidden="true"
    className={cn('shrink-0', className)}
  >
    <path
      d="M4 4a3 3 0 013-3h17l13 13v30a3 3 0 01-3 3H7a3 3 0 01-3-3V4z"
      fill="currentColor"
      fillOpacity="0.06"
      stroke="currentColor"
      strokeOpacity="0.35"
      strokeWidth="1.4"
    />
    <path
      d="M24 1v10a3 3 0 003 3h10"
      stroke="currentColor"
      strokeOpacity="0.35"
      strokeWidth="1.4"
      fill="none"
    />
    <text
      x="20"
      y="34"
      textAnchor="middle"
      className="font-mono"
      fontSize="9"
      fontWeight="500"
      fill="currentColor"
      fillOpacity="0.75"
    >
      {label}
    </text>
  </svg>
)

const kindLabels: Record<AssetKind, string> = {
  image: 'IMG',
  video: 'VID',
  pdf: 'PDF',
  document: 'DOC',
  design: 'DSN',
  other: 'FILE',
}

export function FileTypeIcon({
  kind,
  size = 40,
  className,
}: {
  kind: AssetKind
  size?: number
  className?: string
}) {
  return <FileShell size={size} className={className} label={kindLabels[kind]} />
}
