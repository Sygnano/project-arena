import { SEARCH_PLATFORMS } from "@/utils/riot";

function platformLabel(region: string): string {
  return SEARCH_PLATFORMS.find((platform) => platform.id === region.toLowerCase())?.label ?? region.toUpperCase();
}

export { platformLabel };
