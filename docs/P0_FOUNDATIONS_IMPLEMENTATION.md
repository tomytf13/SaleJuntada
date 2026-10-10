# P0 — Foundations: implementación

> Rama `fix/p0-security-integrity`, sobre `39d8dac`.
> Fase de seguridad, integridad financiera y limpieza. **No incluye funcionalidad P1+.**

---

## 1. Summary

P0 cierra los cuatro riesgos que la auditoría marcó como bloqueantes, limpia el código legacy que ya no tenía llamadores y deja CI corriendo. No agrega ni una funcionalidad de producto.

| # | Qué se hizo |
|---|---|
| 1 | `responseToken` pasó de `cuid()` a `randomBytes(32)` en base64url, generado por un único helper |
| 2 | Coincidencias, plan de compra y liquidación dejaron de ser públicos |
| 3 | `GET /gatherings/:slug` devuelve dos proyecciones según haya credencial o no |
| 4 | Las coordenadas exactas salieron de la respuesta pública |
| 5 | `gathering:watch` de Socket.IO exige la misma credencial que la API |
| 6 | Los gastos son idempotentes, garantizado por un índice único |
| 7 | La validación de la ventana de fechas se centralizó y ahora `create` también la aplica |
| 8 | Rate limits específicos en crear juntada, sumarse y geocoding |
| 9 | La caché de direcciones tiene TTL y tope de entradas |
| 10 | Se eliminaron `Proposal`, la auth legacy de Google y `legacyPurchaseKeys` |
| 11 | CI con tres jobs: backend, frontend y E2E |
| 12 | Tests: de 37 a 94 en backend |

**Estado final:** lint, tests y build en verde en backend y frontend; 6 tests E2E en verde.

---

## 2. Development assumptions

```
No production data existed during P0.
Database resets were allowed.
```

El usuario confirmó explícitamente que los registros de Supabase (11 juntadas, 21 participantes, 18 gastos) eran **datos ficticios de desarrollo**, sin clientes, usuarios ni dinero real. Esto habilitó invalidar todos los `responseToken` y crear migraciones destructivas.

**No se construyó** compatibilidad hacia atrás con esos registros: ni tokens legacy, ni doble sistema de tokens, ni fallbacks.

**Nota sobre el reset:** aunque estaba autorizado, la migración terminó **no necesitándolo**. Se escribió con backfill (§3) y aplicó limpio sobre la base poblada, conservando los datos. El único comando destructivo que sí se ejecutó fue la rotación de tokens.

---

## 3. Database changes

> **Actualizado en el final review.** El historial se squasheó a un único baseline `0_init`. Lo que sigue describe qué cambió en el modelo durante P0; el detalle del squash está en §3bis.

Migración original: `20260825030000_p0_foundations` (hoy absorbida en `0_init`).

### Agregado

```prisma
model Expense {
  idempotencyKey String   // NOT NULL, obligatorio
  @@unique([gatheringId, idempotencyKey])
}
```

Se agregó en tres pasos para que aplicara también sobre la tabla ya poblada:

```sql
ALTER TABLE "Expense" ADD COLUMN "idempotencyKey" TEXT;
UPDATE "Expense" SET "idempotencyKey" = 'backfill:' || "id" WHERE "idempotencyKey" IS NULL;
ALTER TABLE "Expense" ALTER COLUMN "idempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX "Expense_gatheringId_idempotencyKey_key" ON "Expense"("gatheringId", "idempotencyKey");
```

**Por qué obligatorio y no opcional:** una columna opcional deja abierto el camino de "el cliente se olvidó de mandar la clave" y la protección se pierde en silencio. Un 400 ruidoso es preferible a un gasto duplicado.

**Sobre `UNIQUE` y `NULL`:** en Postgres los `NULL` se consideran distintos entre sí, así que un índice único sobre una columna opcional **no** habría impedido múltiples filas sin clave. Con `NOT NULL` esa ambigüedad no existe.

### Modificado

```prisma
model Participant {
  responseToken String @unique   // ← sin @default(cuid())
}
```

No generó SQL: `@default(cuid())` era un default de Prisma resuelto en el cliente, nunca un `DEFAULT` de Postgres. Quitarlo del schema obliga a que la aplicación provea el valor.

### Eliminado

```sql
DROP INDEX "Participant_gatheringId_googleSubject_key";
ALTER TABLE "Participant" DROP COLUMN "googleSubject";
ALTER TABLE "Proposal" DROP CONSTRAINT "Proposal_gatheringId_fkey";
DROP TABLE "Proposal";
DROP TYPE "ProposalStatus";
```

### Migración histórica corregida

