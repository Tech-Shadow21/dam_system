import type { Config } from 'tailwindcss'

/**
 * "Fortified Archive" design system — see 04-frontend-specification.md.
 * Every value here traces back to that doc; no improvised colors or spacing.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1B2A4A',
          // Hover/pressed shades derived from the navy for interactive depth.
          hover: '#16223C',
          muted: 'rgba(27, 42, 74, 0.10)',
        },
        accent: {
          DEFAULT: '#C9A24B',
          hover: '#B8913D',
          muted: 'rgba(201, 162, 75, 0.12)',
        },
        canvas: '#F7F6F3',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#1A1D23',
          secondary: '#5B6472',
        },
        line: '#E2E0DA',
        error: '#C4453D',
        success: '#2F7A5C',
        warning: '#C98A2C',
        /**
         * The spec's warning #C98A2C only reaches 2.93:1 on white, so it fails
         * WCAG AA for text and 1.4.11 for meaningful icons. It stays as the
         * fill/border colour; this darker shade of the same hue is used wherever
         * warning is carried by text or an icon (5.68:1). See TICKET-020.
         */
        'warning-ink': '#8A5E1B',
        dark: {
          canvas: '#0E1116',
          surface: '#161B22',
          ink: '#E8E6E1',
        },
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-plex-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Display / page titles: 32–40px
        'display-lg': ['40px', { lineHeight: '48px', letterSpacing: '-0.01em' }],
        'display': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em' }],
        // Section headings: 20–24px
        'heading': ['24px', { lineHeight: '32px' }],
        'heading-sm': ['20px', { lineHeight: '28px' }],
        // Body / UI: 14–16px
        'body': ['16px', { lineHeight: '24px' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        // Button text: 14px w/ slight tracking
        'button': ['14px', { lineHeight: '20px', letterSpacing: '0.01em' }],
        // Metadata / technical: 12–13px
        'meta': ['13px', { lineHeight: '18px' }],
        'meta-sm': ['12px', { lineHeight: '16px' }],
        // Captions / timestamps: 12px
        'caption': ['12px', { lineHeight: '16px' }],
      },
      spacing: {
        // Base unit 4px, multiples of 4/8/12/16/24/32/48 only.
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
        'sidebar': '240px',
        'content': '720px',
      },
      borderRadius: {
        // Buttons/inputs 6px, cards 8px, modals 12px.
        control: '6px',
        card: '8px',
        modal: '12px',
      },
      boxShadow: {
        control: '0 1px 2px rgba(26, 29, 35, 0.08)',
        card: '0 2px 8px rgba(26, 29, 35, 0.08)',
        modal: '0 16px 48px rgba(26, 29, 35, 0.18)',
        // Focus ring: soft 2px navy at 10% opacity, never browser blue.
        focus: '0 0 0 2px rgba(27, 42, 74, 0.10)',
        'focus-error': '0 0 0 2px rgba(196, 69, 61, 0.12)',
      },
      maxWidth: {
        content: '720px',
      },
      gridTemplateColumns: {
        // Asset grid: auto-fill, min card width 200px.
        assets: 'repeat(auto-fill, minmax(200px, 1fr))',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 180ms ease-out',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}

export default config
