import { Beef, CakeSlice, ClipboardList, Flame, GlassWater, CookingPot, Music2, Package, PartyPopper, Sandwich, Snowflake, Sparkles, Trash2, Utensils, Wrench, type LucideIcon } from "lucide-react";
import { checklistKind } from "../utils/checklistSuggestions";
const icons: Record<ReturnType<typeof checklistKind>, LucideIcon> = {
  coal: Flame, ice: Snowflake, tools: Wrench, meat: Beef, salt: CookingPot,
  cleaning: Sparkles, speaker: Music2, drinks: GlassWater, cake: CakeSlice,
  candles: Flame, tableware: Utensils, napkins: Package, trash: Trash2,
  blanket: Package, games: PartyPopper, snacks: Sandwich, other: ClipboardList,
};
export function ChecklistItemIcon({ label, size = 20 }: { label: string; size?: number }) {
  const Icon = icons[checklistKind(label)];
  return <Icon size={size} aria-hidden="true" />;
}
