import "dotenv/config";
import { defineConfig, env } from "prisma/config";

const runtimeDatabaseUrl = env("DATABASE_URL");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun prisma/seed.ts",
  },
  datasource: {
    // Prisma CLI uses prepared statements while generating TypedSQL. Neon pooler
    // does not preserve those statements, so CLI operations use the equivalent
    // direct endpoint. The application runtime still uses the pooled URL.
    url: runtimeDatabaseUrl.replace("-pooler.", "."),
  },
});
