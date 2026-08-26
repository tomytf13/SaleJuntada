# P1.2 — Creación simple y ciclo de vida de la fecha

> Rama `fix/p0-security-integrity`. Segundo slice de P1.
> **Backend y contratos.** La UI de creación llega en P1.6.

---

## 1. Summary

Crear una juntada ya no obliga a definir un calendario. Y la fecha, cuando existe o cambia, arrastra al RSVP con ella de forma atómica.

| # | Qué se hizo |
|---|---|
| 1 | Dos modos de creación excluyentes: **con fecha** (`startsAt`) y **buscando fecha** (ventana elegida) |
| 2 | `title` + `organizerName` son lo único siempre obligatorio |
| 3 | Mandar los dos modos a la vez se **rechaza con 400**, sin regla silenciosa de prioridad |
| 4 | **Sin ventana inventada**: no existe el default de +14 días |
| 5 | **`finalizedEnd` no se inventa** desde `durationMinutes` |
| 6 | La ventana del modo con fecha se deriva del **día local** usando los helpers de zona ya probados |
| 7 | `finalizeGathering` habilita el RSVP: organizador `GOING`, resto sin responder |
| 8 | Cambiar la fecha resetea el RSVP del resto **y los acompañantes del organizador** |
| 9 | Editar cualquier otra cosa **no** toca el RSVP |
| 10 | Reabrir la búsqueda resetea a **todos**, incluido quien organiza |
| 11 | Cancelar **conserva** el RSVP |
| 12 | Todas las transiciones de fecha + RSVP son **atómicas** |
| 13 | **Sin migración nueva**: no hizo falta ni una columna |
| 14 | Tests de backend: **135 → 166** |

---

## 2. Create modes

```
POST /api/gatherings
```

Siempre obligatorio: `title`, `organizerName`.

| Modo | Entrada | Resultado |
|---|---|---|
| **Con fecha** | `startsAt` | `status = CONFIRMED` · `finalizedStart = startsAt` · `finalizedEnd = null` · ventana derivada · organizador `GOING` |
| **Buscando fecha** | `windowStart` + `windowEnd` | `status = OPEN` · `finalizedStart = null` · `finalizedEnd = null` · ventana tal cual · organizador sin RSVP |

Todo lo demás (`durationMinutes`, `dailyStartMinutes`, `dailyEndMinutes`, `slotStepMinutes`, ubicación, `timeZone`, `templateGatheringId`) sigue siendo opcional y conserva sus defaults.

---

## 3. Conditional validation

La validación vive en `resolveCreationSchedule()`, que decide el modo **antes** de tocar la base.

| Entrada | Respuesta |
|---|---|
| `startsAt` + `windowStart` y/o `windowEnd` | **400** — *"Mandá startsAt para una juntada con fecha, o windowStart y windowEnd para buscarla entre varias. Los dos juntos no."* |
| Ni `startsAt` ni ventana | **400** — *"Decinos cuándo es la juntada… o entre qué fechas buscarla"* |
| Sólo `windowStart` | **400** |
| Sólo `windowEnd` | **400** |
| `startsAt` no parseable | **400** |
| `windowStart >= windowEnd` | **400** — vía `assertValidWindow`, la validación centralizada de P0 |
| Zona horaria inexistente | **400** — vía `isValidTimeZone`, la de P0 |

### Por qué se rechaza la entrada ambigua

Dejar que `startsAt` le gane en silencio a la ventana sería una regla invisible: si el cliente manda los dos, no sabemos cuál quiso. Un 400 con mensaje claro cuesta menos que una juntada creada en el modo equivocado.

---

## 4. Fixed-date creation

```
status          = CONFIRMED
finalizedStart  = startsAt
finalizedEnd    = null
finalizedLocation = locationHint ?? null
organizador     = GOING, plusOnes 0, rsvpAt now()
```

### `finalizedEnd = null`, y no `startsAt + durationMinutes`

`durationMinutes` es **cuánto dura un bloque candidato del buscador de horarios**, no cuánto dura la juntada. Si quien crea dijo "sábado 21:00" y nada más, la respuesta honesta a "¿a qué hora termina?" es *no lo dijo*.

Inventar un fin de 180 minutos habría producido un dato que la UI mostraría como si el grupo lo hubiera decidido.

### El organizador nace confirmado

