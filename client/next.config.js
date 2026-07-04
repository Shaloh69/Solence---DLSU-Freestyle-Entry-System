const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this package using the same path spelling
  // the process was launched with. Without this, Next infers the root by
  // resolving the real path — and C:\Projects is an NTFS junction to
  // D:\Projects-Shem, so the inferred (D:) root and the cwd-based (C:)
  // project dir end up on different drive letters, corrupting .next
  // manifest paths (ENOENT routes-manifest.json with a doubled path).
  outputFileTracingRoot: path.join(__dirname, ".."),
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

module.exports = nextConfig;
