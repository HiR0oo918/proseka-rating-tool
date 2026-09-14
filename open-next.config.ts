import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig(),
  // Cloudflare のビルドコマンドは npm run build なので、ここで next を直接叩いて再帰しない
  buildCommand: "npx next build",
};
