# P1.3 — Routing + Landing + Real Gathering Separation

> Rama `fix/p0-security-integrity`. Tercer slice de P1.
> **Sólo routing, landing real y extracción de `GatheringPage`.** RSVP UI, guest onboarding nuevo, WhatsApp, OG y `AvailabilityPoll` quedan para slices posteriores.

---

## 1. Summary

`App.tsx` dejó de ser una sola función de 3355 líneas que decidía a mano si mostraba una landing con datos inventados o una juntada real. Ahora:

| # | Qué se hizo |
|---|---|
| 1 | `<Routes>` reales: `/` → `LandingPage`, `/j/:slug` → `GatheringPage`, `*` → `NotFoundPage` |
| 2 | `useParams()` reemplaza el regex manual sobre `location.pathname` |
| 3 | `demoSlots`, `friends` y el estado ficticio `"Asado con los pibes"` **desaparecieron** del código productivo |
| 4 | El formulario de creación existente se extrajo a `CreateGatheringDialog`, reutilizado por Landing y por "duplicar juntada" |
| 5 | `GatheringPage` nunca muestra datos falsos: sin juntada real, hay loading, error o 404 — nunca demo |
| 6 | Slug sintácticamente válido pero inexistente (404 de la API) → mensaje específico, sin modal de join |
| 7 | La disponibilidad ahora se oculta correctamente en juntadas `CONFIRMED` y `CANCELLED` (antes se mostraba siempre) |
| 8 | Code splitting real por ruta: `/` ya no descarga el JS de `GatheringPage` ni el de `realtime` (socket.io) |
| 9 | 3 rutas nuevas de test (`App.test.tsx`, `GatheringPage.test.tsx`) + 4 tests E2E ajustados a la nueva realidad |
| 10 | Backend: **sin cambios** (P1.3 es 100% frontend) |
| 11 | Bug real encontrado y corregido en verificación manual: la landing quedaba sin hero ni CTA en mobile (ver §12bis) |

---

## 2. Previous routing

`BrowserRouter` estaba montado en `main.tsx` con **cero `<Route>`**. Todo el ruteo vivía en un `useEffect` de `App.tsx`:

```ts
const match = locationState.pathname.match(/^\/j\/([^/]+)$/);
```

**Responsabilidades manuales de ese `useEffect` (inventario previo a tocar código):**

- Parsear el slug desde `location.pathname` con regex.
- Decidir si había o no una juntada activa (`activeGathering`) para condicionar CASI todo el JSX del componente.
- Disparar el fetch de la juntada, leer la sesión de `localStorage` y decidir vista pública vs. participante — esto **se conservó intacto**, sólo cambió el disparador (`slug` de `useParams()` en vez de `pathname`).

No había `history.pushState` manual, ni listeners de `popstate`: la navegación ya usaba `useNavigate()` de `react-router-dom` donde hacía falta (por ejemplo al crear una juntada). Eso se mantuvo.

---

## 3. New routing

```tsx
// App.tsx
<Suspense fallback={<GatheringSkeleton />}>
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/j/:slug" element={<GatheringPage />} />
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
</Suspense>
```

Los tres elementos de ruta son `React.lazy`, así que cada uno es su propio chunk (ver §13). `main.tsx` no cambió: los providers globales (`QueryClientProvider`, `MotionProvider`, `AuthProvider`, `BrowserRouter`) siguen montados una sola vez, por fuera de `App`.

No se crearon rutas futuras (`/mis-juntadas`, `/groups`, `/login`) — quedan fuera de alcance explícito de este slice.

---

## 4. Route tree

```
main.tsx
  └── providers (Query · Motion · Auth · BrowserRouter)
       └── App
            └── <Routes>
                 ├── LandingPage       (/)
                 ├── GatheringPage     (/j/:slug)
                 └── NotFoundPage      (*)
```

---

## 5. App responsibility

`App.tsx` pasó de 3355 líneas a 23. Ya no es responsable de:

- interpretar `pathname`;
- decidir si se está en landing o en una juntada;
- contener `demoSlots`, `friends` ni el estado `"Asado con los pibes"`;
- representar una juntada inexistente.

Es exclusivamente un shell de routing con `Suspense` + `<Routes>`.

---

## 6. Landing responsibility

`src/routes/LandingPage.tsx` — real, sin demo:

