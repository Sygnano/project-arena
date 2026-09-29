import { HextechEmblem } from "@/components/status-screen";
import { profileIconUrl } from "@/utils/riot";

type Props = { profileIconId: number | null };

/** The emblem with the summoner's profile icon at its heart, when known. */
function SummonerEmblem({ profileIconId }: Props) {
  if (profileIconId === null) return <HextechEmblem />;
  return (
    <HextechEmblem>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={profileIconUrl(profileIconId)}
        alt=""
        className="absolute inset-[46px] h-[68px] w-[68px] border border-[rgba(200,170,110,.5)]"
      />
    </HextechEmblem>
  );
}

export { SummonerEmblem };
