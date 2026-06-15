import { buildSearchIndex } from "@/lib/searchIndex";
import { CommandPalette } from "./CommandPalette";

// Server component: builds the lightweight index here so the full program
// dataset never ships to the client — only the ~90-entry index does.
export function CommandPaletteMount() {
  const index = buildSearchIndex();
  return <CommandPalette index={index} />;
}