- Header mínimo (sólo la marca; sin botón de cuenta — ver §16 "Known debt").
- Hero: título, copy y **un** CTA ("Crear una juntada"). Sin CTA secundario, sin match-card de ejemplo con datos inventados.
- Sección "Así de simple" con 3 pasos, texto propio de este slice (no reutiliza literalmente el copy que tenía `App.tsx`, que mezclaba pasos de creación viejos).
- Footer.
- `<CreateGatheringDialog>` montado en modo `open={showCreate}`, sin `prefill` (creación desde cero).

No hay disponibilidad falsa, no hay participantes falsos, no hay gastos falsos. El único estado local es `showCreate` (boolean).

---

## 7. GatheringPage responsibility

`src/routes/GatheringPage.tsx` — es la antigua `Home()` **movida**, no reescrita. Conserva:

- carga de la juntada por slug (ahora vía `useParams()`);
- sesión de participante en `localStorage`;
- realtime (socket.io) — se abre sólo con sesión, como antes;
- Availability, purchases, expenses, settlement, location, minigames, diálogos de gestión y de cuenta — **movidos tal cual**.

Cambios reales de comportamiento (no sólo de ubicación), todos requeridos por reglas explícitas de este slice:

1. **Loading/error/not-found como estados de ruta, no como demo** (§8, §9).
2. **`confirmed` ya no se deriva de la sola presencia de `finalizedStart`** — ahora exige `status === "CONFIRMED"`. Antes de P1.2, cancelar borraba `finalizedStart`, así que la distinción no hacía falta; desde que cancelar lo conserva, sin este fix una juntada `CANCELLED` con fecha habría mostrado el plan de compras como si estuviera confirmada.
3. **La sección de disponibilidad (`planning-grid` + botón "Encontrar el mejor momento") sólo se renderiza con `status === "OPEN"`** (§10).
4. El formulario de creación se reemplazó por `<CreateGatheringDialog>` (mismo componente que usa Landing), disparado desde el CTA del hero y desde "duplicar juntada" en `AccountDialog`.

---

## 8. Demo removal

Eliminado del código productivo (verificado con `grep`, no sólo con un test):

- `demoSlots` (5 horarios hardcodeados) — **ya no existe en ningún archivo**.
- `friends` (5 personas hardcodeadas: Sofi, Fede, Mica, Nico, Lu) — **ya no existe**.
- La rama `if (!activeGathering) return demoData` en `slots`, `heroData`, `rankedSlots` (que directamente se eliminó por quedar sin uso), `findBestMoment` y `confirmProposal`.
- Los dos bloques de JSX `!activeGathering && friends.map(...)` / `!activeGathering && <div>Vos...</div>` en la tarjeta "El grupo".
- El estado inicial ficticio: `eventName` pasó de `"Asado con los pibes"` a `""`, `location` de `"Yerba Buena"` a `"Lugar a definir"`, `yourSlots` de tres slots hardcodeados a `[]`.

**Lo que se mantuvo a propósito:** `CreateGatheringDialog` sigue prellenando el campo "Nombre de la juntada" con `"Asado con los pibes"` como *placeholder editable*, igual que antes de P1.3. No es una juntada ficticia presentada como real — es un valor de formulario que cualquiera sobreescribe. Se dejó así porque no es lo que las reglas de este slice pedían eliminar (el estado global de landing que fingía una juntada existente), y cambiarlo hubiera sido una decisión de producto fuera de alcance.

---

## 9. Error states

| Estado | Dónde se resuelve | Comportamiento |
|---|---|---|
| Cargando `/j/:slug` | `GatheringSkeleton` | Esqueleto con la forma de la página (header + bloques), no un spinner centrado ni pantalla en blanco |
| Slug inexistente (404 de la API) | `NotFoundGathering` | *"Esta juntada no existe o el link ya no es válido."* + CTA a crear una. Se distingue de un error de red: sólo se activa con `ApiError` de status 404 |
| Error de red / otro error | Estado de error dentro de `GatheringPage` | Mensaje + botón "Reintentar" que vuelve a disparar el fetch. Nunca loading infinito |
| Ruta desconocida de la app | `NotFoundPage` | *"No encontramos esta página."* + CTA a "Volver al inicio" |
| Token inválido/vencido | Sin cambios de P1.3 | El backend ya degrada a la vista pública (`isParticipant: false`) desde P0; la UI ofrece sumarse de nuevo. **No se agregó limpieza de `localStorage`**: no existía antes y agregarla es una decisión de UX fuera de alcance de este slice |

