# P1.1 — RSVP: dominio y API

> Rama `fix/p0-security-integrity`. Primer slice de P1.
> **Sólo backend y tipos.** La UI de RSVP llega en P1.4.

---

## 1. Summary

El RSVP existe en la API. Nadie lo usa todavía desde la interfaz, y eso está bien: el slice es autocontenido y no deja el producto a medio camino.

| # | Qué se hizo |
|---|---|
| 1 | `RsvpStatus` (`GOING` / `MAYBE` / `NOT_GOING`) y tres columnas en `Participant` |
| 2 | `PUT .../participants/:participantId/rsvp`, autorizado con el `ParticipantAuthService` de P0 |
| 3 | **El RSVP sólo aplica con fecha confirmada** — regla de dominio, no de UI |
| 4 | `plusOnes` con reglas del servidor: tope, y forzado a 0 cuando la respuesta no es `GOING` |
| 5 | `rsvpSummary` con `goingHeadcount`, **sólo para participantes** |
| 6 | La vista pública **no cambió**: el test de allowlist de P0 pasa sin tocarlo |
| 7 | `rsvp:changed` en el gateway existente, sólo a la sala autenticada |
| 8 | `DRAFT` y `PROPOSED` eliminados del enum tras re-verificar que seguían muertos |
| 9 | Seed con los dos modos: una juntada con fecha y una sin |
| 10 | Tests de backend: **101 → 135** |

---

## 2. Domain rules

> **RSVP only applies when `finalizedStart` exists.**

Es la regla que ordena todo el slice.

### Por qué

Sin ella, el mismo valor cambiaría de significado con el tiempo:

```
La juntada todavía no tiene fecha
  Pedro responde GOING              ← ¿"voy" a qué?
  Pedro marca el jueves UNAVAILABLE
  El organizador elige el jueves
  → Pedro figura GOING el jueves    ← FALSO. Nunca dijo eso.
```

`GOING` antes de haber fecha significa "me interesa"; después significa "voy ese día". Guardar los dos en la misma columna hace que el dato mienta.

### Los dos estados

| `finalizedStart` | Qué significa ser `Participant` | La pregunta | RSVP |
|---|---|---|---|
| `null` | "me interesa, sumame" | *¿Cuándo podés?* | ❌ no aplica |
| una fecha | lo mismo, más una fecha concreta | *¿Venís?* | ✅ aplica |

Ser `Participant` de una juntada sin fecha **ya es** la expresión de interés: alguien abrió el link, puso su nombre y se sumó. Pedirle además que confirme algo que todavía no existe es fricción sin información.

### `rsvpStatus = null` significa dos cosas

Y el contexto alcanza para distinguirlas, sin una columna más:

| `finalizedStart` | `rsvpStatus` | Lectura |
|---|---|---|
| `null` | `null` | El RSVP **no aplica** |
| fecha | `null` | Hay fecha y **todavía no respondió** |
| fecha | `GOING` / `MAYBE` / `NOT_GOING` | Respondió |

---

## 3. Schema changes

```prisma
enum GatheringStatus {
  OPEN        // todavía busca fecha; el RSVP no aplica
  CONFIRMED   // tiene finalizedStart; recién acá existe el RSVP
  CANCELLED
}

enum RsvpStatus {
  GOING
  MAYBE
  NOT_GOING
}

model Participant {
  // ...
  rsvpStatus  RsvpStatus?
  plusOnes    Int         @default(0)
  rsvpAt      DateTime?

  @@index([gatheringId, rsvpStatus])
}
```

**Ninguna tabla nueva.** El RSVP vive en `Participant` porque una tabla `Rsvp` sería 1:1 con la misma clave y el mismo ciclo de vida, y agregaría un join en `getBySlug` — la consulta que corre en cada apertura del link. Justificación completa en [P1_CORE_SOCIAL_PLAN.md §8](P1_CORE_SOCIAL_PLAN.md).

**El índice se conserva** porque el resumen agrupa por `(gatheringId, rsvpStatus)`, que es exactamente su forma.

### Poda de `GatheringStatus`

`DRAFT` y `PROPOSED` se eliminaron. Antes de tocar nada se re-verificó que siguieran muertos:

