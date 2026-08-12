'use client'

/**
 * Last-resort boundary: catches failures in the root layout itself, where the
 * app shell (and its fonts/styles) may not have rendered. Deliberately
 * self-contained with inline styles rather than depending on globals.css.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F7F6F3',
          color: '#1A1D23',
          fontFamily: 'Georgia, serif',
          padding: '24px',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: 32, fontWeight: 500, margin: 0 }}>
            Something went wrong
          </h1>
          <p
            style={{
              marginTop: 12,
              fontSize: 15,
              lineHeight: 1.6,
              color: '#5B6472',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Something went wrong on our end — please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              height: 40,
              padding: '0 16px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: '#1B2A4A',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '0.01em',
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p
              style={{
                marginTop: 24,
                fontSize: 12,
                color: '#5B6472',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