`20260815055000_restrict_rls_auto_enable` hacía `REVOKE` directo sobre `public.rls_auto_enable()`, una función que **crea Supabase**, no esta aplicación. Fallaba con *"function does not exist"* en cualquier base que no fuera un proyecto Supabase: la shadow database de `prisma migrate dev`, una Postgres local o el CI.

Es decir: **el historial no se podía reconstruir desde cero.** Ahora el `REVOKE` está envuelto en un `DO $$ ... IF EXISTS ... $$`, y `migrate reset` funciona en cualquier entorno.

### Decisión revisada: `REBASELINE` — squash a `0_init`

La primera versión de este documento eligió `KEEP MIGRATION HISTORY`. **Esa decisión era incoherente** con haber modificado una migración ya aplicada, y se revirtió en el final review.

Ver §3bis.

---

## 3bis. Migration rebaseline

### CURRENT (antes del final review)

19 migraciones incrementales. La #12, `restrict_rls_auto_enable`, hacía `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()`. Durante P0 se la envolvió en `IF EXISTS` para que no fallara fuera de Supabase, lo que cambió su checksum.

### PROBLEM

Modificar una migración aplicada y a la vez declarar `KEEP MIGRATION HISTORY` son decisiones incompatibles. Y el problema de fondo era peor que el checksum:

1. **Dependencia de estado creado por Supabase.** El `IF EXISTS` no arreglaba la reconstrucción: la hacía *pasar por al lado*. Fuera de Supabase el `REVOKE` simplemente no se ejecutaba.
2. **Segunda dependencia oculta, encontrada durante el squash.** Cuatro migraciones hacían `REVOKE ALL ... FROM anon, authenticated`. Esos roles **también los crea Supabase**. Contra una Postgres común el historial fallaba con `role "anon" does not exist`. Nadie lo había notado porque nunca se había reconstruido desde cero.
3. **Ruido acumulado del prototipado:** `Proposal` se creaba en la #1 y se destruía en la #19; dos `UPDATE` de backfill sobre filas que en una base nueva no existen; un `DO $$` que buscaba y dropeaba un índice con nombre truncado a 63 caracteres, índice que en una base nueva nunca se crea.
4. **Endurecimiento inconsistente:** las 11 tablas tenían RLS, pero sólo 4 tenían `REVOKE`.

### PROPOSED

Un único baseline `0_init`, generado con el workflow de Prisma 6:

```bash
prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

más el SQL que Prisma no deriva del schema. **En ningún momento se usó `db push`.**

Las bases que ya tenían el historial viejo se reconcilian con `prisma migrate resolve --applied 0_init`, que es no destructivo.

### WHY SAFE PRE-LAUNCH

No hay datos productivos. La única base con el historial aplicado es la de desarrollo, cuyo schema **ya coincidía exactamente** con el baseline (verificado con `migrate diff`: *"This is an empty migration"*). Después del lanzamiento esto sería inaceptable; antes, es gratis y deja el historial limpio para siempre.

### Custom SQL: qué se preservó y qué se descartó

| SQL | Origen | Decisión |
|---|---|---|
| `ENABLE ROW LEVEL SECURITY` × 11 tablas | 5 migraciones | **Preservado y normalizado** a las 11 |
| `REVOKE ALL ... FROM anon, authenticated` | 4 tablas | **Preservado y extendido** a las 11 |
| Creación de roles `anon` / `authenticated` | — | **Agregado**: sin esto el `REVOKE` no corre fuera de Supabase |
| Catálogo: 43 productos + 84 presentaciones | `20260815193000` | **Preservado íntegro** — lo sirve `GET /catalog/purchase` |
| Índices y constraints | todas | **Preservado** (los deriva Prisma del schema) |
| `REVOKE ... rls_auto_enable()` | `20260815055000` | **Descartado** — dependencia de Supabase |
| `UPDATE "TransferConfirmation"` backfill | `20260816193000` | **Descartado** — no hay filas en base nueva |
| `UPDATE "Expense"` backfill | `20260825030000` | **Descartado** — ídem |
| `DO $$` del índice truncado | `20260816193000` | **Descartado** — ese índice no existe en base nueva |
| `CREATE TABLE "Proposal"` + `DROP` | #1 y #19 | **Descartado** — se anulaban entre sí |

Sobre los roles, el baseline ahora hace:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  ...
END $$;
```

Se eligió **crear los roles** en vez de guardar el `REVOKE` tras un `IF EXISTS`. La diferencia importa: con `IF EXISTS`, el endurecimiento se saltea en silencio donde los roles no existen y los entornos divergen. Creándolos, la postura de seguridad es idéntica en Supabase, en local y en CI.

### Resultado

