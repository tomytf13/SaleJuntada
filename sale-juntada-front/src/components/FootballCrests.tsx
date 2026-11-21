import { footballMatch } from "../utils/footballMatch";

export function FootballCrests({ title }: { title: string }) {
  const match = footballMatch(title);
  if (!match) return null;
  const [home, away] = match;
  return (
    <div className="football-crests">
      <img src={`/escudos/${home.id}.png`} alt={`Escudo de ${home.name}`} width="48" height="48" />
      <span aria-hidden="true">vs.</span>
      <img src={`/escudos/${away.id}.png`} alt={`Escudo de ${away.name}`} width="48" height="48" />
    </div>
  );
}