Se hace **en la misma operación** que la creación, dentro del `participants.create` anidado — no se crea en `null` para corregirlo después.

Quien organiza el asado va al asado; pedirle que lo confirme es fricción sin información.

---

## 5. Flexible-date creation

```
status          = OPEN
finalizedStart  = null
finalizedEnd    = null
windowStart/End = los que eligió quien crea
organizador     = rsvpStatus null, plusOnes 0, rsvpAt null
```

### Sin ventana inventada

El plan original ponía `hoy → hoy + 14 días` cuando no venía fecha. **Se eliminó.** Es una decisión de agenda que nadie tomó y que aparecería en la pantalla como si la hubieran elegido.

Ahora la ventana es obligatoria en este modo. La UI de P1.6 la va a pedir con opciones cómodas (*este finde*, *el finde que viene*, *elegir fechas*), pero la elección es del usuario y llega explícita al backend.

### El organizador **no** nace `GOING`

Sin fecha el RSVP no aplica para nadie, ni siquiera para quien organiza. Ser `Participant` ya expresa el interés; la pregunta pendiente es *cuándo podés*, no *venís*.

---

## 6. Window derivation

`Gathering.windowStart/windowEnd` siguen siendo obligatorias en el schema — no se hicieron nullable sólo para este slice, porque las consume `slots.ts` y todo lo que P0 dejó probado.

Para el modo con fecha se derivan del **día calendario local** de `startsAt`, reutilizando los helpers que ya generan los horarios candidatos:

```ts
const day = calendarDayInZone(startsAt, timeZone);
windowStart = zonedWallClockToUtc(day, 0, timeZone);        // 00:00 local
windowEnd   = zonedWallClockToUtc(day, 24 * 60, timeZone);  // 24:00 local
```

**No es medianoche UTC.** `2026-08-30T00:30:00Z` es todavía el 29 por la noche en Tucumán (UTC−3), y la ventana derivada es la del **29 local**. Hay un test que lo comprueba exactamente en ese borde.

Garantías que quedan sostenidas:

- `windowStart < windowEnd` siempre
- `windowStart <= finalizedStart < windowEnd`
- Compatible con `buildSlots`, que ya resuelve los bordes de horario de verano con doble pasada

Aunque el buscador de horarios esté oculto en una juntada confirmada, los datos no quedan estructuralmente inválidos.

### Resuelto en el final review: la ventana se recalcula al mover la fecha

La primera versión de este slice dejaba una limitación: como la ventana derivada era de un solo día y `finalizeGathering` validaba contra ella, mover la juntada a otro día obligaba a reabrir la búsqueda primero.

**Corregido.** Ver §6bis: cambiar la fecha y reabrir la búsqueda son dos acciones distintas, y ahora el backend las trata como tales.

---

## 6bis. Direct date change

Cambiar la fecha de una juntada confirmada y reabrir la búsqueda son **dos acciones conceptualmente distintas**, y el backend ahora las distingue.

`finalizeGathering` cubre las dos operaciones y decide por el estado previo:

| Estado previo | Qué es | Validación | Ventana |
|---|---|---|---|
| `finalizedStart === null` | **Elegir una opción de la encuesta** | Contra la ventana y la duración del bloque: la fecha tiene que ser una de las que el grupo marcó | Se conserva la de la encuesta |
| `finalizedStart !== null` | **Mover la juntada de día** | Sólo `startsAt < endsAt` | **Se recalcula** al día local de la fecha nueva |

```
ANTES                          DESPUÉS
finalizedStart = sábado 21:00  finalizedStart = domingo 21:00
window = día del sábado        window = día del domingo
status = CONFIRMED             status = CONFIRMED   ← no pasa por OPEN
```

**Por qué no se valida contra la ventana al mover:** la ventana vieja describe el día anterior. Exigir que la fecha nueva caiga dentro de ella es pedir que la juntada no se mueva.

La ventana se recalcula con `deriveDayWindow()`, el mismo helper que usa la creación con fecha — no hay una segunda implementación de "qué día es esto". Se sostienen las mismas invariantes:

```
windowStart < windowEnd
windowStart <= finalizedStart < windowEnd
```

Y la derivación es **por la zona de la juntada, no por UTC**: hay un test que mueve la fecha a `2026-08-31T02:00Z` —todavía el 30 por la noche en Tucumán— y verifica que la ventana queda en el **30 local**.

