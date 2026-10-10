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
    PORTAL_NAME: 'school',
    NEXT_PUBLIC_PORTAL_TYPE: 'school',
  },
  redirects: isCapacitorBuild
    ? undefined
    : async () => [
        {
          source: '/admin/:path*',
          destination: '/school/admin/:path*',
          permanent: false,
        },
        {
          source: '/teacher/:path*',
          destination: '/school/teacher/:path*',
          permanent: false,
        },
        {
          source: '/registrar/:path*',
          destination: '/school/registrar/:path*',
          permanent: false,
        },
        {
          source: '/discipline-officer/:path*',
          destination: '/school/discipline-officer/:path*',
          permanent: false,
        },
        {
          source: '/staff/:path*',
          destination: '/school/staff/:path*',
          permanent: false,
        },
        {
          source: '/student/:path*',
          destination: 'http://localhost:3001/student/:path*',
          permanent: false,
        },
        {
          source: '/parent/:path*',
          destination: 'http://localhost:3001/parent/:path*',
          permanent: false,
        },
      ],
};

export default nextConfig;
