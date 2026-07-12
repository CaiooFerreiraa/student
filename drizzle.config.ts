import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não configurada.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrl.replace("-pooler.", ".") },
  schemaFilter: ["public"],
  introspect: { casing: "camel" },
  migrations: { table: "__drizzle_migrations", schema: "public" },
  strict: true,
});
