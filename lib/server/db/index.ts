import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseEnv } from "@/lib/server/env";
import * as relations from "@/lib/server/db/relations";
import * as schema from "@/lib/server/db/schema";

type SqlClient = ReturnType<typeof postgres>;

const globalDatabase = globalThis as typeof globalThis & { luminaSql?: SqlClient };
const sql = globalDatabase.luminaSql ?? postgres(databaseEnv.DATABASE_URL, {
  connect_timeout: 10,
  idle_timeout: 20,
  max: 10,
  prepare: false,
});
if (process.env.NODE_ENV !== "production") globalDatabase.luminaSql = sql;

export const db = drizzle(sql, { schema: { ...schema, ...relations } });
export type Database = typeof db;
