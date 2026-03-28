const createNextIntlPlugin = require("next-intl/plugin");
const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "sjhemxejhyztbsctkqvb.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Windows 환경에서 파일 잠금(UNKNOWN errno -4094) 방지
      config.cache = false; // webpack 캐시 완전 비활성화
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000, // 1초 간격 폴링으로 파일 변경 감지
        aggregateTimeout: 300, // 변경 후 300ms 대기 후 빌드
      };
      // output 파일 쓰기 충돌 방지
      config.output = {
        ...config.output,
        hashFunction: "xxhash64",
      };
    }
    return config;
  },
};

module.exports = withNextIntl(nextConfig);
