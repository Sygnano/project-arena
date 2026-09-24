-- The jsonb object repeated all 14 key names on every row (~338 bytes); an array in PING_TYPES
-- order (packages/db/src/schema.ts) takes ~52. A missing key was read as 0, so it becomes 0.
ALTER TABLE "match_participants" ALTER COLUMN "pings" SET DATA TYPE smallint[] USING (
  CASE WHEN "pings" IS NULL THEN NULL ELSE ARRAY[
    COALESCE(("pings"->>'allIn')::smallint, 0),
    COALESCE(("pings"->>'assistMe')::smallint, 0),
    COALESCE(("pings"->>'basic')::smallint, 0),
    COALESCE(("pings"->>'command')::smallint, 0),
    COALESCE(("pings"->>'danger')::smallint, 0),
    COALESCE(("pings"->>'enemyMissing')::smallint, 0),
    COALESCE(("pings"->>'enemyVision')::smallint, 0),
    COALESCE(("pings"->>'getBack')::smallint, 0),
    COALESCE(("pings"->>'hold')::smallint, 0),
    COALESCE(("pings"->>'needVision')::smallint, 0),
    COALESCE(("pings"->>'onMyWay')::smallint, 0),
    COALESCE(("pings"->>'push')::smallint, 0),
    COALESCE(("pings"->>'retreat')::smallint, 0),
    COALESCE(("pings"->>'visionCleared')::smallint, 0)
  ] END
);
