/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  async rewrites() {
    const engine = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    return [
      {
        source: '/api/engine/:path*',
        destination: `${engine}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
