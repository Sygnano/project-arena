import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  RIOT_API_KEY: z.string().min(1, "RIOT_API_KEY is required"),
  PORT: z.coerce.number().default(3001),
  // Minutes between ingestion polls of all tracked summoners.
  INGESTION_INTERVAL_MINUTES: z.coerce.number().default(15),
});

export const env = envSchema.parse(process.env);
