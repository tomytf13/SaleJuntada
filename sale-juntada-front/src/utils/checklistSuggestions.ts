export const normalizeChecklistLabel = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const kinds = [
  ["coal", /\b(carbon|carbones|briquetas|lena)\b/],
  ["ice", /\b(hielo|hielos)\b/],
  ["tools", /\b(herramientas|pinza|pinzas|atizador|utensilios)\b/],
  ["meat", /\b(carne|carnes|chorizo|chorizos|achuras|vacio|costilla|costillas)\b/],
  ["salt", /\b(sal|condimentos)\b/],
  ["cleaning", /\b(diario|diarios|limpiar|limpieza|cepillo)\b/],
  ["speaker", /\b(parlante|parlantes|musica)\b/],
  ["drinks", /\b(bebidas|gaseosa|gaseosas|agua|cerveza|cervezas)\b/],
  ["cake", /\b(torta|tortas|pastel)\b/],
  ["candles", /\b(vela|velas|velitas)\b/],
  ["tableware", /\b(platos|vasos|cubiertos|vajilla)\b/],
  ["napkins", /\b(servilletas|papel)\b/],
  ["trash", /\b(basura|residuos)\b/],
  ["blanket", /\b(manta|mantas|mantel|manteles)\b/],
  ["games", /\b(juegos|cartas|pelota)\b/],
  ["snacks", /\b(snacks|picada|pan|panes|sandwiches)\b/],
] as const;
export function checklistKind(label: string) {
  const normalized = normalizeChecklistLabel(label);
  return kinds.find(([, pattern]) => pattern.test(normalized))?.[0] ?? "other";
}
export const checklistTemplates = {
  asado: { name: "Asado", items: ["Carbón", "Carne", "Sal", "Herramientas para el asado", "Diario para limpiar la parrilla", "Hielo", "Bebidas", "Pan", "Platos y cubiertos", "Servilletas", "Bolsas de basura", "Parlante"] },
  cumple: { name: "Cumpleaños", items: ["Torta", "Velitas", "Bebidas", "Hielo", "Platos y cubiertos", "Servilletas", "Parlante", "Bolsas de basura"] },
  previa: { name: "Previa", items: ["Bebidas", "Hielo", "Vasos", "Picada", "Parlante", "Bolsas de basura"] },
  picnic: { name: "Picnic", items: ["Manta", "Agua", "Sándwiches", "Servilletas", "Bolsas de basura", "Juegos"] },
  general: { name: "Otra juntada", items: ["Bebidas", "Hielo", "Servilletas", "Parlante", "Bolsas de basura"] },
} as const;
export type ChecklistTemplate = keyof typeof checklistTemplates;
export function detectChecklistTemplate(title: string): ChecklistTemplate {
  const text = normalizeChecklistLabel(title);
  if (/\b(asado|asadito|parrilla|parrillada)\b/.test(text)) return "asado";
  if (/\b(cumple|cumpleanos|cumpleanitos|cumpleanios)\b/.test(text)) return "cumple";
  if (/\b(previa|previas)\b/.test(text)) return "previa";
  if (/\b(picnic|pic nic)\b/.test(text)) return "picnic";
  return "general";
}
export function missingChecklistSuggestions(template: ChecklistTemplate, labels: string[]) {
  return checklistTemplates[template].items.filter(suggestion => !labels.some(label => {
    const kind = checklistKind(suggestion);
    return normalizeChecklistLabel(suggestion) === normalizeChecklistLabel(label) || (kind !== "other" && kind === checklistKind(label));
  }));
}
