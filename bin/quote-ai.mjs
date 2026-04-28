#!/usr/bin/env node
// Wrapper that runs src/cli.ts under tsx without requiring a build step.
// Made executable by `npm link` / `npm install -g .`.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "..", "src", "cli.ts");
const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");

const child = spawn(
  process.execPath,
  [tsxCli, cli, ...process.argv.slice(2)],
  { stdio: "inherit" },
);
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