```
prisma/migrations/
├── 0_init/migration.sql   (484 líneas)
└── migration_lock.toml
```

---

### Decisión: `currency` diferido a P3

Se evaluó agregar `Expense.currency @default("ARS")` ahora. Se difirió: no hay conversión, ni multi-moneda, ni selector, ni un solo monto que no sea ARS. Agregar una columna que nadie lee es exactamente lo que YAGNI desaconseja. Cuando P3 traiga `ExpenseSplit`, la moneda entra en la misma migración.

---

## 4. Security model

Tres niveles:

| Nivel | Credencial | Quién es |
|---|---|---|
| **PUBLIC** | ninguna | Cualquiera con el link. Ve lo justo para decidir si se suma |
| **PARTICIPANT** | `x-participant-token` válido para esa juntada | Alguien del grupo |
| **ORGANIZER** | `x-participant-token` + `isOrganizer` en la base | Quien creó la juntada |

Existe además un eje ortogonal: **cuenta Supabase** (`Authorization: Bearer <JWT>`), que no reemplaza al token de participante. Sirve para el historial propio (`/users/me/*`) y para vincular participaciones a una identidad persistente.

### Qué es público y qué no

> **Corregido en el final review.** La primera versión dejaba nombres y avatares públicos como "prueba social". Se revirtió: quien sólo conoce el slug **no obtiene ninguna identidad**.

La vista pública se arma con **lista blanca explícita**, no quitando campos del objeto completo. Es a propósito: si mañana `Gathering` suma una columna, no se filtra sola por haberse olvidado de excluirla. Hay un test que compara el conjunto exacto de claves y falla ante cualquier campo nuevo.

**PUBLIC en `GET /gatherings/:slug` — 22 campos, ninguna identidad:**

| Campo | |
|---|---|
| `id`, `slug` | necesarios para sumarse |
| `title`, `description` | qué es |
| `windowStart`, `windowEnd`, `durationMinutes` | cuándo |
| `dailyStartMinutes`, `dailyEndMinutes`, `slotStepMinutes`, `slots` | horarios ofrecidos |
| `timeZone` | zona |
| `locationHint` | referencia aproximada (*"Yerba Buena"*) |
| `status`, `finalizedStart`, `finalizedEnd`, `finalizedLocation` | estado |
| `participantCount` | **cuántos**, nunca quiénes |
| `participants: []` | vacío, no reducido |
| `locationLatitude: null`, `locationLongitude: null` | siempre nulos acá |
| `isParticipant: false`, `viewerParticipantId: null` | discriminante |

**PRIVATE, sólo con token válido:**

- `participants[]` con nombre, avatar, `isOrganizer`, `availabilities`, `dietaryPreferences`, `mealArrangement`, `expensesReadyAt`
- `organizerName` — está desnormalizado en `Gathering`, pero sigue siendo la identidad de una persona
- `locationLatitude` / `locationLongitude` — la casa de alguien
- `expenseRound`, `createdAt`, `updatedAt`
- todo lo financiero: gastos, balances, liquidación, transferencias, alias de pago
- el plan de compra y las coincidencias de horario (endpoints aparte, con `ParticipantGuard`)

**Nunca, para nadie:** el `responseToken` de otra persona. En `getBySlug` el viewer se resuelve con una consulta aparte, justamente para que los tokens del resto del grupo no entren en el objeto que después se serializa. Hay tests que lo verifican en las dos vistas.

`isParticipant` es un literal (`true as const` / `false as const`), así que la unión es discriminable: quien consume la respuesta tiene que decidir en qué caso está antes de tocar un campo privado, y TypeScript se lo exige.

### Autorización de organizador

Se resuelve **siempre contra la base**. El `isOrganizer` que llegue del cliente no se mira nunca. Endpoints que exigen organizador: finalizar, editar y cancelar la juntada, y editar el plan de compra.

---

## 5. Participant token

**Generación** — [participant-token.ts](../sale-juntada-back/src/participants/participant-token.ts):

```ts
randomBytes(32).toString("base64url")   // 43 caracteres
```

Un único helper, `generateParticipantToken()`. No hay `randomBytes` suelto en ningún servicio.

**Por qué cambió:** `cuid()` (v1, el que genera Prisma) se arma con timestamp, contador incremental, fingerprint de la máquina y unos pocos bytes derivados de `Math.random()`. Está documentado como no apto para secretos. Ese token autoriza cargar y borrar gastos, confirmar transferencias y cerrar la juntada.

**Almacenamiento:** columna `responseToken @unique`. Del lado del cliente, en `localStorage` bajo `sale-juntada:participant:<slug>`.