| Dónde | Resultado |
|---|---|
| `sale-juntada-back/src` | sin apariciones |
| `sale-juntada-back/prisma/seed.ts` | sin apariciones |
| `sale-juntada-front/src` | sólo en el tipo TS, sin lógica |
| `sale-juntada-e2e/tests` | sin apariciones |
| Datos en la base dev | `OPEN=8 · CONFIRMED=1 · CANCELLED=2`, cero filas con los valores viejos |

---

## 4. Migration

`prisma/migrations/20260825060000_p1_rsvp/migration.sql`. **`0_init` quedó intacta.**

```sql
CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING');

ALTER TABLE "Participant" ADD COLUMN "rsvpStatus" "RsvpStatus";
ALTER TABLE "Participant" ADD COLUMN "plusOnes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Participant" ADD COLUMN "rsvpAt" TIMESTAMP(3);

CREATE INDEX "Participant_gatheringId_rsvpStatus_idx"
ON "Participant"("gatheringId", "rsvpStatus");

-- Recreación del enum: Postgres no permite quitar valores.
ALTER TABLE "Gathering" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "GatheringStatus" RENAME TO "GatheringStatus_old";
CREATE TYPE "GatheringStatus" AS ENUM ('OPEN', 'CONFIRMED', 'CANCELLED');
ALTER TABLE "Gathering" ALTER COLUMN "status" TYPE "GatheringStatus"
  USING ("status"::text::"GatheringStatus");
ALTER TABLE "Gathering" ALTER COLUMN "status" SET DEFAULT 'OPEN';
DROP TYPE "GatheringStatus_old";
```

### Sin backfill a `GOING`

El plan original ponía a todos los organizadores en `GOING`. **Se eliminó.** Bajo la regla nueva el RSVP sólo aplica con fecha confirmada, así que marcar organizadores de juntadas `OPEN` inventaría respuestas a una pregunta que todavía no se hizo.

Estado inicial = el de los defaults: `null` / `0` / `null`. Los ejemplos explícitos los crea el seed.

El `USING` falla ruidosamente si quedara alguna fila con los valores viejos, que es el comportamiento buscado: mejor un error que una conversión silenciosa.

---

## 5. RSVP authorization

**No se implementó autorización nueva.** Todo pasa por el `ParticipantAuthService` de P0:

```ts
await this.participantAuth.requireActiveParticipant(
  gatheringId, participantId, participantToken,
  "No podés responder por otra persona",
);
```

Eso cubre, en una sola llamada: que el participante exista, que pertenezca a esa juntada, que el token sea suyo (comparado en tiempo constante) y que la juntada no esté cancelada.

| Situación | Respuesta |
|---|---|
| Sin token | `401` |
| Token de otra persona | `401` |
| Participante de otra juntada | `404` — no se filtra que exista en otro lado |
| Juntada cancelada | `409` |
| Sin fecha confirmada | `409` |

---

## 6. RSVP lifecycle

### Implementado en P1.1

Sólo lo mínimo para que el endpoint respete el estado actual:

- Rechaza responder si `finalizedStart === null`
- Rechaza responder si la juntada está cancelada
- Cada mutación válida sella `rsvpAt = now()`

### Diferido a P1.2 — definido, no implementado

Una confirmación de asistencia pertenece a **una fecha concreta**. Si la fecha cambia, la respuesta anterior deja de ser confiable:

| Transición | Organizador | Resto |
|---|---|---|
| Crear con fecha | `GOING` | — |
| Crear sin fecha | `null` | `null` |
| `finalizeGathering()` | pasa a `GOING` | reset a `null` / `0` / `null` |
| Cambia una fecha confirmada | sigue `GOING` | **reset** |
| Se reabre la encuesta | **reset** | **reset** |

**Nada de esto está implementado todavía.** Hoy `finalizeGathering` y `updateGathering` no tocan el RSVP.

⚠️ **Consecuencia conocida:** si una juntada se confirma y después se le cambia la fecha, las respuestas viejas quedan como si correspondieran a la fecha nueva. Es exactamente el problema que P1.2 tiene que cerrar; se documenta para que no se olvide.

---

## 7. plusOnes

