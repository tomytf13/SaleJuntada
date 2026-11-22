import pngjs from "pngjs";
import { footballMatch } from "../src/utils/footballMatch.js";
const { PNG } = pngjs;
const site = "https://salejuntada.com.ar";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
type Response = {
  setHeader(k: string, v: string): void;
  status(n: number): Response;
  send(body: string | Buffer): void;
  redirect(code: number, url: string): void;
};

async function crestCard(ids: number[]) {
  const card = new PNG({ width: 800, height: 420 });
  for (let i = 0; i < card.data.length; i += 4)
    card.data.writeUInt32BE(0xfff7e7ff, i);
  const badges = await Promise.all(
    ids.map(async (id) => {
      const response = await fetch(site + "/escudos/" + id + ".png", {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error("Escudo no disponible");
      return PNG.sync.read(Buffer.from(await response.arrayBuffer()));
    }),
  );
  badges.forEach((badge, side) => {
    const scale = 240 / Math.max(badge.width, badge.height);
    for (let y = 0; y < Math.floor(badge.height * scale); y++) {
      for (let x = 0; x < Math.floor(badge.width * scale); x++) {
        const src =
          (Math.floor(y / scale) * badge.width + Math.floor(x / scale)) * 4;
        const dst =
          ((Math.floor((420 - badge.height * scale) / 2) + y) * 800 +
            side * 400 +
            Math.floor((400 - badge.width * scale) / 2) +
            x) *
          4;
        const alpha = badge.data[src + 3] / 255;
        for (let c = 0; c < 3; c++)
          card.data[dst + c] = Math.round(
            badge.data[src + c] * alpha + card.data[dst + c] * (1 - alpha),
          );
      }
    }
  });
  return PNG.sync.write(card);
}

export default async function invite(
  req: { query: Record<string, unknown> },
  res: Response,
) {
  const { slug, image } = req.query;
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,220}$/i.test(slug))
    return res.status(404).send("");
  const url = site + "/j/" + slug;
  const api =
    process.env.VITE_API_URL ?? "https://sale-juntada-api-tomytf13.fly.dev/api";
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  try {
    const response = await fetch(api + "/gatherings/" + slug, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return res.status(response.status).send("");
    const { title, status, finalizedStart, timeZone } = await response.json();
    const match = footballMatch(title);
    if (image) {
      if (!match) return res.redirect(302, site + "/og.png");
      const card = await crestCard(match.map((club) => club.id));
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, s-maxage=300");
      return res.send(card);
    }
    const detail =
      status === "CANCELLED"
        ? "Juntada cancelada"
        : finalizedStart
          ? new Intl.DateTimeFormat("es-AR", {
              dateStyle: "medium",
              timeStyle: "short",
              hourCycle: "h23",
              timeZone,
            }).format(new Date(finalizedStart))
          : "¿Cuándo podés?";
    const headline = escape(title + " · " + detail);
    const description =
      status === "CANCELLED"
        ? "Esta juntada se canceló."
        : finalizedStart
          ? "Entrá para confirmar si vas."
          : "Elegí los horarios que te quedan bien.";
    const picture = match
      ? site + "/api/invite?image=1&amp;slug=" + slug
      : site + "/og.png";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60");
    res.send(
      `<!doctype html><html lang="es-AR"><head><title>${headline}</title><meta property="og:site_name" content="Sale Juntada"><meta property="og:type" content="website"><meta property="og:title" content="${headline}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url}"><meta property="og:image" content="${picture}"><meta name="twitter:card" content="summary_large_image"></head><body><a href="${url}">Abrir invitación</a></body></html>`,
    );
  } catch {
    if (image) return res.redirect(302, site + "/og.png");
    res.status(503).send("Invitación temporalmente no disponible.");
  }
}
