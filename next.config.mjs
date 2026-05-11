/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "files.shopify.com" },
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "media.discordapp.net" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "dl.dropboxusercontent.com" },
      { protocol: "https", hostname: "content.dropboxapi.com" },
      { protocol: "https", hostname: "ucarecdn.com" }
    ]
  }
};

export default nextConfig;
