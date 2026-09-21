import { TopBar } from "@/components/top-bar";

/** Every summoner page (queue screen, recap, not found) shares the top bar. */
export default function SummonerLayout({ children }: LayoutProps<"/summoner">) {
  return (
    <>
      <TopBar />
      {children}
    </>
  );
}
