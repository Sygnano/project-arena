"use client";

import { useId, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_SEARCH_PLATFORM, platformRegionName, SEARCH_PLATFORMS } from "@/lib/riot";
import { gameNameError, sanitizeTagLine, summonerPath, tagLineError } from "@/lib/riot-id";

const PLATFORM_STORAGE_KEY = "arena-stats:platform";

type Props = {
  /** `hero` is the splash page's large form, `compact` the top bar's. */
  variant: "hero" | "compact";
  autoFocus?: boolean;
  /** Called once a lookup succeeded and navigation started (e.g. to close a
   * mobile panel). */
  onNavigate?: () => void;
  className?: string;
};

function readStoredPlatform(): string {
  try {
    const saved = localStorage.getItem(PLATFORM_STORAGE_KEY);
    if (saved && SEARCH_PLATFORMS.some((p) => p.id === saved)) return saved;
  } catch {
    // Storage unavailable (private mode, blocked): keep the default.
  }
  return DEFAULT_SEARCH_PLATFORM;
}

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function platformLabel(id: string) {
  return SEARCH_PLATFORMS.find((platform) => platform.id === id)?.label ?? id.toUpperCase();
}

/**
 * Riot ID search: game name, tag line and server as one framed field.
 * Typing or pasting a full "Name#TAG" into the name splits it across both
 * inputs, and Backspace in an empty tag steps back into the name, so it
 * types like a single field. Validation follows Riot's rules
 * (`lib/riot-id.ts`) and only speaks up after a first submit attempt.
 * Submitting resolves the Riot ID through the API (which queues its first
 * fetch or a stale refresh) and navigates to the summoner page, which shows
 * the queue until the recap is ready.
 */