**Validación:** `participantTokenMatches()` compara en **tiempo constante** con `timingSafeEqual`. `===` corta en el primer carácter distinto y esa diferencia es medible: filtra cuántos caracteres del prefijo acertó quien prueba. Las longitudes se comparan antes, porque `timingSafeEqual` lanza si difieren y el largo del token es público de todos modos.

**Nunca se loguea.**

**Rotación de los existentes:** los 21 participantes previos tenían tokens `cuid()`. Se rotaron con [rotate-participant-tokens.mjs](../sale-juntada-back/scripts/rotate-participant-tokens.mjs), que detecta el formato viejo por longitud (43 vs 25) y regenera. Eso invalidó las sesiones guardadas en navegadores: quien tuviera una vuelve a ver el diálogo para sumarse. Es el comportamiento buscado.

---

## 6. Endpoint authorization matrix

`P` = público · `PA` = participante · `OR` = organizador · `JWT` = cuenta Supabase

### Gatherings

| Método | Ruta | Nivel | Notas |
|---|---|---|---|
| POST | `/gatherings` | P | `@Throttle` 10/min. JWT opcional (duplicar juntada lo exige) |
| GET | `/gatherings/:slug` | **P / PA** | Doble proyección según `x-participant-token` |
| GET | `/gatherings/catalog/purchase` | P | Catálogo estático, sin datos de personas |
| POST | `/:gatheringId/participants` | P | `@Throttle` 10/min. Sumarse sin cuenta es el punto del link |
| POST | `/:gatheringId/participants/auth` | JWT | |
| POST | `/:gatheringId/participants/:participantId/auth-link` | PA + JWT | Exige **ambas** credenciales |
| PUT | `/:gatheringId/participants/:participantId/availability` | PA | |
| GET | `/:gatheringId/matches` | **PA** | 🔒 antes era público — `ParticipantGuard` |
| PUT | `/:gatheringId/participants/:participantId/finalization` | **OR** | |
| PATCH | `/:gatheringId/participants/:participantId/settings` | **OR** | |
| DELETE | `/:gatheringId/participants/:participantId/settings` | **OR** | Cancelar |
| PUT | `/:gatheringId/participants/:participantId/dietary-profile` | PA | |
| GET | `/:gatheringId/participants/:participantId/payment-details` | PA | Sólo los propios |
| PUT | `/:gatheringId/participants/:participantId/payment-alias` | PA | JWT opcional: propaga el alias al perfil |
| GET | `/:gatheringId/purchase` | **PA** | 🔒 antes era público — `ParticipantGuard` |
| PUT | `/:gatheringId/participants/:participantId/purchase` | **OR** | |
| PUT | `.../purchase/items/:itemKey/responsibility` | PA | |
| PUT | `.../purchase/items/:itemKey/contribution` | PA | |
| PATCH | `.../purchase/contributions/:contributionId/status` | PA | Propio, u organizador |
| DELETE | `.../purchase/contributions/:contributionId` | PA | Propio, u organizador |
| POST | `/:gatheringId/participants/:participantId/expenses` | PA | Exige `Idempotency-Key` |
| PATCH | `.../expenses/:expenseId` | PA | Quien pagó, u organizador |
| DELETE | `.../expenses/:expenseId` | PA | Quien pagó, u organizador |
| GET | `/:gatheringId/expenses/settlement` | **PA** | 🔒 antes era público — `ParticipantGuard` |
| POST | `.../expenses/ready` | PA | |
| POST | `.../transfers/confirm` | PA | |

### Users · Locations · Health

| Método | Ruta | Nivel | Notas |
|---|---|---|---|
| GET | `/users/me/gatherings` | JWT | |
| DELETE | `/users/me/gatherings/:gatheringId` | JWT | Verifica organizador en el `where` |
| GET | `/locations/search` | P | `@Throttle` 20/min |
| GET | `/health` | P | |

### Dónde vive la decisión

Toda comparación de token pasa por [`ParticipantAuthService`](../sale-juntada-back/src/participants/participant-auth.service.ts). Antes estaba copiada en más de veinte métodos de `GatheringsService` y otra vez, distinta, en el gateway de Socket.IO.

- `requireParticipant()` — token válido para ese participante
- `requireActiveParticipant()` — además, juntada no cancelada
- `requireOrganizer()` — además, `isOrganizer` leído de la base
- `findByToken()` — resuelve el participante sin conocer su id; devuelve `null` en vez de lanzar

[`ParticipantGuard`](../sale-juntada-back/src/participants/participant.guard.ts) envuelve `findByToken()` para los tres endpoints de sólo lectura que comparten forma (`:gatheringId` en la ruta, token en la cabecera, sin `participantId`).

