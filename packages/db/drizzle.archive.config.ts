import { defineConfig } from "drizzle-kit";

// The archive database's own schema and migrations (src/archiveSchema.ts). Its URL: as
// `archiveDatabaseUrl()` in src/client.ts, ARCHIVE_DATABASE_URL else DATABASE_URL's server with
// the database `arena_archive`.
function archiveUrl() {
  if (process.env.ARCHIVE_DATABASE_URL) return process.env.ARCHIVE_DATABASE_URL;
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = "/arena_archive";
  return url.toString();
}

export default defineConfig({
  schema: "./src/archiveSchema.ts",
  out: "./drizzle-archive",
  dialect: "postgresql",
  dbCredentials: { url: archiveUrl() },
  strict: true,
});
