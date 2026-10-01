/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@infinite-canvas-tutorial/react',
    '@infinite-canvas-tutorial/ecs',
    '@infinite-canvas-tutorial/webcomponents',
  ],
};

export default nextConfig;
