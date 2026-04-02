import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);
const DEFAULT_MIGRATE_ATTEMPTS = 6;
const DEFAULT_RETRY_DELAY_MS = 5000;

function runNodeScript(scriptPath, args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: process.env,
  });
}

function writeSpawnOutput(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getPositiveIntEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isRetryableMigrateLockTimeout(result) {
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return (
    combined.includes("Error: P1002") &&
    /advisory lock/i.test(combined) &&
    /timed out/i.test(combined)
  );
}

async function runMigrateDeployWithRetry(prismaCliPath) {
  const maxAttempts = getPositiveIntEnv(
    "PRISMA_MIGRATE_MAX_ATTEMPTS",
    DEFAULT_MIGRATE_ATTEMPTS,
  );
  const retryDelayMs = getPositiveIntEnv(
    "PRISMA_MIGRATE_RETRY_DELAY_MS",
    DEFAULT_RETRY_DELAY_MS,
  );

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = runNodeScript(prismaCliPath, ["migrate", "deploy"]);
    writeSpawnOutput(result);

    if (result.status === 0) {
      return result;
    }

    if (!isRetryableMigrateLockTimeout(result) || attempt === maxAttempts) {
      return result;
    }

    process.stderr.write(
      `\nPrisma migrate deploy could not acquire the advisory lock. Retrying in ${retryDelayMs}ms (${attempt}/${maxAttempts})...\n\n`,
    );
    await sleep(retryDelayMs);
  }

  return { status: 1 };
}

async function main() {
  const prismaCliPath = require.resolve("prisma/build/index.js");
  const nextCliPath = require.resolve("next/dist/bin/next");
  const forwardedArgs = process.argv.slice(2);

  const migrateResult = await runMigrateDeployWithRetry(prismaCliPath);
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
