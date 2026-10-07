-- Storage optimizations (docs/database-optimization.md). Converts existing rows in place.

-- match_rounds (25M rows, mostly per-row overhead) becomes matches.rounds: each match's duels as
-- one flat smallint[] (winner, loser, winner, loser...) in round order, then winning team (the
-- dropped table's key order, as roundsColumn() writes them).
ALTER TABLE "matches" ADD COLUMN "rounds" smallint[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
UPDATE "matches" SET "rounds" = r.flat FROM (
  SELECT "match_id", array_agg(duel.team ORDER BY "round_number", "winner_team_id", duel.side) AS flat
  FROM "match_rounds", LATERAL (VALUES (1, "winner_team_id"::smallint), (2, "loser_team_id"::smallint)) AS duel(side, team)
  GROUP BY "match_id"
) AS r WHERE "matches"."match_id" = r."match_id";--> statement-breakpoint
DROP TABLE "match_rounds" CASCADE;--> statement-breakpoint

-- jsonb id lists become integer[]. frames become packed bytea: packages/db/src/frames.ts's
-- encoding, [minute, physical, magical, true] per frame (the minute is the timestamp rounded to
-- the nearest one) as zigzag varint differences. The SQL below must produce the same bytes as
-- encodeFrames (checked on 201,229 real rows). One ALTER TABLE, one rewrite of the table.
CREATE FUNCTION _migration_jsonb_ints(j jsonb) RETURNS integer[] LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT ARRAY(SELECT jsonb_array_elements_text(j)::integer)
$$;--> statement-breakpoint
CREATE FUNCTION _migration_pack_frames(frames jsonb) RETURNS bytea LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE
  bytes int[] := '{}';
  previous bigint[] := ARRAY[0, 0, 0, 0];
  current bigint[];
  frame jsonb;
  zigzag bigint;
BEGIN
  FOR frame IN SELECT value FROM jsonb_array_elements(frames) LOOP
    current := ARRAY[
      round((frame->>0)::numeric / 60000),
      coalesce((frame->>1)::bigint, 0),
      coalesce((frame->>2)::bigint, 0),
      coalesce((frame->>3)::bigint, 0)
    ];
    FOR i IN 1..4 LOOP
      zigzag := current[i] - previous[i];
      zigzag := CASE WHEN zigzag >= 0 THEN zigzag * 2 ELSE -zigzag * 2 - 1 END;
      WHILE zigzag >= 128 LOOP
        bytes := bytes || (zigzag % 128 + 128)::int;
        zigzag := zigzag / 128;
      END LOOP;
      bytes := bytes || zigzag::int;
    END LOOP;
    previous := current;
  END LOOP;
  RETURN decode(array_to_string(ARRAY(SELECT lpad(to_hex(b), 2, '0') FROM unnest(bytes) AS b), ''), 'hex');
END $$;--> statement-breakpoint
ALTER TABLE "match_participants"
  ALTER COLUMN "augments" SET DATA TYPE integer[] USING _migration_jsonb_ints("augments"),
  ALTER COLUMN "items" SET DATA TYPE integer[] USING _migration_jsonb_ints("items"),
  ALTER COLUMN "boots_bought" SET DATA TYPE integer[] USING _migration_jsonb_ints("boots_bought"),
  ALTER COLUMN "boots_sold" SET DATA TYPE integer[] USING _migration_jsonb_ints("boots_sold"),
  ALTER COLUMN "purchased_item_ids" SET DATA TYPE integer[] USING _migration_jsonb_ints("purchased_item_ids"),
  ALTER COLUMN "frames" SET DATA TYPE bytea USING _migration_pack_frames("frames");--> statement-breakpoint
DROP FUNCTION _migration_jsonb_ints(jsonb);--> statement-breakpoint
DROP FUNCTION _migration_pack_frames(jsonb);