`NotFoundGathering` (juntada inexistente) y `NotFoundPage` (ruta inexistente) son componentes **distintos** a propósito — mezclarlos habría hecho imposible diferenciar los dos mensajes.

---

## 10. Cancelled handling

Antes de este slice, la sección de disponibilidad (grilla de horarios + "El grupo" + botón "Encontrar el mejor momento") se renderizaba **siempre**, sin importar el `status`. Sólo botones individuales quedaban `disabled` en `CONFIRMED`/`CANCELLED`.

Regla aplicada (obligatoria para no romper el lifecycle de P1.2, donde cancelar ahora conserva `finalizedStart`):

```
status === OPEN        → se muestra Availability
status === CONFIRMED    → experiencia confirmada (compras, gastos)
status === CANCELLED    → no Availability, banner de cancelación, contexto conservado
```

`GatheringPage` no asume `CANCELLED ⇒ finalizedStart == null`. El banner *"Esta juntada fue cancelada..."* ya existía y sigue mostrando el resto del contexto (título, fecha, ubicación) sin crashear.

No se rediseñó la vista cancelada completa — eso sigue siendo trabajo de un slice posterior si hace falta.

---

## 11. Code splitting

`GatheringManagementDialog` no importa `LocationPicker`, así que el chunk de mapas quedó exclusivamente detrás de `CreateGatheringDialog` (que es lazy en sí mismo al ser parte del chunk de cada ruta que lo usa). El chunk `realtime` (socket.io-client) sólo se importa dentro de `GatheringPage`, así que ahora es lazy también — antes se descargaba siempre, incluso en la landing, aunque el socket sólo se abre con sesión.

No se usó `manualChunks` ni se movieron dependencias a mano: fue Vite + `React.lazy` por ruta haciendo su trabajo, como pedía la consigna.

---

## 12. Bundle: antes / después

Medido con `npm run build` (`vite build`), tamaños sin gzip.

### Antes (single `App.tsx`, sin rutas)

| Chunk | Tamaño |
|---|---|
| `index.js` | 307.82 KB |
| `react` | 278.45 KB |
| `motion` | 80.00 KB |
| `realtime` | 41.56 KB |
| `query` | 24.60 KB |
| `index.css` | 73.47 KB |
| **Eager total (sin `maps`, que ya era lazy)** | **≈ 805.9 KB** |
| `maps` (lazy) | 1053.48 KB |

### Después (rutas reales)

| Chunk | Tamaño | Se descarga en... |
|---|---|---|
| `index.js` | 201.24 KB | siempre (shell + deps compartidas) |
| `react` | 280.43 KB | siempre |
| `motion` | 80.00 KB | siempre |
| `query` | 24.60 KB | siempre |
| `index.css` | 74.20 KB | siempre |
| `LandingPage.js` | 2.48 KB | sólo en `/` |
| `GatheringPage.js` | 90.81 KB | sólo en `/j/:slug` |
| `NotFoundPage.js` | 0.87 KB | sólo en rutas desconocidas |
| `realtime` | 41.56 KB | sólo cuando `GatheringPage` monta (ya no en `/`) |
| `CreateGatheringDialog.js` | 16.48 KB | sólo al abrir el diálogo de creación |
| `maps` (lazy, sin cambios) | 1053.48 KB | sólo al abrir `LocationPicker` |

**Landing (`/`):** 201.24 + 280.43 + 80.00 + 24.60 + 2.48 ≈ **588.75 KB** — baja de ~806 KB (**-27%**), y no incluye `GatheringPage`, `realtime` ni `maps`.

**Link de invitación (`/j/:slug`):** 201.24 + 280.43 + 80.00 + 24.60 + 90.81 + 41.56 ≈ **718.64 KB** — baja de ~806 KB (**-11%**), y no incluye `CreateGatheringDialog` ni `maps` salvo que se abran.

Esto cumple la medible del plan maestro: *"el link de invitación tiene que cargar menos JavaScript que hoy, no más."*

---

## 12bis. Bug real encontrado en verificación manual: landing sin hero en mobile

La verificación en navegador (mobile 375px) mostró la landing **sin título, sin copy y sin el botón "Crear una juntada"** — saltaba directo a la sección "Así de simple".