**El reset de RSVP no cambia**: organizador `GOING` / `plusOnes 0` / `rsvpAt now()`, resto a `null`. Todo dentro de la misma transacción que actualiza la fecha y la ventana; no hay estados intermedios.

**Reconfirmar el mismo instante sigue siendo un no-op**: no resetea el RSVP y tampoco toca la ventana. Hay un test que lo comprueba.

### Sigue siendo otra operación reabrir la búsqueda

`updateGathering` con cambio de cronograma es lo que devuelve la juntada a `OPEN`, borra `finalizedStart`/`finalizedEnd` y resetea el RSVP de **todos**. Eso no se toca: la ventana nueva para la encuesta la elige quien organiza.

---

## 7. Timezone behavior

**No se introdujo una segunda implementación.** Se reutilizan `isValidTimeZone`, `calendarDayInZone` y `zonedWallClockToUtc` de [`slots.ts`](../sale-juntada-back/src/gatherings/slots.ts).

El default **no cambió**: sigue siendo `America/Argentina/Buenos_Aires` (`DEFAULT_TIME_ZONE`).

Tests agregados: zona por defecto, zona explícita, y el borde de cambio de día UTC/local descrito arriba. No se duplicaron los tests de horario de verano — `slots.spec.ts` ya los cubre.

---

## 8. RSVP lifecycle

| Transición | Organizador | Resto |
|---|---|---|
| Crear con fecha | `GOING` · 0 · now | — |
| Crear sin fecha | `null` · 0 · `null` | — |
| `finalizeGathering()` con fecha nueva o distinta | `GOING` · **0** · now | `null` · 0 · `null` |
| `finalizeGathering()` con la **misma** fecha | sin cambios | sin cambios |
| `updateGathering()` que cambia el cronograma | `null` · 0 · `null` | `null` · 0 · `null` |
| `updateGathering()` sin tocar el cronograma | sin cambios | sin cambios |
| `cancelGathering()` | **se conserva** | **se conserva** |

Las dos reglas de reset viven en `RsvpService`, que ya existía:

```ts
resetForConfirmedDate(transaction, gatheringId)  // organizador GOING, resto null
resetForOpenScheduling(transaction, gatheringId) // todos null
```

Ambas reciben el cliente transaccional, para poder correr dentro de la misma transacción que el cambio de fecha.

---

## 9. Finalize behavior

`finalizeGathering` es el único camino que pone o cambia `finalizedStart` (verificado: `UpdateGatheringDto` no puede setearlo).

```
CONFIRMED + finalizedStart = fecha elegida
  ├─ organizador → GOING, plusOnes 0, rsvpAt now()
  └─ resto       → null, 0, null
```

Aunque durante `OPEN` todos deberían estar ya en `null`, el reset se aplica igual: hace la invariante explícita en vez de depender de que nada la haya roto antes.

`finalizedEnd` **sí** se setea acá, con el `endsAt` del slot elegido. Es coherente: un horario candidato tiene principio y fin reales. Distinto del modo con fecha, donde nadie declaró un fin.

---

## 10. Date-change reset

La comparación es **por instante**, no por cadena:

```ts
const previousStart = gathering.finalizedStart ?? null;
const dateChanged =
  previousStart === null || previousStart.getTime() !== startsAt.getTime();
```

Hay un test que manda `2026-09-06T19:00:00.000-03:00` contra un `finalizedStart` guardado como `2026-09-06T22:00:00.000Z` — el mismo instante con otra representación — y verifica que **no** resetea.

### Los acompañantes del organizador también se resetean

Quien iba a venir con dos personas el domingo no necesariamente puede el miércoles. `plusOnes` depende de la fecha tanto como la respuesta, así que vuelve a 0 aunque el organizador siga en `GOING`.

---

## 11. Reopen behavior

Cuando `updateGathering` cambia el cronograma (ventana, duración, franja diaria o paso), la juntada vuelve a `OPEN` y se limpian `finalizedStart`, `finalizedEnd` y `finalizedLocation`. Eso ya existía.

**Lo nuevo:** en la misma transacción se resetea el RSVP de **todos**, incluido quien organiza. Sin fecha el RSVP no aplica para nadie.

---

## 12. Cancellation behavior

**Cancelar ya no borra la historia.** `cancelGathering` cambia sólo el estado:

```ts
data: { status: GatheringStatus.CANCELLED }
```

Se conservan `finalizedStart`, `finalizedEnd`, `finalizedLocation`, `windowStart`, `windowEnd` y todo el RSVP.

Antes limpiaba las tres primeras, y con eso se perdía cuándo y dónde iba a ser. Una juntada cancelada tiene que poder mostrar:

```
Asado del sábado
CANCELADA
Iba a ser: 29/08 · 21:00 · Yerba Buena
```

Ese contexto es lo que explica de qué se está hablando.

El RSVP tampoco se toca: `requireActiveParticipant` ya impide modificarlo, así que queda como registro de lo que había respondido el grupo.

---

## 12bis. Lifecycle semantics

La invariante que usaba el plan —`status === CONFIRMED ⇔ finalizedStart != null`— **dejó de ser cierta**: una juntada cancelada ahora conserva la fecha que tenía.

La máquina de estados vigente:

| Estado | Fecha | RSVP | Disponibilidad |
|---|---|---|---|
| **`OPEN`** | `finalizedStart = null` | ❌ no aplica | ✅ permitida |
| **`CONFIRMED`** | `finalizedStart != null` | ✅ permitido | ❌ no aplica |
| **`CANCELLED`** | puede conservarla | ❌ bloqueado | ❌ bloqueado |

`CANCELLED` es terminal.

### Consecuencia para el código

Ningún guard puede deducir "cancelada" a partir de que no haya fecha. **Lo que manda es el estado.**

Verificado en los tres caminos, y los tres ya estaban bien porque `requireActiveParticipant` rechaza `CANCELLED` **antes** de cualquier chequeo de fecha:

| Camino | Guard | Estado |
|---|---|---|
| `RsvpService.setRsvp` | `requireActiveParticipant` → luego `finalizedStart` | ✅ `KEEP` |
| `setAvailability` | `requireActiveParticipant` → luego `CONFIRMED` | ✅ `KEEP` |
| `finalizeGathering` / `updateGathering` | chequeo explícito de `CANCELLED` | ✅ `KEEP` |

No hizo falta corregir nada, pero se agregaron tests que **fijan** el orden: si alguien lo invirtiera, una juntada cancelada sin fecha daría el mensaje equivocado.

### Reglas para la UI (P1.3+)

**No usar `status !== CONFIRMED` para mostrar la disponibilidad** — con la semántica nueva eso incluiría a las canceladas.

```
Disponibilidad   →  status === OPEN
RSVP             →  status === CONFIRMED && finalizedStart != null
Cancelada        →  status === CANCELLED
                    → banner de cancelación
                    → acciones interactivas deshabilitadas
                    → sigue mostrando cuándo y dónde iba a ser
```

---

## 13. Transaction boundaries

Una sola frontera transaccional por operación. Sin transacciones anidadas artificiales.

| Operación | Transacción |
|---|---|
| `create()` | Ya tenía una. Se le sumó el estado y el RSVP del organizador, dentro del mismo `gathering.create` anidado |
| `finalizeGathering()` | **Nueva.** Antes hacía un `update` suelto; ahora envuelve el cambio de fecha y el reset del RSVP |
| `updateGathering()` | Ya tenía una. Se le sumó el reset |
| `cancelGathering()` | Sin cambios: una sola escritura |

El estado de la fecha y el del RSVP se mueven juntos o no se mueven. Si el reset fallara después del commit, quedarían respuestas apuntando a una fecha que ya no existe.

---

## 14. Frontend compatibility

**El flujo actual sigue funcionando sin tocar la UI.** El formulario viejo manda `windowStart` + `windowEnd` y no manda `startsAt`, que es exactamente el modo *buscando fecha*. Hay un test que envía el payload completo de hoy y verifica que crea una juntada `OPEN`.

Los tipos ahora expresan los dos modos con una unión discriminada:

```ts
export type FixedDateGatheringInput = Base & {
  startsAt: string;
  windowStart?: never;
  windowEnd?: never;
};

export type FlexibleDateGatheringInput = Base & {
  startsAt?: never;
  windowStart: string;
  windowEnd: string;
};
```

Los `?: never` hacen que mezclar los modos sea un error de compilación, no sólo un 400 en runtime. **No obligó a refactorizar nada**: el llamador actual encaja en `FlexibleDateGatheringInput` tal como está.

