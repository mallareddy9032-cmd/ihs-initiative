/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@ihs/types', '@ihs/auth-client', '@ihs/db'],
  experimental: {
    // Monorepo file tracing — include workspace packages in standalone output
    outputFileTracingRoot: path.join(__dirname, '../..'),
  },
};

module.exports = nextConfig;