**Tope: 10** ([`MAX_PLUS_ONES`](../sale-juntada-back/src/gatherings/dto/set-rsvp.dto.ts)).

Alcanza de sobra para "voy con la familia" y evita que una sola respuesta infle el headcount a cualquier número. Quien traiga más gente que eso conviene que la sume como participante: así cada uno responde por sí mismo y las cuentas de P3 no dependen de un entero suelto.

**Reglas del servidor** (ninguna se delega al cliente):

```ts
const plusOnes = dto.status === RsvpStatus.GOING ? (dto.plusOnes ?? 0) : 0;
```

- `status !== GOING` → `plusOnes = 0`. Quien no va no lleva a nadie.
- Fuera de `0..10` → `400`, con mensaje que explica qué hacer.
- Decimales → `400`.

**No crean `Participant`.** Un +1 es un número en la fila de quien lo trae. No ocupa lugar contra `MAX_PARTICIPANTS`, no tiene token y no puede responder.

⚠️ **Deuda deliberada:** los `plusOnes` cuentan para la asistencia pero **no** para la división de gastos. P3 decide qué hacer.

---

## 8. rsvpSummary

```ts
{
  going: number;           // participantes con GOING
  maybe: number;
  notGoing: number;
  pending: number;         // rsvpStatus === null
  goingHeadcount: number;  // suma de (1 + plusOnes) entre los GOING
}
```

```
Tomy  GOING +0
Mica  GOING +1
Fede  GOING +2

going = 3          ← cuántos respondieron que van
goingHeadcount = 6 ← cuánta gente va a haber
```

Permite mostrar **"3 confirmados · 6 personas"** cuando aporta.

### Dos caminos, una sola definición

`summarizeRsvp(participants)` es una función pura, fuera de la clase. La usan:

- `RsvpService.getSummary(gatheringId)` — consulta la base; para cuando no se tienen los participantes a mano
- `GatheringsService.getBySlug()` — sobre los participantes **ya cargados**, sin volver a consultar

Una sola definición de cómo se cuenta, sin una query extra en el camino crítico.

---

## 9. Public/private projection

### La vista pública no cambió

Ni un campo nuevo. Cómo respondió el grupo es información del grupo, no del link.

**El test de allowlist de P0 pasa sin modificarse** — es la comprobación de que el RSVP no se filtró. Además se agregaron dos tests explícitos:

- la respuesta pública no tiene `rsvpSummary` ni `goingHeadcount`
- la respuesta pública no contiene `rsvpStatus`, `plusOnes` ni la cadena `GOING`

Se evaluó publicar `respondedCount` (cuántos contestaron, sin decir qué) y se descartó: no hace falta para ninguna pantalla del plan, y todo campo público es una decisión que después cuesta revertir.

### La vista de participante

Suma `rsvpSummary` y, dentro de cada `participants[]`, `rsvpStatus`, `plusOnes` y `rsvpAt`.

La proyección se sigue armando con **lista blanca explícita**: los campos privados se nombran uno por uno en la rama del participante, así que un campo nuevo en `Gathering` no se filtra solo.

---

## 10. Realtime

Un método más en el gateway de P0, siguiendo el patrón de `expensesChanged` / `purchaseChanged`:

```ts
rsvpChanged(gatheringId, { participantId, participantName, rsvpStatus, plusOnes })
  → emite "rsvp:changed" a la sala `gathering:<id>`
```

**Sin infraestructura nueva.** Sin cambios en presencia, typing ni el `Map` en memoria.

**La autorización ya estaba resuelta:** P0 dejó `gathering:watch` exigiendo credencial válida, así que sólo los participantes reciben el evento.

⚠️ **Consecuencia correcta:** alguien con el link que todavía no se sumó **no** ve las respuestas llegar en vivo — no tiene socket. Es la decisión de P0 y se conserva.

**Payload mínimo:** lo justo para que la UI actualice sin recargar. El resumen completo lo trae `getBySlug`. Hay un test que verifica que no viaja nada sensible.

---

## 11. Tests

**Backend: 101 → 135** (14 suites).

