/**
 * One-off maintenance script: re-derives match_participants rows (and
 * matches.bannedChampionIds) from the already-stored, already-compressed
 * `raw`/`timeline` blobs — no Riot API calls needed. Run this after adding
 * new columns/fields to parseMatch() that existing rows don't have yet.
 *
 * Does NOT touch matches.raw/matches.timeline — only re-runs the parts of
 * parseMatch() that produce match_participants rows and bannedChampionIds,
 * so it doesn't pay the cost of recompressing every match's raw payload.
 *
 * Usage: pnpm --filter @arena/db backfill-reparse-participants
 */
import { eq, sql } from "drizzle-orm";
import type { RiotArenaMatchDto, RiotMatchTimelineDto } from "@arena/types";
import { createDb } from "../src/client.js";
import { matches, matchParticipants } from "../src/schema.js";
import { decompressJson } from "../src/compression.js";
import { parseMatch } from "../src/parseMatch.js";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

async function main() {
  const db = createDb(DATABASE_URL!);

  const rows = await db
    .select({ matchId: matches.matchId, region: matches.region, raw: matches.raw, timeline: matches.timeline })
    .from(matches);

  console.log(`Re-parsing ${rows.length} matches...`);

  let done = 0;
  let missingTimeline = 0;

  for (const row of rows) {
    const dto = decompressJson<RiotArenaMatchDto>(row.raw);
    const timelineDto = row.timeline ? decompressJson<RiotMatchTimelineDto>(row.timeline) : null;
    if (!timelineDto) missingTimeline++;

    const { match, participants } = parseMatch(row.matchId, row.region, dto, timelineDto);

    await db.transaction(async (tx) => {
      await tx
        .update(matches)
        .set({ bannedChampionIds: match.bannedChampionIds })
        .where(eq(matches.matchId, row.matchId));

      await tx
        .insert(matchParticipants)
        .values(participants)
        .onConflictDoUpdate({
          target: [matchParticipants.matchId, matchParticipants.puuid],
          // Reference the incoming row's values (`excluded.<column>`), not
          // the existing target row — using the plain column object here
          // would just reassign each column to itself, a no-op.
          set: {
            timePlayedSeconds: sql`excluded.time_played_seconds`,
            damageDealtToChampionsPhysical: sql`excluded.damage_dealt_to_champions_physical`,
            damageDealtToChampionsMagic: sql`excluded.damage_dealt_to_champions_magic`,
            damageDealtToChampionsTrue: sql`excluded.damage_dealt_to_champions_true`,
            damageTakenPhysical: sql`excluded.damage_taken_physical`,
            damageTakenMagic: sql`excluded.damage_taken_magic`,
            damageTakenTrue: sql`excluded.damage_taken_true`,
            largestCriticalStrike: sql`excluded.largest_critical_strike`,
            healingAndShielding: sql`excluded.healing_and_shielding`,
            ccScoreSeconds: sql`excluded.cc_score_seconds`,
            ccTotalTimeDealt: sql`excluded.cc_total_time_dealt`,
            fistBumps: sql`excluded.fist_bumps`,
            qCasts: sql`excluded.q_casts`,
            wCasts: sql`excluded.w_casts`,
            eCasts: sql`excluded.e_casts`,
            rCasts: sql`excluded.r_casts`,
            summonerSpell1Casts: sql`excluded.summoner_spell_1_casts`,
            summonerSpell2Casts: sql`excluded.summoner_spell_2_casts`,
            pings: sql`excluded.pings`,
            statAnvilsBought: sql`excluded.stat_anvils_bought`,
            legendaryAnvilsBought: sql`excluded.legendary_anvils_bought`,
            prismaticAnvilsBought: sql`excluded.prismatic_anvils_bought`,
            totalTimeSpentDead: sql`excluded.total_time_spent_dead`,
            damageSelfMitigated: sql`excluded.damage_self_mitigated`,
            doubleKills: sql`excluded.double_kills`,
            tripleKills: sql`excluded.triple_kills`,
            quadraKills: sql`excluded.quadra_kills`,
            pentaKills: sql`excluded.penta_kills`,
            killingSprees: sql`excluded.killing_sprees`,
            largestKillingSpree: sql`excluded.largest_killing_spree`,
            largestMultiKill: sql`excluded.largest_multi_kill`,
            firstBloodKill: sql`excluded.first_blood_kill`,
            firstBloodAssist: sql`excluded.first_blood_assist`,
            itemsPurchased: sql`excluded.items_purchased`,
            consumablesPurchased: sql`excluded.consumables_purchased`,
            soloKills: sql`excluded.solo_kills`,
            skillshotsHit: sql`excluded.skillshots_hit`,
            skillshotsDodged: sql`excluded.skillshots_dodged`,
            flawlessAces: sql`excluded.flawless_aces`,
            saveAllyFromDeath: sql`excluded.save_ally_from_death`,
            frames: sql`excluded.frames`,
          },
        });
    });

    done++;
    if (done % 25 === 0) console.log(`  ${done}/${rows.length}...`);
  }

  console.log(`Done. Re-parsed ${done} matches (${missingTimeline} had no stored timeline).`);
  await db.$client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
