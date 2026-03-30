import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);

function runNodeScript(scriptPath, args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
}

function main() {
  const prismaCliPath = require.resolve("prisma/build/index.js");
  const nextCliPath = require.resolve("next/dist/bin/next");
  const forwardedArgs = process.argv.slice(2);

  const migrateResult = runNodeScript(prismaCliPath, ["migrate", "deploy"]);
  if (migrateResult.status !== 0) {
    process.exit(migrateResult.status ?? 1);
  }

  const nextProcess = spawn(
    process.execPath,
    [nextCliPath, "dev", "--turbopack", ...forwardedArgs],
    {
      stdio: "inherit",
      cwd: process.cwd(),
      env: process.env,
    },
  );

  nextProcess.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main();