**Se evitó** convertir los 30 endpoints a guards: habría sido un refactor grande con riesgo de regresión durante una fase de seguridad. Los que ya tenían chequeo en el servicio ahora delegan al mismo servicio compartido, que es donde importa que haya una sola definición.

---

## 7. WebSocket authorization

**Antes:** `gathering:join` validaba el token; `gathering:watch` no validaba nada. Bastaba con conocer el `gatheringId` para entrar a la sala y recibir presencia con nombres, quién estaba escribiendo un gasto y cada cambio de la compra.

**Ahora:** ambos pasan por `authorize()`, que llama al **mismo** `ParticipantAuthService` que usan los endpoints HTTP. No hay dos implementaciones que puedan divergir.

```
gathering:watch { gatheringId, participantId, participantToken }
gathering:join  { gatheringId, participantId, participantToken }
```

Si el token no resuelve a un participante de esa juntada, el socket **no se une a la sala** y no recibe nada. Si el `participantId` no coincide con el dueño del token, tampoco.

El frontend ya no abre el socket sin sesión.

**Diferencia entre los dos:** `join` además publica la presencia de esa persona; `watch` sólo escucha.

---

## 8. Expense idempotency

### Ciclo de vida

```
1. La persona toca "Agregar gasto"
   → el cliente genera crypto.randomUUID() y lo guarda en un ref
2. POST .../expenses con Idempotency-Key: <uuid>
3a. Éxito → el ref se limpia; el próximo gasto usa una clave nueva
3b. Falla de red → el ref se conserva; el reintento manda la MISMA clave
```

### Lado servidor

```
1. findUnique({ gatheringId_idempotencyKey })
   → si existe, se devuelve ese gasto. Nada se escribe.
2. $transaction:
     reopenExpenses()   ← incrementa expenseRound
     expense.create()   ← el índice único puede rechazarlo
3. Si sale P2002:
     la transacción entera hizo rollback (expenseRound incluido)
     se vuelve a buscar por clave y se devuelve el gasto ganador
```

**El paso 1 no es la garantía.** Dos requests concurrentes lo pasan los dos. La garantía es el índice único `(gatheringId, idempotencyKey)`; el paso 1 sólo evita trabajo en el caso común.

**Por qué `reopenExpenses` y `create` van juntos en la transacción:** si el índice rechaza el insert, el incremento de `expenseRound` se deshace con el rollback. Sin eso, un reintento invalidaría las transferencias ya confirmadas una segunda vez sin motivo.

### Tests

| Caso | Resultado esperado |
|---|---|
| Un request | 1 gasto |
| Misma clave, dos veces | 1 gasto, mismo id |
| Claves distintas | 2 gastos |
| Misma clave, concurrente | 1 gasto, ambos reciben el mismo id |
| Reintento | `expenseRound` incrementa **una sola vez** |
| Token de otra persona | rechazado, 0 gastos |

El doble de Prisma reproduce el índice único **y** el rollback por transacción — deshace sólo lo que escribió esa transacción, no lo que ya confirmó la otra.

---

## 9. Location privacy

**Antes:** `getBySlug` devolvía `locationLatitude` y `locationLongitude` a cualquiera con el link. Es la casa de alguien.

**Ahora:** la vista pública devuelve `locationHint` (texto libre: *"Yerba Buena"*, *"Casa de Nico"*) y las coordenadas en `null`. Un participante con token válido recibe las coordenadas exactas, que el mapa sí necesita.

Aplica **least data necessary**: para decidir si vas al asado alcanza con saber la zona.

---

## 10. Rate limiting

`ThrottlerGuard` global se conserva: **120 req / 60s**. Versión instalada: `@nestjs/throttler` **6.5.0**, cuya sintaxis es `@Throttle({ default: { limit, ttl } })` (configuración nombrada; `default` es el nombre que toma la config del `forRoot([...])`).

Límites específicos donde hay más riesgo:

| Endpoint | Límite | Por qué |
|---|---|---|
| `POST /gatherings` | 10/min | Escribe varias filas; es la operación pública más cara |
| `POST /:id/participants` | 10/min | Sin credencial por diseño; inflar el grupo cambia lo que paga cada uno |
| `GET /locations/search` | 20/min | Cada miss consume el único request/segundo de toda la app |

No se tocó el resto: los límites deben frenar el abuso, no el uso legítimo. Antes de P0 no había **ni un** `@Throttle` en el proyecto.

---

## 11. Nominatim

### La cola de 1 req/s se conserva — es política, no un cuello de botella accidental

La auditoría recomendó aumentar la concurrencia. **Esa recomendación era incorrecta** y se corrigió (ver *Post-audit corrections* en la auditoría).

