#!/usr/bin/env node
/**
 * OpenNext 成果物が無い状態で wrangler deploy すると
 * 「Could not find compiled Open Next config」で落ちる。
 * ダッシュボードのデプロイコマンドが npx wrangler deploy でも、
 * npm run deploy 経由ならここで build を補う。
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, [join(root, "scripts/sync-worker-name.mjs")]);

const compiledConfig = join(
  root,
  ".open-next/.build/open-next.config.edge.mjs",
);
if (!existsSync(compiledConfig)) {
  console.log("OpenNext 成果物がないため build を実行します");
  run("npx", ["opennextjs-cloudflare", "build"]);
}

run("npx", ["opennextjs-cloudflare", "deploy", ...process.argv.slice(2)]);
