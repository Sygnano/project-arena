-- jsonb -> bytea: casts existing rows through their JSON text representation,
-- so this step is lossless but NOT yet brotli-compressed (bytea just holds
-- the raw JSON text's UTF-8 bytes for now). A separate one-off script
-- (packages/db/scripts/backfill-compress.ts) recompresses existing rows
-- after this migration runs — new rows written by the app are already
-- compressed via compressJson() at insert time.
ALTER TABLE "matches" ALTER COLUMN "raw" SET DATA TYPE bytea USING "raw"::text::bytea;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "timeline" SET DATA TYPE bytea USING "timeline"::text::bytea;
