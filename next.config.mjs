/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
          ? `${process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/api/:path*`
          : 'http://localhost:8000/api/:path*',
      },
    ]
  },
}

export default nextConfig
