/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@libsql/client', 'bcryptjs', 'iron-session'],
};

module.exports = nextConfig;