**Causa:** `LandingPage` reutilizó `className="hero desktop-hero"`, la misma clase que usaba el hero de marketing en el `App.tsx` viejo. `.desktop-hero { display: none; }` existe en `index.css` dentro de un media query pensado para un mundo donde el hero desktop **siempre** convive con `<MobileDashboard>`, que es quien mostraba el CTA en mobile. Landing no monta `MobileDashboard` — el resultado era una landing sin ningún CTA visible en mobile, justo el caso que la regla 38 pedía verificar.

**Fix:** se sacó la clase `desktop-hero` del hero de `LandingPage` (queda `"hero landing-hero"`). `.hero` ya tenía su propio comportamiento responsive (columna única a partir de 820px) independiente de `.desktop-hero`, así que alcanzó con dejar de aplicar la clase que lo ocultaba. Efecto secundario menor: el círculo decorativo (`.hero::before`, pensado para la columna vacía del layout de dos columnas) quedaba superpuesto al texto en mobile — se agregó `.landing-hero::before { display: none; }` dentro del mismo media query existente para ocultarlo ahí.

Dos líneas de CSS + un cambio de className. Verificado de nuevo en 375px y 430px: CTA visible, sin overflow horizontal, sin overlap.

---

## 13. Existing create flow

`CreateGatheringDialog` (`src/components/CreateGatheringDialog.tsx`) es una extracción **literal** del diálogo que vivía embebido en `App.tsx`: mismos campos, misma validación, mismo endpoint (`gatheringService.create`), mismo contrato `windowStart`/`windowEnd` (P1.2 sigue vigente; `startsAt` en dos pasos es P1.6).

Cambios de forma, no de fondo:

- Antes compartía estado (`selectedAvatar`, `isSubmitting`, `isPreparingAvatar`) con el diálogo de "sumarse a la juntada" porque vivían en el mismo componente. Ahora cada uno tiene su propio estado local — sin efecto observable, porque nunca estaban abiertos los dos a la vez.
- El prellenado para "duplicar juntada" (que antes hacía ocho `setState` sueltos sobre el estado de `App.tsx`) ahora se arma como un único objeto `CreateGatheringPrefill` que se pasa por props, con un `key` que fuerza que el diálogo arranque de cero en cada apertura.
- Después de crear, ya no hace falta `setActiveGathering(gathering)` a mano: al navegar a `/j/:slug`, `GatheringPage` monta de cero y hace su propio fetch. Antes era necesario porque landing y juntada eran el mismo componente y había que evitar un refetch.

**Deuda reconocida:** el toast "Juntada creada. Ahora compartila con el grupo." que existía antes ya no tiene un lugar natural donde vivir (el diálogo cierra y navega a una página distinta, que no sabe que la juntada "se acaba de crear"). Se decidió no re-implementarlo con un mecanismo nuevo (query param, sessionStorage) para no exceder el alcance de "mover, no rediseñar". El título de la juntada recién creada ya es visible de inmediato en la página nueva.

---

## 14. Session behavior

Sin cambios de formato ni de mecanismo. `localStorage` sigue indexado por slug (`sale-juntada:participant:<slug>`), `GatheringPage` sigue leyendo `participantId`/`responseToken` con las mismas funciones (ahora importadas desde `src/utils/gatheringHelpers.ts` en vez de estar definidas inline). No se migró el storage, no se creó auth global.

---

## 15. Code splitting tests / frontend tests

**Nuevos:**

| Archivo | Cubre |
|---|---|
| `src/App.test.tsx` | `/` renderiza la landing real (CTA visible, sin `"Asado con los pibes"`, sin stub de `GatheringPage`); `/j/:slug` renderiza `GatheringPage` con el slug correcto vía `useParams`; ruta desconocida renderiza `NotFoundPage` |
| `src/routes/GatheringPage.test.tsx` | 404 de la API → mensaje específico, sin modal de join, sin demo; juntada `CANCELLED` con `finalizedStart` conservado → renderiza sin crash, sin sección de disponibilidad; el slug usado en el fetch viene de la ruta, no de un parseo manual |

**Frontend: 22 → 28** (9 → 11 archivos). Todos verdes, incluyendo los 22 preexistentes sin modificar.

