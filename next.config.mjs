/** @type {import('next').NextConfig} */

// Supabase Storage public/signed object URLs are served from the project host,
// so `<Image>` needs it allow-listed for optimization to work.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname
  } catch {
    return null
  }
})()

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: 'https',
              hostname: supabaseHost,
              pathname: '/storage/v1/object/**',
            },
          ]
        : []),
      // Fallback for any Supabase-hosted project when the env var is absent at
      // build time (e.g. CI type-check without secrets).
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
}

export default nextConfig
