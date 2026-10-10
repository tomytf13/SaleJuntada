import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Bytes de entropía del token de participante. 32 bytes (256 bits) es el
 * tamaño habitual de un secreto bearer y deja el espacio de búsqueda fuera
 * del alcance de cualquier ataque por fuerza bruta.
 */
export const PARTICIPANT_TOKEN_BYTES = 32;

/** Longitud del token ya codificado en base64url, sin padding. */
export const PARTICIPANT_TOKEN_LENGTH = 43;

/**
 * Genera la credencial de un participante.
 *
 * Es el único lugar del proyecto que produce estos tokens. Antes el valor
 * salía de `@default(cuid())` en Prisma: cuid v1 se arma con timestamp,
 * contador, fingerprint de la máquina y unos pocos bytes derivados de
 * `Math.random()`, y está documentado como no apto para secretos. Ese token
 * autoriza cargar y borrar gastos, confirmar transferencias y cerrar la
 * juntada, así que tiene que venir de un generador criptográfico.
 */
export function generateParticipantToken(): string {
  return randomBytes(PARTICIPANT_TOKEN_BYTES).toString("base64url");
}

/**
 * Compara un token recibido contra el almacenado en tiempo constante.
 *
 * `===` corta en el primer carácter distinto, y esa diferencia de tiempo es
 * medible: filtra cuántos caracteres del prefijo acertó quien prueba.
 */
export function participantTokenMatches(
  provided: string | undefined,
  stored: string,
): boolean {
  if (!provided) return false;

  const providedBuffer = Buffer.from(provided, "utf8");
  const storedBuffer = Buffer.from(stored, "utf8");
  // timingSafeEqual exige la misma longitud; comparar los largos por
  // separado no filtra nada útil porque el largo del token es público.
  if (providedBuffer.length !== storedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, storedBuffer);
}
