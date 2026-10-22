/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // UI là HTML/JS classic trong public/ui (mở được cả bằng file://).
    return [
      { source: "/", destination: "/ui/index.html", permanent: false },
      { source: "/ui", destination: "/ui/index.html", permanent: false },
    ]
  },
}
module.exports = nextConfig
