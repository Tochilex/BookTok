import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: { remotePatterns: [
    { protocol: 'https', hostname: 'covers.openlibrary.org'},
    { protocol: 'https', hostname: 'jbzjvlxrfay8c2wa.public.blob.vercel-storage.com'},
  ]}
};

export default nextConfig;


