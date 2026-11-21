type Club = { id: number; name: string; aliases?: string[] };

// Los identificadores coinciden con el catálogo de equipos de ESPN.
const clubs: Club[] = [
  { id: 5, name: "Boca Juniors", aliases: ["Boca"] },
  { id: 16, name: "River Plate", aliases: ["River"] },
  { id: 7632, name: "Atlético Mineiro", aliases: ["Atlético-MG", "Mineiro"] },
  { id: 9785, name: "Atlético Tucumán" },
  { id: 11, name: "Independiente" },
  { id: 9744, name: "Independiente Rivadavia" },
  { id: 15, name: "Racing Club", aliases: ["Racing"] },
  { id: 18, name: "San Lorenzo" },
  { id: 17, name: "Rosario Central" },
  { id: 14, name: "Newell's Old Boys", aliases: ["Newells", "Newell's"] },
  { id: 21, name: "Vélez Sarsfield", aliases: ["Vélez"] },
  { id: 819, name: "Flamengo" },
  { id: 2029, name: "Palmeiras" },
  { id: 874, name: "Corinthians" },
  { id: 2022, name: "Cruzeiro" },
];

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const byName = new Map(clubs.flatMap(club =>
  [club.name, ...(club.aliases ?? [])].map(name => [normalize(name), club] as const),
));

export function footballMatch(title: string): [Club, Club] | null {
  const fixture = normalize(title).replace(/^.*\b(?:ver (?:el partido (?:de|entre) )?|partido:\s*)/, "");
  const sides = fixture.split(/\s+(?:vs\.?|versus|contra|[-–—])\s+/);
  if (sides.length !== 2) return null;
  const home = byName.get(sides[0]);
  const away = byName.get(sides[1]);
  return home && away && home !== away ? [home, away] : null;
}
