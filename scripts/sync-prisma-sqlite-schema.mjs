#!/usr/bin/env node
/**
 * Derives prisma/sqlite/schema.prisma from prisma/schema.prisma (models/enums only).
 * Replaces generator + datasource for SQLite integration tests.
 *
 * Usage:
 *   node scripts/sync-prisma-sqlite-schema.mjs           — write mirror
 *   node scripts/sync-prisma-sqlite-schema.mjs --check   — exit 1 if mirror differs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mainPath = path.join(root, "prisma", "schema.prisma");
const outPath = path.join(root, "prisma", "sqlite", "schema.prisma");

const HEADER =
  "// AUTO-GENERATED from prisma/schema.prisma — do not edit by hand.\n" +
  "// Run `npm run prisma:sync-sqlite-schema` after changing the main schema.\n" +
  "// SQLite test client + datasource for Vitest integration tests.\n\n";

const SQLITE_GEN = `generator client {
  provider = "prisma-client-js"
  output   = "../../src/generated/prisma-sqlite"
}`;

const SQLITE_DS = `datasource db {
  provider = "sqlite"
  url      = env("SQLITE_TEST_DATABASE_URL")
}`;

function extractAfterDatasource(prismaSource) {
  const genIdx = prismaSource.search(/generator client\s*\{/);
  if (genIdx === -1) {
    throw new Error("Could not find generator client { in prisma/schema.prisma");
  }
  const genRe = /^generator client\s*\{[\s\S]*?\n\}/m;
  const tailFromGen = prismaSource.slice(genIdx);
  const genMatch = genRe.exec(tailFromGen);
  if (!genMatch) throw new Error("Could not parse generator client { ... } in prisma/schema.prisma");

  const afterGen = tailFromGen.slice(genMatch[0].length).replace(/^\s+/, "");
  const dsRe = /^datasource db\s*\{[\s\S]*?\n\}/m;
  const dsMatch = dsRe.exec(afterGen);
  if (!dsMatch) throw new Error("Could not parse datasource db { ... } in prisma/schema.prisma");

  return afterGen.slice(dsMatch[0].length).replace(/^\s+/, "");
}

function buildMirror(mainContent) {
  const rest = extractAfterDatasource(mainContent);
  return `${HEADER}${SQLITE_GEN}\n\n${SQLITE_DS}\n\n${rest}`.replace(/\r\n/g, "\n");
}

const check = process.argv.includes("--check");
const src = fs.readFileSync(mainPath, "utf8");
const normalized = buildMirror(src);

if (check) {
  if (!fs.existsSync(outPath)) {
    console.error("Missing prisma/sqlite/schema.prisma — run npm run prisma:sync-sqlite-schema");
    process.exit(1);
  }
  const current = fs.readFileSync(outPath, "utf8").replace(/\r\n/g, "\n");
  if (current !== normalized) {
    console.error("prisma/sqlite/schema.prisma is out of sync with prisma/schema.prisma.");
    console.error("Run: npm run prisma:sync-sqlite-schema");
    process.exit(1);
  }
  console.log("SQLite schema mirror is in sync with prisma/schema.prisma.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, normalized, "utf8");
console.log("Wrote", path.relative(root, outPath));
