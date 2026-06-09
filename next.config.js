/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.56.1'],
  serverExternalPackages: ['@libsql/client', 'bcryptjs', 'iron-session'],
};

module.exports = nextConfig;