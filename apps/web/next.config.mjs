/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    const integrationUrl =
      process.env.INTEGRATION_SERVICE_URL || "http://localhost:3001";
    return [
      {
        source: "/internal/:path*",
        destination: `${integrationUrl}/internal/:path*`,
      },
    ];
  },
};

export default nextConfig;
