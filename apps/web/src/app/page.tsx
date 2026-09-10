import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-panel px-6 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-section">Arena Stats</p>
      <h1 className="text-4xl font-medium text-heading">Placement, augments, synergy.</h1>
      <p className="max-w-md text-lol-text-secondary">
        Match history and Arena stats for the crew — champion/augment win rates and team synergy,
        coming next.
      </p>
      <Button>View leaderboard</Button>
    </div>
  );
}