| Archivo | Tests | Cubre |
|---|---|---|
| `rsvp/rsvp.service.spec.ts` | 20 | Camino feliz · cambiar respuesta · `rsvpAt` en cada mutación · idempotencia · `plusOnes` guardado con `GOING` · forzado a 0 con `MAYBE` y `NOT_GOING` · **rechazo sin fecha confirmada** · aceptación en cuanto hay fecha · rechazo en cancelada · sin token · token ajeno · participante de otra juntada · los cinco contadores del resumen |
| `gatherings/dto/set-rsvp.dto.spec.ts` | 8 | Los tres estados válidos · enum inválido · estado faltante · rango de `plusOnes` · negativo · excesivo · decimal · omitido |
| `gatherings/gathering-visibility.spec.ts` | 14 → 18 | **La pública no expone `rsvpSummary` ni respuestas individuales** · la privada sí, con `goingHeadcount` correcto |
| `gatherings/gatherings.gateway.spec.ts` | 8 → 10 | `rsvp:changed` emite sólo a la sala · el payload no lleva nada sensible |

**Frontend: 22** (9 archivos) — sin cambios; en P1.1 no hay UI.
**E2E: 6 en verde**, 1 salteado (`E2E_REAL_DB=1`). El E2E estrella espera a que exista la UI (P1.4).

### Empty rebuild

`scripts/verify-empty-rebuild.sh` sobre un cluster PostgreSQL 17.6 **temporal y vacío** (no se usó Supabase). Los 10 pasos en verde con **las dos migraciones**:

```
1/10 migrations   → 0_init + 20260825060000_p1_rsvp
2/10 seed         → /j/asado-demo-tucuman · /j/previa-sin-fecha
3/10 generate     ✅   4/10 back lint ✅   5/10 back tests ✅ 135
6/10 back build   ✅   7/10 front lint ✅  8/10 front tests ✅ 22
9/10 front build  ✅   10/10 e2e ✅ 6 passed

EMPTY DATABASE -> WORKING SALE JUNTADA: OK
```

Estado de la base reconstruida:

```
GatheringStatus = OPEN,CONFIRMED,CANCELLED
RsvpStatus      = GOING,MAYBE,NOT_GOING
asado-demo-tucuman  → GOING 2 (headcount 3) · MAYBE 1 · NOT_GOING 1 · pending 1
previa-sin-fecha    → 3/3 en null
migraciones         → 0_init | 20260825060000_p1_rsvp
```

---

## 12. Deferred to P1.2

- `startsAt` en la creación y modo de fecha fija
- **`windowStart`/`windowEnd` elegidos por el creador** — sin default silencioso de +14 días
- **`finalizedEnd` no se inventa** desde `durationMinutes`; si no se indicó hora de fin, va `null`
  - ⚠️ revisar antes si algún consumidor asume que no es nulo cuando `status = CONFIRMED`
- DTO de creación relajado: sólo `title` y `organizerName` obligatorios
- `finalizeGathering` habilita el RSVP: organizador → `GOING`, resto → reset
- Cambiar una fecha confirmada resetea el RSVP del resto
- Reabrir la encuesta resetea el RSVP de todos

## 13. Deferred to P1.4

- `RsvpSelector` con los tres botones, sin depender del color
- `PlusOnesStepper` revelado después de `GOING`
- `AttendanceSummary`
- Hooks de React Query (`useGathering`, `useRsvp`) con update optimista
- Handler de `rsvp:changed` en el frontend
- E2E estrella: organizador crea → invitado abre sin sesión → se suma → dice Voy → el organizador ve el número subir

---

## Decisiones que conviene revisar

1. **`RsvpService` como módulo propio** en vez de sumar métodos a `GatheringsService`. Se justificó por tener regla de dominio propia y **dos** llamadores (el controller para mutar, `GatheringsService` para el resumen), siguiendo el precedente de `ParticipantAuthService`. Si se prefiere, cabe dentro de `GatheringsService` sin perder nada.
2. **`MAX_PLUS_ONES = 10`.** Elegido por criterio, no por dato. Fácil de mover.
3. **El RSVP no se resetea todavía** al cambiar de fecha. Es la deuda más importante que deja este slice y es la primera tarea de P1.2.
4. **`respondedCount` público quedó descartado**, no diferido. Si aparece una necesidad concreta, se reabre.
