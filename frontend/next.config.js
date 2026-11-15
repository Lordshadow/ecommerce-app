/** @type {import('next').NextConfig} */
const apiProxyTarget = (process.env.API_PROXY_TARGET || 'http://localhost:5000').replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['images.unsplash.com'],
  },
  async rewrites() {
    return [{
      source: '/api/:path*',
      destination: `${apiProxyTarget}/api/:path*`,
    }];
  },
};

module.exports = nextConfig;
