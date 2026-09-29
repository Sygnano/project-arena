import { SEARCH_PLATFORMS, DEFAULT_SEARCH_PLATFORM } from "@/utils/riot";
import { PLATFORM_STORAGE_KEY } from "./constants";

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

export { readStoredPlatform, subscribeToStorage, platformLabel };
