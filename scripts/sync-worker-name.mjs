#!/usr/bin/env node
/**
 * Cloudflare Workers Builds はダッシュボードの Worker 名を
 * WRANGLER_CI_OVERRIDE_NAME で渡す。wrangler.jsonc の name と
 * WORKER_SELF_REFERENCE がそれと違うと、名前不一致か
 * service binding 10143 でデプロイが落ちる。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(root, "wrangler.jsonc");
const override = process.env.WRANGLER_CI_OVERRIDE_NAME?.trim();

if (!override) {
  process.exit(0);
}

if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(override)) {
  console.error(`Invalid WRANGLER_CI_OVERRIDE_NAME: ${override}`);
  process.exit(1);
}

const original = readFileSync(configPath, "utf8");
const currentName = original.match(/"name"\s*:\s*"([^"]+)"/)?.[1];
if (!currentName || currentName === override) {
  process.exit(0);
}

let next = original.replace(/"name"\s*:\s*"[^"]+"/, `"name": "${override}"`);
next = next.replace(
  /("binding"\s*:\s*"WORKER_SELF_REFERENCE",\s*"service"\s*:\s*")[^"]+"/,
  `$1${override}"`,
);

if (next === original) {
  console.error("Failed to sync wrangler Worker name for Cloudflare CI");
  process.exit(1);
}

writeFileSync(configPath, next);
console.log(
  `Synced wrangler Worker name ${currentName} → ${override} (Cloudflare CI)`,
);
