import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/*': ['./public/logo/universite-labe.png'],
  },
};

export default nextConfig;
