import { spawnSync } from "node:child_process";
import process from "node:process";

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });
}

function escapeForPowerShell(value) {
  return value.replace(/'/g, "''");
}

function readWindowsProjectDevPids(projectDir) {
  const normalizedProjectDir = projectDir.toLowerCase().replace(/\//g, "\\");
  const escapedProjectDir = escapeForPowerShell(normalizedProjectDir);
  const script = `
    $projectDir = '${escapedProjectDir}'
    $processes = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
      Where-Object {
        $_.CommandLine -and
        $_.CommandLine.ToLower().Contains($projectDir) -and (
          $_.CommandLine -match 'npm-cli\\.js" run dev' -or
          $_.CommandLine -match 'next\\\\dist\\\\bin\\\\next" dev' -or
          $_.CommandLine -match 'start-server\\.js' -or
          $_.CommandLine -match '\\\\.next\\\\postcss\\.js'
        )
      } |
      Select-Object -ExpandProperty ProcessId

    if ($processes) {
      @($processes) | ConvertTo-Json -Compress
    }
  `;

  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command", script],
    {
      encoding: "utf8",
      cwd: projectDir,
    },
  );

  if (result.status !== 0) {
    return [];
  }

  const stdout = result.stdout.trim();
  if (!stdout) {
    return [];
  }

  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function stopWindowsProjectDevServers(projectDir) {
  const pids = [...new Set(readWindowsProjectDevPids(projectDir))];
  if (pids.length === 0) {
    return [];
  }

  console.log(
    `Stopping project dev server process(es) before Prisma generate: ${pids.join(", ")}`,
  );

  for (const pid of pids) {
    spawnSync("cmd.exe", ["/c", "taskkill", "/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      cwd: projectDir,
    });
  }

  spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command", "Start-Sleep -Milliseconds 1500"],
    {
      stdio: "ignore",
      cwd: projectDir,
    },
  );

  return pids;
}

function runGenerate(projectDir) {
  if (process.platform === "win32") {
    return runCommand("cmd.exe", ["/d", "/s", "/c", "npx prisma generate"], {
      cwd: projectDir,
      env: process.env,
    });
  }

  return runCommand("npx", ["prisma", "generate"], {
    cwd: projectDir,
    env: process.env,
  });
}

function main() {
  const projectDir = process.cwd();

  if (process.platform === "win32") {
    stopWindowsProjectDevServers(projectDir);
  }

  let result = runGenerate(projectDir);

  if (result.status !== 0 && process.platform === "win32") {
    const extraStoppedPids = stopWindowsProjectDevServers(projectDir);
    if (extraStoppedPids.length > 0) {
      console.log("Retrying Prisma generate after stopping remaining project dev processes...");
      result = runGenerate(projectDir);
    }
  }

  if (result.status === 0) {
    return;
  }

  if (process.platform === "win32") {
    console.error(
      [
        "",
        "Prisma generate still failed on Windows.",
        "If the error is EPERM on query_engine-windows.dll.node, another process still has the engine file locked.",
        "Close any remaining Next.js dev servers, Prisma Studio, or antivirus scanners touching the project and retry.",
      ].join("\n"),
    );
  }

  process.exit(result.status ?? 1);
}

main();
