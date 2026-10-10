import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
