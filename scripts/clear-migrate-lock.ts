/**
 * Releases a stale Prisma migrate advisory lock (key 72707369) that can linger
 * on Neon when a `prisma migrate deploy` run is interrupted. Connects over the
 * DIRECT (non-pooled) URL, lists any advisory-lock holders, and terminates them
 * so the next deploy can acquire the lock.
 */
import { PrismaClient } from "@prisma/client";

const directUrl =
  process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "";

const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } },
});

async function main() {
  const holders = await prisma.$queryRawUnsafe<
    { pid: number; objid: number; granted: boolean; state: string | null }[]
  >(
    `SELECT l.pid, l.objid, l.granted, a.state
     FROM pg_locks l
     LEFT JOIN pg_stat_activity a ON a.pid = l.pid
     WHERE l.locktype = 'advisory'`
  );

  console.log(
    "[lock] advisory lock rows:",
    holders.map((h) => `pid=${h.pid} objid=${h.objid} granted=${h.granted} state=${h.state}`)
  );

  for (const holder of holders) {
    try {
      await prisma.$queryRawUnsafe(
        `SELECT pg_terminate_backend(${holder.pid})`
      );
      console.log(`[lock] terminated backend pid=${holder.pid}`);
    } catch (error) {
      console.error(`[lock] could not terminate pid=${holder.pid}`, error);
    }
  }

  if (holders.length === 0) {
    console.log("[lock] no advisory locks found — nothing to clear.");
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("[lock] fatal", error);
  await prisma.$disconnect();
  process.exit(1);
});
