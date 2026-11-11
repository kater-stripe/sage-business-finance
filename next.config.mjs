const nextConfig = {
  devIndicators: false,
  transpilePackages: ['@demoeng/utils', '@demoeng/tools-panel'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
        port: '',
        pathname: '**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.dev.stripe.me https://dory.qa.corp.stripe.com https://dory.corp.stripe.com",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin"
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true"
          },
          {
            key: "Vary",
            value: "Origin"
          },
        ],
      },
    ];
  },
  allowedDevOrigins: ['*.dev.stripe.me', 'dory.qa.corp.stripe.com', 'dory.corp.stripe.com']
};

export default nextConfig;
