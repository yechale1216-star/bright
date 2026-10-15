import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monorepoRoot = path.resolve(__dirname, '../../');

const isCapacitorBuild = process.env.CAPACITOR_BUILD === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, '../../'),
  output: isCapacitorBuild ? 'export' : undefined,
  typescript: {
    ignoreBuildErrors: isCapacitorBuild ? true : false,
  },
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  env: {
    PORTAL_NAME: 'student-parent',
    NEXT_PUBLIC_PORTAL_TYPE: 'student-parent',
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@/components': path.resolve(monorepoRoot, 'components'),
      '@/lib': path.resolve(monorepoRoot, 'lib'),
      '@/hooks': path.resolve(monorepoRoot, 'hooks'),
      '@/types': path.resolve(monorepoRoot, 'types'),
      '@/styles': path.resolve(monorepoRoot, 'styles'),
      '@/packages': path.resolve(monorepoRoot, 'packages'),
    };
    return config;
  },
  redirects: isCapacitorBuild
    ? undefined
    : async () => [
        {
          source: '/portal/login',
          destination: '/login',
          permanent: false,
        },
        {
          source: '/portal',
          destination: '/login',
          permanent: false,
        },
        {
          source: '/school/:path*',
          destination: 'http://localhost:3000/school/:path*',
          permanent: false,
        },
      ],
};

export default nextConfig;
