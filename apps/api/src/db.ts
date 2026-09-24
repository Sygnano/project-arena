import { createDb } from "@arena/db";
import { env } from "./env.js";

// Without them, one stuck query or lock would hang a region's refresh lane
// (and every refresh queued behind it) or the /health check forever. The
// heaviest query takes well under a second (a recap's games, ~140 ms for
// 910 games), and no transaction waits on anything but the database. The
// startup migrations use their own connection, without these.
export const db = createDb(env.DATABASE_URL, { statementTimeoutMs: 15_000, idleInTransactionTimeoutMs: 30_000 });