La Usage Policy de la API pública de Nominatim permite **como máximo 1 request por segundo por aplicación**, no por usuario. La cola global de [locations.service.ts](../sale-juntada-back/src/locations/locations.service.ts) implementa ese cumplimiento. Subirla nos haría bloquear.

Ahora la constante está nombrada y comentada para que no se "optimice" por error:

```ts
const MIN_REQUEST_SPACING_MS = 1_100;
```

### Caché: eso sí era un problema

**Antes:** `Map` sin límite. Variar la consulta hacía crecer la memoria sin fin.

**Ahora:** TTL de 24 h + tope de 500 entradas con desalojo LRU. La lectura reinserta la clave para moverla al final del orden de iteración del `Map`, que es lo que convierte el desalojo en LRU. Sin Redis y sin librerías: unas veinte líneas.

### Autocomplete: ya cumplía, verificado

El frontend **no** busca mientras se tipea. [`LocationPicker.tsx`](../sale-juntada-front/src/components/LocationPicker.tsx) dispara la búsqueda sólo con Enter o con el botón, y exige 3 caracteres. Compatible con la política. No hizo falta cambiar nada.

### Migración futura de proveedor

Las reglas específicas de Nominatim (espaciado, `User-Agent`, `countrycodes=ar`, forma del resultado) están **todas** dentro de `LocationsService`. Ningún otro archivo del proyecto las conoce: el resto habla con `search(query) → LocationSearchResult[]`.

**No se construyó** una abstracción de providers, interfaces ni factories: hay una sola implementación. Cuando aparezca la segunda (MapTiler, Stadia, Google Places), el punto de cambio es un archivo.

---

## 12. Legacy removed

| Qué | Dónde estaba | Cómo se verificó que estaba muerto |
|---|---|---|
| `model Proposal` + `enum ProposalStatus` | `schema.prisma` | 0 filas; sin un solo `proposal.create` en el repo. Sólo se leía en `getBySlug` y se borraba en `updateGathering` |
| `proposals` en `getBySlug` | `gatherings.service.ts` | — |
| `proposal.deleteMany` | `gatherings.service.ts` | — |
| `proposals?: unknown[]` | `gatheringService.ts` (front) | — |
| `addGoogleParticipant()` | `gatherings.service.ts` | El método del cliente existía pero **sin ningún call site** |
| `POST .../participants/google` | `gatherings.controller.ts` | — |
| `GoogleParticipantDto` | `dto/google-participant.dto.ts` | Archivo eliminado |
| `Participant.googleSubject` + índice único | `schema.prisma` | — |
| `GOOGLE_CLIENT_ID` | `.env.example`, `README.md` | Sólo lo usaba el flujo anterior |
| `legacyPurchaseKeys` | `gatherings.service.ts` | `bread`, `water`, `fernet`, `wine`: existían sólo para tolerar filas viejas |
| `requireParticipant` / `requireOrganizer` / `requirePurchaseParticipant` privados | `gatherings.service.ts` | Reemplazados por `ParticipantAuthService` |

**Sobre la auth de Google:** el frontend usa Supabase Auth. Mantener dos mecanismos de autenticación en paralelo antes del lanzamiento significaba el doble de superficie de ataque por cero beneficio. La lógica de *compras* no se tocó: eso lo rediseña P2.

`GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI` y `GOOGLE_TOKEN_ENCRYPTION_KEY` también salieron del README: pertenecen a la integración con Calendar, que todavía no existe. Volverán cuando se implemente.

---

## 13. CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — corre en push a `main` y en cada pull request. **Sólo validación, no despliega.**

| Job | Pasos |
|---|---|
| **Backend** | `npm ci` → `lint` → `test` → `build` |
| **Frontend** | `npm ci` → `lint:ci` → `test` → `build` |
| **E2E** | `npm ci` (front + e2e) → `playwright install chromium` → `playwright test --project="Desktop Chrome"` |

Node 22 (el `engines` del backend pide `>=22`), caché de npm por `package-lock.json`, `actions/checkout@v4` y `actions/setup-node@v4`.

### E2E: incluido, no diferido

Se evaluó marcarlo `E2E CI DEFERRED` y **no hizo falta**. Los tests de humo interceptan la API con `page.route`, así que:

- no necesitan backend ni base de datos
- no necesitan secretos
- Playwright levanta el dev server de Vite solo
- el único test que sí depende de PostgreSQL se saltea salvo `E2E_REAL_DB=1`, que no se pasa en CI

Se corre sólo el proyecto *Desktop Chrome* para acotar el tiempo. Ante fallo se sube el `playwright-report` como artefacto.

`prisma generate` corre en el `postinstall` del backend y no necesita `DATABASE_URL`, así que el job de backend no requiere ninguna variable de entorno.

