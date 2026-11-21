import { describe, expect, it } from "vitest";
import { footballMatch } from "./footballMatch";

describe("escudos en el título de una juntada", () => {
  it.each([
    ["Boca Juniors Vs Atletico Mineiro", 5, 7632],
    ["Nos juntamos a ver River vs. Boca", 16, 5],
    ["Atlético-MG contra Atlético Tucumán", 7632, 9785],
    ["Independiente Rivadavia – Racing", 9744, 15],
  ])("identifica ambos clubes en %s", (title, home, away) => {
    expect(footballMatch(title)?.map(club => club.id)).toEqual([home, away]);
  });

  it.each(["Asado en La Boca", "Boca vs Atlético", "Boca vs Boca", "River vs Boca vs Racing"])(
    "omite los escudos para %s", title => expect(footballMatch(title)).toBeNull(),
  );
});