**Nota de entorno (no es parte del diff de producto):** en esta Mac, Node trae un `localStorage` global experimental que queda `undefined` sin `--localstorage-file`, y le gana al `localStorage` funcional que provee jsdom dentro de Vitest — 5 tests de `MobileExperience.test.tsx` fallaban por esto en la corrida inicial, antes de tocar cualquier código de P1.3. Se corrigió agregando `NODE_OPTIONS=--no-experimental-webstorage` al script `test` de `package.json`. Es un fix de tooling, no de producto.

---

## 16. Known debt

1. **Sin botón de cuenta en Landing.** `AccountDialog` (ver "mis juntadas", duplicar) quedó exclusivo de `GatheringPage`. Es deliberado (mantiene la landing mínima, rule 9), pero significa que alguien que ya participó de una juntada y quiere encontrarla desde `/` no tiene ese camino — tiene que volver a abrir el link original.
2. **Toast "Juntada creada" perdido** tras crear (ver §13). Menor: el título ya es visible en la página nueva.
3. **`.desktop-hero` completo (incluida la copy de marketing "Que coincidir sea la parte fácil" + CTA "Crear una juntada" + link "Ver cómo funciona") se mantuvo en `GatheringPage`**, porque ya se renderizaba ahí antes de P1.3 (todo era un solo componente) y tocarlo hubiera sido rediseñar la jerarquía de la página, que es trabajo explícito de P1.5. Sigue siendo, hoy, contenido de marketing genérico encima de una juntada real.
4. **Toda la sección de disponibilidad, incluida la lista de participantes ("El grupo"), desaparece completamente para juntadas no-`OPEN`.** No hay todavía una vista de "asistencia"/RSVP que la reemplace — eso es P1.4. Mientras tanto, una juntada `CONFIRMED` o `CANCELLED` no muestra ningún listado de participantes en esta sección.
5. **`readParticipantSession` no limpia `localStorage`** cuando el token es inválido (nunca lo hizo). Sigue como estaba.

---

## 17. Deferred to P1.4

`GatheringHero`, `JoinGathering` sin modal, `RsvpSelector`, `PlusOnesStepper`, `AttendanceSummary`, migración a React Query (`useGathering`, `useRsvp`). El modal actual de "¿Cómo te llamás?" sigue existiendo tal cual.

## 18. Deferred to P1.6

`CreateGatheringFlow` en dos pasos, el contrato `startsAt` en el formulario, la UI de "¿más o menos cuándo?".

## 19. Deferred to P1.8

`vercel.json` — hay dos (`/vercel.json` y `sale-juntada-front/vercel.json`) con configuración potencialmente contradictoria, tal como lo señaló el plan maestro. **No se tocó ninguno de los dos en este slice.** No se verificó explícitamente el comportamiento de refresh/direct-link contra un despliegue real de Vercel (fuera de alcance sin deploy); sí se verificó que `/j/:slug` carga correctamente al navegar dentro de la SPA y con recarga completa del dev server de Vite, que sirve `index.html` para cualquier ruta no reconocida como asset — comportamiento equivalente al que un rewrite de SPA correcto en Vercel debería dar.

---

## 20. Actualización al plan maestro

No hizo falta corregir `docs/P1_CORE_SOCIAL_PLAN.md`: la implementación siguió el diseño de §11–§13 sin desvíos que ameriten una nota de corrección.

---

## Definition of Done — verificado

- [x] `/` y `/j/:slug` son rutas reales, con `lazy` y 404
- [x] El demo ficticio ya no existe (verificado con grep, no sólo tests)
- [x] `App.tsx` ya no es responsable de routing, landing, onboarding, RSVP ni hero
- [x] Ninguna migración tocada; `0_init` y `20260825060000_p1_rsvp` intactas
- [x] Sin cambios en `vercel.json`
- [x] Backend: 181/181 tests, sin cambios de código
- [x] Frontend: 28/28 tests (22 preexistentes + 6 nuevos)
- [x] E2E: 12 passed / 2 skipped (Desktop Chrome + Mobile Chrome — 6/1 por proyecto)
- [x] Lint y build verdes en los tres proyectos
- [x] El link de invitación descarga menos JS que antes (-11%, ver §12)
- [x] Verificación manual en navegador contra un Postgres local migrado y seedeado: landing real, creación → navegación a `/j/:slug`, refresh directo del link, marcar disponibilidad (persistida contra el backend real), juntada `CONFIRMED` real sin sección de disponibilidad, ambos 404 (ruta y juntada), estado de error con reintento, mobile 375/430px — encontró y permitió corregir el bug de §12bis
