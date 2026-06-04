/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allows verification builds to use a separate output dir (so they never
  // clobber a running `next dev` server's .next folder).
  distDir: process.env.NEXT_VERIFY_DIST || ".next",
};

module.exports = nextConfig;
