DROP INDEX "summoners_riot_id_idx";--> statement-breakpoint
ALTER TABLE "summoners" ADD COLUMN "riot_id_key" text;--> statement-breakpoint
CREATE INDEX "summoners_riot_id_idx" ON "summoners" USING btree ("region","riot_id_key");