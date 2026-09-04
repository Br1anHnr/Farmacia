/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@hub-farmacia/contracts', '@hub-farmacia/ui'],
  reactStrictMode: true,
  async rewrites() {
    const integrationUrl = process.env.INTEGRATION_SERVICE_URL || 'http://localhost:3001';
    return [
      {
        source: '/internal/:path*',
        destination: `${integrationUrl}/internal/:path*`,
      },
      {
        source: '/api/conversations/:path*',
        destination: `${integrationUrl}/api/conversations/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