function RiotIdSearch({ variant, autoFocus, onNavigate, className }: Props) {
  const router = useRouter();
  const hero = variant === "hero";
  const errorId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const tagRef = useRef<HTMLInputElement>(null);

  // The last server searched, remembered per browser; the server render
  // (and a blocked storage) falls back to the default.
  const storedPlatform = useSyncExternalStore(subscribeToStorage, readStoredPlatform, () => DEFAULT_SEARCH_PLATFORM);
  const [chosenPlatform, setChosenPlatform] = useState<string | null>(null);
  const platform = chosenPlatform ?? storedPlatform;
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [pending, startTransition] = useTransition();

  const nameError = attempted ? gameNameError(gameName) : null;
  const tagError = attempted ? tagLineError(tagLine) : null;
  const error = nameError ?? tagError;

  const changePlatform = (value: string) => {
    setChosenPlatform(value);
    try {
      localStorage.setItem(PLATFORM_STORAGE_KEY, value);
    } catch {
      // Not remembered this time; nothing else depends on it.
    }
  };

  const changeName = (value: string) => {
    const hashIndex = value.indexOf("#");
    if (hashIndex === -1) {
      setGameName(value);
      return;
    }
    setGameName(value.slice(0, hashIndex));
    const tail = sanitizeTagLine(value.slice(hashIndex + 1));
    if (tail) setTagLine(tail);
    tagRef.current?.focus();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (gameNameError(gameName)) return nameRef.current?.focus();
    if (tagLineError(tagLine)) return tagRef.current?.focus();

    // Straight to the summoner's page: it reads our database, and only its
    // "fetch matches" button reaches Riot (see the page's refresh stream).
    startTransition(() => {
      router.push(summonerPath(platform, gameName.trim(), tagLine.trim()));
      onNavigate?.();
    });
  };

  return (
    <form role="search" aria-label="Find a summoner" noValidate onSubmit={submit} className={cn("relative", className)}>
      <div
        className={cn(
          "group/field relative flex items-stretch border bg-[rgba(5,14,22,.82)] transition-[border-color,box-shadow] duration-300",
          "border-[rgba(200,170,110,.45)] focus-within:border-lol-gold-300 focus-within:shadow-[0_0_0_1px_rgba(10,200,185,.25),0_0_28px_rgba(10,200,185,.18)]",
          error && "border-[rgba(232,64,87,.7)] focus-within:border-[rgba(232,64,87,.9)]",
          hero ? "h-14 sm:h-16" : "h-9",
        )}
      >
        {/* Hextech corner studs on the large field only. */}
        {hero ? (
          <span aria-hidden className="pointer-events-none absolute inset-0">
            <span className="absolute -top-px -left-px h-2.5 w-2.5 border-t border-l border-lol-gold-300" />
            <span className="absolute -top-px -right-px h-2.5 w-2.5 border-t border-r border-lol-gold-300" />
            <span className="absolute -bottom-px -left-px h-2.5 w-2.5 border-b border-l border-lol-gold-300" />
            <span className="absolute -right-px -bottom-px h-2.5 w-2.5 border-r border-b border-lol-gold-300" />
          </span>
        ) : null}

        <label className="flex min-w-0 flex-1 items-center">
          <span className="sr-only">Game name</span>
          <input
            ref={nameRef}
            value={gameName}
            onChange={(event) => changeName(event.target.value)}
            placeholder="Game name"
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "h-full w-full min-w-0 bg-transparent text-lol-gold-50 outline-none focus-visible:shadow-none focus-visible:outline-none placeholder:text-lol-text-muted",
              hero
                ? "px-4 text-[13px] tracking-[.18em] placeholder:uppercase sm:px-5"
                : "px-2.5 text-[11px] tracking-[.18em] placeholder:uppercase",
            )}
          />
        </label>

        <span
          aria-hidden
          className={cn("flex flex-none items-center text-lol-gold-300", hero ? "text-[13px]" : "text-[11px]")}
        >
          #
        </span>

        <label className="flex flex-none items-center">
          <span className="sr-only">Tag line</span>
          <input
            ref={tagRef}
            value={tagLine}
            onChange={(event) => {
              setTagLine(sanitizeTagLine(event.target.value));
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && tagLine === "") {
                event.preventDefault();
                nameRef.current?.focus();
              }
            }}
            placeholder="TAG"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="search"
            aria-invalid={tagError ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "h-full bg-transparent text-lol-gold-100 uppercase outline-none focus-visible:shadow-none focus-visible:outline-none placeholder:text-lol-text-muted",
              hero
                ? "w-[6em] pr-2 pl-1.5 text-[13px] tracking-[.18em]"
                : "w-[5.5em] pr-1 pl-1 text-[11px] tracking-[.18em]",
            )}
          />
        </label>

        <Select value={platform} onValueChange={changePlatform}>
          <SelectTrigger
            aria-label={`Server: ${platformRegionName(platform)}`}
            className={cn(
              "h-full! flex-none gap-2 rounded-none border-0 bg-transparent! text-lol-gold-100 shadow-none! ring-0!",
              "tracking-[.18em] hover:text-lol-gold-50 focus-visible:text-lol-gold-50 data-[state=open]:text-lol-gold-50",
              "[&_svg]:text-lol-gold-300! [&_svg]:transition-transform data-[state=open]:[&_svg]:rotate-180",
              hero
                ? "min-w-[5.5rem] pr-4 pl-3 text-[13px] sm:min-w-[6.5rem] sm:pr-5"
                : "min-w-[4.25rem] pr-2 pl-2 text-[11px]",
            )}
          >
            <SelectValue>{platformLabel(platform)}</SelectValue>
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="end"
            sideOffset={6}
            className={cn(
              "z-[70] min-w-56 rounded-none border border-[rgba(200,170,110,.5)] bg-[rgba(5,14,22,.97)] p-1 text-lol-gold-100 ring-0 backdrop-blur-md",
              "shadow-[0_12px_32px_rgba(0,0,0,.6),0_0_24px_rgba(10,200,185,.08)]",
            )}
          >
            {SEARCH_PLATFORMS.map((option) => (
              <SelectItem
                key={option.id}
                value={option.id}
                className={cn(
                  "rounded-none py-2 pr-8 pl-3 text-lol-gold-100",
                  "focus:bg-[rgba(10,50,60,.85)] focus:**:text-lol-gold-50! data-[state=checked]:text-lol-gold-50",
                  "[&_svg]:text-lol-blue-300",
                )}
              >
                <span className="w-12 font-display text-[15px] tracking-[.12em]">{option.label}</span>
                <span className="text-xs text-lol-text-muted">{platformRegionName(option.id)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="submit"
          disabled={pending}
          aria-label={hero ? undefined : "Search"}
          className={cn(
            "group/submit relative flex flex-none items-center justify-center gap-2 border-l border-[rgba(200,170,110,.35)] text-lol-gold-50 transition-[background,color] duration-300",
            "bg-[linear-gradient(180deg,rgba(10,50,60,.9),rgba(9,20,40,.95))] hover:bg-[linear-gradient(180deg,rgba(3,151,171,.45),rgba(10,50,60,.95))]",
            "focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-lol-blue-300 disabled:cursor-wait",
            hero ? "px-5 text-[13px] tracking-[.28em] sm:px-7" : "w-9",
          )}
        >
          <Search
            aria-hidden
            className={cn(
              "text-lol-blue-200 transition-transform group-hover/submit:scale-110",
              hero ? "h-4 w-4" : "h-3.5 w-3.5",
              pending && "animate-pulse",
            )}
          />
          {hero ? <span className="hidden sm:inline">{pending ? "SEARCHING" : "SEARCH"}</span> : null}
        </button>
      </div>

      <p
        id={errorId}
        role="alert"
        className={cn(
          "text-[#f08a98]",
          hero
            ? "mt-3 min-h-5 text-center text-sm"
            : "absolute top-full right-0 mt-1.5 max-w-80 bg-lol-navy-950/95 px-2.5 py-1.5 text-xs empty:hidden",
        )}
      >
        {error ?? ""}
      </p>
    </form>
  );
}

export { RiotIdSearch };
