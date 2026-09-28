"use client";

/** Teammate avatar — no profile icon is available for matchmade players, so
 * this shows the first letter of their name in the app's usual
 * diamond-cornered frame instead of leaving a blank slot. */
function InitialAvatar({ name }: { name: string }) {
  return (
    <div
      className="flex h-9 w-9 items-center justify-center border font-display text-sm text-lol-text-muted"
      style={{
        borderColor: "rgba(200,170,110,.3)",
        background: "rgba(240,230,210,.03)",
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export { InitialAvatar };
