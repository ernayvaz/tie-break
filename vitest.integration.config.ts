import path from "node:path";
import { defineConfig } from "vitest/config";

/** Relative to project root when running `vitest run` from repo root. */
process.env.SQLITE_TEST_DATABASE_URL = "file:./prisma/sqlite/integration.sqlite";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    exclude: ["**/node_modules/**"],
    fileParallelism: false,
    poolOptions: {
      threads: { singleThread: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
