/**
 * Rota los `responseToken` que todavía tengan el formato viejo de `cuid()`.
 *
 * Los participantes creados antes de P0 recibían su credencial de
 * `@default(cuid())`, que no es criptográficamente aleatorio. El schema ya
 * no genera esos tokens, pero las filas existentes conservan el suyo: este
 * script las pone al día.
 *
 * Invalida la sesión de quien tuviera un token viejo guardado en el
 * navegador; esa persona vuelve a ver el diálogo para sumarse. Es el
 * comportamiento buscado, no un efecto secundario.
 *
 *   node scripts/rotate-participant-tokens.mjs
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

/** Igual que `generateParticipantToken()` en src/participants. */
function generateParticipantToken() {
  return randomBytes(32).toString("base64url");
}

// 32 bytes en base64url son siempre 43 caracteres; un cuid v1 tiene 25 y
// arranca con "c". Cualquier token que no mida 43 es de antes de P0.
const CURRENT_TOKEN_LENGTH = 43;

async function main() {
  const participants = await prisma.participant.findMany({
    select: { id: true, responseToken: true },
  });

  const stale = participants.filter(
    (participant) => participant.responseToken.length !== CURRENT_TOKEN_LENGTH,
  );

  if (stale.length === 0) {
    console.log("Todos los tokens ya usan el formato seguro.");
    return;
  }

  for (const participant of stale) {
    await prisma.participant.update({
      where: { id: participant.id },
      data: { responseToken: generateParticipantToken() },
    });
  }

  console.log(`Tokens rotados: ${stale.length} de ${participants.length}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
