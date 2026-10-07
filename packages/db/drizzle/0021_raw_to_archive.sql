-- Riot's payloads move to the archive database (drizzle-archive/0000_archived_matches.sql). This
-- drops them: on a database holding matches, copy match_id/raw/timeline into the archive first.
-- region was the match id's prefix (platformOfMatch).
ALTER TABLE "matches" DROP COLUMN "region";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "raw";--> statement-breakpoint
ALTER TABLE "matches" DROP COLUMN "timeline";