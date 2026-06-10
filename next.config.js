/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.56.1'],
  output: 'standalone',
  transpilePackages: ['iron-session'],
};

module.exports = nextConfig;