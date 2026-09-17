import { spawnSync } from "node:child_process";
import { join } from "node:path";

import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.env.WRANGLER_CI_OVERRIDE_NAME) {
  spawnSync(process.execPath, [join(process.cwd(), "scripts/sync-worker-name.mjs")], {
    stdio: "inherit",
  });
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;

initOpenNextCloudflareForDev();
