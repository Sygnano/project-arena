const CARD_CORNERS = [
  "-top-1.25 -left-1.25",
  "-top-1.25 -right-1.25",
  "-bottom-1.25 -left-1.25",
  "-bottom-1.25 -right-1.25",
] as const;

// Each card gets its own flavour line above the name, in the slot the
// "The" of "The Golden Spatula" used to occupy — matched on the item's real
// name so an item we have no line for simply renders without one.
const EYEBROWS: { match: RegExp; text: string }[] = [
  { match: /golden spatula/i, text: "Must. Do. Everything." },
  { match: /wooglet/i, text: "lol thanks Riot. You made it!" },
  { match: /void immolation/i, text: "Icathia's fall" },
];

export { CARD_CORNERS, EYEBROWS };
