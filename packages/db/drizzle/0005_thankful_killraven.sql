ALTER TABLE "match_participants" ADD COLUMN "total_time_spent_dead" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "damage_self_mitigated" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "double_kills" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "triple_kills" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "quadra_kills" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "penta_kills" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "killing_sprees" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "largest_killing_spree" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "largest_multi_kill" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "first_blood_kill" boolean;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "first_blood_assist" boolean;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "items_purchased" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "consumables_purchased" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "solo_kills" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "skillshots_hit" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "skillshots_dodged" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "flawless_aces" integer;--> statement-breakpoint
ALTER TABLE "match_participants" ADD COLUMN "save_ally_from_death" integer;