---

## 14. Tests

**Backend: 37 → 94** (12 suites)

| Archivo | Tests | Cubre |
|---|---|---|
| `participants/participant-token.spec.ts` | 10 | Formato, longitud, unicidad en 1.000 tokens, que no tenga forma de cuid, comparación en tiempo constante, prefijo correcto, largo distinto, ausencia |
| `participants/participant-auth.service.spec.ts` | 12 | Token válido, token de otro participante, token cruzado entre juntadas, ausencia de token, participante contra endpoint de organizador, juntada cancelada, y que `findByToken` nunca devuelva el `responseToken` |
| `participants/participant.guard.spec.ts` | 5 | Acceso autorizado, sin token, token inválido, cabecera repetida como arreglo, falta de `gatheringId` |
| `gatherings/gatherings.gateway.spec.ts` | 8 | `watch` autorizado, sin credenciales, token inválido, token de otra juntada, `participantId` que no coincide, presencia al unirse y al desconectarse |
| `gatherings/expense-idempotency.spec.ts` | 6 | Los cinco casos de §8 más el rechazo por token ajeno |
| `gatherings/gathering-visibility.spec.ts` | 7 | Vista pública sin coordenadas ni disponibilidad, con nombres, token inválido tratado como visitante, ausencia total de `responseToken` en la respuesta, vista privada completa |
| `gatherings/gathering-window.spec.ts` | 5 | Rango válido, invertido, de duración cero, franja que no entra, zona horaria inexistente |
| `locations/locations.service.spec.ts` | 4 | Hit de caché, expiración por TTL, desalojo al superar 500 entradas, consulta corta rechazada sin llamar a Nominatim |
| *(existentes)* | 37 | Liquidación, slots, usuarios, auth de Supabase, plan de compra |

**Frontend: 22** (9 archivos) — sin cambios en cantidad.
**E2E: 6 en verde**, 1 salteado (requiere `E2E_REAL_DB=1`).

### Sobre no bajar la seguridad para que pasen los tests

`gatherings.service.spec.ts` construía el servicio con un solo argumento. En vez de inyectarle un doble permisivo de `ParticipantAuthService`, se le pasa uno **real** sobre el mismo mock de Prisma. Los 37 tests existentes siguen valiendo y ahora ejercitan la autorización de verdad: si alguien aflojara la comparación de tokens, fallarían.

Ningún test se relajó. El único cambio de contrato fue en los mocks de E2E (`proposals: []` → `isParticipant: true`), que reflejan la nueva respuesta de la API.

---

## 14bis. Empty database rebuild

```
EMPTY DATABASE → WORKING SALE JUNTADA
```

Script reproducible: [`scripts/verify-empty-rebuild.sh`](../sale-juntada-back/scripts/verify-empty-rebuild.sh). Falla al primer error, sin pasos manuales ocultos.

```bash
DATABASE_URL=postgresql://user:pass@host:port/base_vacia \
  bash sale-juntada-back/scripts/verify-empty-rebuild.sh
```

### Ejecutado y verificado

**No se usó la base de Supabase.** Se levantó un cluster PostgreSQL 17.6 temporal y vacío (`initdb` en el scratchpad, puerto 54331) y sobre él una base recién creada, con cero tablas al empezar.

| # | Paso | Resultado |
|---|---|---|
| 1 | `migrate deploy` | ✅ `0_init` aplicada |
| 2 | `prisma:seed` | ✅ `/j/asado-demo-tucuman` |
| 3 | `prisma generate` | ✅ |
| 4 | backend lint | ✅ |
| 5 | backend tests | ✅ **101 tests**, 12 suites |
| 6 | backend build | ✅ |
| 7 | frontend lint (`--max-warnings=0`) | ✅ |
| 8 | frontend tests | ✅ 22 tests, 9 archivos |
| 9 | frontend build | ✅ 10,88 s |
| 10 | E2E smoke | ✅ 6 passed |

**Estado final de la base reconstruida:**

```
tablas=12   rls=11   migraciones=1   juntada=1   catalogo=43
```

12 tablas = las 11 del modelo más `_prisma_migrations`. Los 4 participantes del seed tienen tokens de **43 caracteres**: ninguno con formato `cuid()`.

### Sobre el bloqueo de `migrate reset`

El clasificador del harness bloquea `prisma migrate reset`. **No se intentó esquivarlo.** La verificación se hizo creando una base nueva y vacía y aplicándole `migrate deploy`, que demuestra lo mismo —que el historial reconstruye el schema desde cero— sin ningún comando destructivo.

Lo que **sí** se pudo comprobar: que una base sin una sola tabla llega a Sale Juntada funcionando con los 10 pasos, y que el baseline no depende de nada creado previamente por Supabase.