**No se implementó UI**: ni `CreateGatheringFlow`, ni landing, ni routing, ni RSVP visual. Eso es P1.3+.

---

## 15. Tests

**Backend: 135 → 166** (16 suites).

| Archivo | Tests | Cubre |
|---|---|---|
| `gathering-creation.spec.ts` | 19 | Modo con fecha: confirmada · `finalizedEnd` null · organizador `GOING` · ventana derivada del día local (borde UTC/local) · la ventana contiene la fecha · zona por defecto · zona explícita. Modo buscando fecha: `OPEN` · ventana respetada · organizador sin RSVP. Validación: ambiguo · sin nada · sólo `windowStart` · sólo `windowEnd` · fecha inválida · ventana invertida · zona inexistente. Compatibilidad con el payload actual |
| `gathering-date-lifecycle.spec.ts` | 12 | Finalize: confirma · organizador `GOING` · resto sin responder. Cambio de fecha: resetea al resto · resetea `plusOnes` del organizador · **no** resetea con la misma fecha · compara instantes y no cadenas. Edición: ubicación y título no resetean. Reapertura: vuelve a `OPEN` · resetea a todos. Cancelación: conserva el RSVP |
| *(actualizados)* `gatherings.service.spec.ts` | — | Los mocks de finalize y de cambio de rango ahora modelan la transacción y el reset |

**Frontend: 22** (sin cambios; no hay UI en este slice).
**E2E: 6 en verde**, 1 salteado.

### Empty rebuild

`scripts/verify-empty-rebuild.sh` sobre un PostgreSQL 17.6 temporal y vacío, con **las mismas dos migraciones** (P1.2 no agregó ninguna):

```
1/10 migrations  → 0_init + 20260825060000_p1_rsvp
2/10 seed        → /j/asado-demo-tucuman · /j/previa-sin-fecha
3-9              ✅   10/10 e2e ✅ 6 passed

EMPTY DATABASE -> WORKING SALE JUNTADA: OK
```

### Decisión: sin migración nueva

P1.2 no necesitó ni una columna. `finalizedEnd` ya era nullable, `windowStart/windowEnd` siguen obligatorias en la base, y el modo se deriva de `finalizedStart`. No se creó una migración vacía sólo para marcar el slice.

`0_init` y `20260825060000_p1_rsvp` quedaron **sin modificar**.

### `finalizedEnd`: consumidores revisados

Se buscó código que asumiera `CONFIRMED => finalizedEnd != null`. **No existe**: `finalizedEnd` sólo aparece en declaraciones de tipo y fixtures de test, nunca en una condición o un cálculo. No hizo falta corregir nada.

---

## 16. Deferred to P1.3

`<Routes>` reales · `LandingPage` · `NotFoundPage` · extraer `GatheringPage` de `App.tsx` · eliminar el demo ficticio.

## 17. Deferred to P1.6

- `CreateGatheringFlow` en dos pasos
- La UI de "¿más o menos cuándo?" que llena `windowStart`/`windowEnd`
- **Decidir cómo se cambia la fecha de una juntada creada con fecha** (ver la limitación en §6): exponer el camino de dos pasos o agregar un endpoint dedicado

## Notas para P1.4

Cuando exista la UI, la query de la juntada tiene que invalidarse después de:

- confirmar una fecha (`finalizeGathering`)
- cambiar una fecha confirmada
- reabrir la búsqueda

En los tres casos el RSVP del grupo cambió del lado del servidor sin que el cliente lo haya pedido. **No se agregaron eventos nuevos de WebSocket**: `gathering:changed` ya se emite en `finalizeGathering`, `updateGathering` y `cancelGathering` desde P0, y alcanza para disparar esa invalidación.

---

## Decisiones que conviene revisar

1. **La ventana derivada es de un solo día** en el modo con fecha, lo que impide mover esa juntada a otro día sin reabrir. Es la limitación más relevante del slice (§6).
2. **`cancelGathering` sigue borrando `finalizedStart`**, comportamiento previo que no toqué. Se pierde el registro de cuándo iba a ser la juntada cancelada.
3. **Reconfirmar la misma fecha no resetea nada**, ni siquiera actualiza `rsvpAt`. Es un no-op deliberado.
4. **`?: never` en la unión de tipos del frontend** hace que mezclar modos no compile. No rompió nada hoy, pero es más estricto que el runtime.