---

## 15. Known technical debt

| # | Deuda | Por qué se dejó |
|---|---|---|
| 1 | `GatheringsService`: ~2.000 líneas | Se extrajo la autorización, que era la duplicación real. El resto es refactor de P1/P2 |
| 2 | `App.tsx`: 3.300 líneas, 47 `useState` | Fuera de alcance por §37. Lo resuelve P1 con routing |
| 3 | Sin routing real | P1 |
| 4 | Chunk `maps` de ~1 MB | Se resuelve con lazy loading por ruta, en P1 |
| 5 | Presencia en `Map` en memoria | **Requiere adaptador de Redis antes de escalar horizontalmente.** Con una instancia no es problema. No se agregó Redis: no hay necesidad demostrable hoy |
| 6 | React Query montado y apenas usado | P1/P2 |
| 7 | Catálogo de compras hardcodeado en el servicio | P2 lo reemplaza con items libres |
| 8 | `Expense` sin `currency` | Diferido a P3, junto con `ExpenseSplit` |
| 9 | 10 índices sin uso reportados por Supabase | Con este volumen el planner elige seq scan. Serán necesarios con tráfico |
| 10 | `MobileExperience.tsx`: 1.530 líneas | P1/P2 |

### RLS — acceso sólo por API

```
Database access is API-only.
Frontend must not query application tables directly using Supabase anon client.
```

Las 13 tablas tienen RLS habilitado y **cero políticas**. Hoy no rompe nada porque el backend se conecta vía Prisma con un rol que hace bypass de RLS.

**Verificado durante P0:** el frontend usa el cliente de Supabase **únicamente para autenticación** (`supabase.auth.*` en [AuthContext.tsx](../sale-juntada-front/src/auth/AuthContext.tsx)). No hay ni una consulta directa a tablas de la aplicación. No se construyó un sistema de RLS: sería infraestructura para un patrón de acceso que no existe.

Si algún día el frontend consultara tablas directamente, **primero** hay que escribir políticas.

### Leaked password protection — `MANUAL CONFIGURATION`

Está deshabilitado en Supabase Auth. No es configurable desde el repositorio.

> Supabase Dashboard → Authentication → Policies → *Leaked password protection* → activar.

Contrasta las contraseñas contra HaveIBeenPwned. No bloquea P0.

### Swagger

Ya se puede desactivar con `ENABLE_SWAGGER=false` ([main.ts](../sale-juntada-back/src/main.ts)). No se tocó.

---

## 16. Deferred to P1

RSVP (`GOING` / `MAYBE` / `NOT_GOING`) · nueva landing · routing y code splitting · rediseño de la creación · preview dinámico de WhatsApp · botón de WhatsApp · página `/mis-juntadas` · disponibilidad como paso opcional.

**Nota para P1:** no se creó el modelo `Rsvp` a propósito. La decisión entre `Participant.rsvpStatus` + `plusOnes` y una entidad separada depende de si hace falta historial de cambios de respuesta, y eso se define en P1.

Tampoco se creó una tabla `User`: hoy alcanza con Supabase Auth + `Participant.authUserId` + `UserPaymentProfile`. Esa decisión pertenece a la fase de grupos y perfil persistente (P4).

## 17. Deferred to P2 / P3 / P4

- **P2** — items libres, asignación de compras, retiro del catálogo hardcodeado
- **P3** — `ExpenseSplit`, splits personalizados, múltiples pagadores, vaquita, `currency`, cierre forzado por el organizador
- **P4** — grupos recurrentes, templates, balance entre juntadas, duplicar desde la UI
- **P5** — `Activity`, analytics, `Invitation` con trazabilidad, push, Redis para presencia
- **P6** — Mercado Pago, OCR de tickets, IA

---

## Apéndice — Decisiones que conviene revisar

1. **`idempotencyKey` obligatoria en vez de opcional.** Más estricto; un cliente que no la mande recibe 400.
2. **Sesión indexada por slug, no por id de juntada.** Permite mandar el token en el primer request y evita pedir la juntada dos veces. Invalida sesiones guardadas con el esquema anterior.
3. **Nombres y avatares son públicos.** Se decidió que la prueba social es parte del argumento para sumarse. Si se prefiere ocultarlos, el cambio es acotado a `getBySlug`.
4. **Se corrigió una migración ya aplicada** (`restrict_rls_auto_enable`) para que el historial se pueda reconstruir desde cero. Su checksum cambió: cualquier otro entorno con esa migración aplicada necesita `migrate reset`.
5. **No se agregó Redis** pese a que la presencia en memoria bloquea el escalado horizontal. Con una instancia no hay problema.
