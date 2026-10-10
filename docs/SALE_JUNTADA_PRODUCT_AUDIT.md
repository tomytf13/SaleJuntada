# Sale Juntada — Auditoría de Producto y Arquitectura

> Auditoría realizada el 25/08/2026 sobre el commit `39d8dac` (rama `main`, igual a `origin/main` y a producción).
> Todas las observaciones están respaldadas por lectura directa del código. No se modificó código durante esta auditoría.

---

## 1. Executive Summary

Sale Juntada hoy **no es** la app que describe la visión. Es una **app de coincidencia de horarios** a la que se le agregaron gastos y una lista de compras.

La diferencia importa porque el orden de las etapas está invertido respecto de lo que hace la gente:

| La visión dice | El código hace |
|---|---|
| Etapa 1: "¿Sale algo el sábado?" | Etapa 1: elegí un rango de fechas, una franja horaria y una duración en minutos |
| Etapa 3: ✅ Voy / ❓ No sé / ❌ No voy | No existe. Existe `Availability` (marcar bloques horarios), que es otra cosa |
| Etapa 4: "Juan trae la carne" | Existe, pero sobre un catálogo **fijo de 9 categorías** hardcodeadas |
| Etapa 5: vaquita | No existe ninguna entidad |
| Etapa 7: "Pedro paga $8.200" | Existe y funciona bien, pero **sólo con división en partes iguales entre todos** |

La app le pide al usuario que resuelva un problema de calendario combinatorio antes de dejarlo decir "voy". Eso es exactamente la fricción que la visión quiere eliminar.

**Lo bueno:** la base técnica es sólida y honesta. Dinero en enteros (centavos), transacciones donde corresponde, validación server-side real, tests que pasan, tiempo real funcionando, y una capa de settlements que minimiza transferencias correctamente. El commit `39d8dac` ya cerró varios bugs serios de coordinación y de abuso. No hay que reescribir: hay que **reordenar y extender**.

**Lo urgente:** hay tres problemas P0 que bloquean cualquier crecimiento:

1. **`responseToken` no es criptográficamente seguro** y es la única credencial de todas las mutaciones.
2. **Los endpoints de plata son públicos** con sólo conocer el ID de la juntada.
3. **No hay idempotencia en gastos** — doble toque = gasto duplicado = plata mal contada.

**El mayor desperdicio de producto:** el link que se pega en WhatsApp muestra metadatos genéricos. El loop viral central del producto está roto en su punto más visible.

---

## 2. Estado actual del proyecto

**Repositorio:** monorepo con tres proyectos independientes (sin workspaces npm).

```
SaleJuntada/
├── sale-juntada-front/   React 19 + Vite 7 + TS  (8.137 líneas TS/TSX)
├── sale-juntada-back/    NestJS 11 + Prisma 6    (5.176 líneas TS)
├── sale-juntada-e2e/     Playwright 1.58         (1 archivo, 7 tests)
└── docs/
```

**Producción (verificada durante la auditoría):**

| Componente | Estado |
|---|---|
| Frontend — `sale-juntada-front.vercel.app` | ✅ activo, sirve el commit de `main` |
| API — `sale-juntada-api-tomytf13.fly.dev/api/health` | ✅ `{"status":"ok"}` |
| Base — Supabase Postgres 17, São Paulo (`reetfwqhhupuohtcpbsv`) | ✅ `ACTIVE_HEALTHY` |

**Datos reales en producción:** 11 juntadas, 21 participantes, 64 disponibilidades, 18 gastos, 29 items de compra, 1 transferencia confirmada, 43 productos de catálogo. Es decir: **hay uso real, poco pero real.** Cualquier cambio de modelo de datos necesita migración, no `db push`.

**Estado del build local (verificado):**

| Comando | Resultado |
|---|---|
| `back: npm run lint` | ✅ limpio |
| `back: npm test` | ✅ 37 tests, 4 suites |
| `back: npm run build` | ✅ |
| `front: npm run lint:ci` | ✅ limpio (`--max-warnings=0`) |
| `front: npm run test` | ✅ 22 tests, 9 archivos |
| `front: npm run build` | ⚠️ ok, pero chunk `maps` de **1.053 kB** |

**No hay CI.** No existe `.github/workflows/` en `main`. Los tests existen y pasan, pero nada los ejecuta automáticamente.

---

## 3. Mapa de arquitectura actual

```
┌─────────────────────────────────────────────────────────────────┐
│  NAVEGADOR                                                       │
│                                                                  │
│  main.tsx                                                        │
│   └── AppErrorBoundary → QueryClientProvider → MotionProvider    │
│        └── AuthProvider (Supabase JS)                            │
│             └── BrowserRouter                                    │
│                  └── <App /> ← UN SOLO COMPONENTE, SIN <Route>   │
│                                                                  │
│  App.tsx  (3.302 líneas, 47 useState, 7 useEffect)               │
│   ├── regex sobre pathname para /j/:slug   (App.tsx:568)         │
│   ├── MobileDashboard / MobileBottomNav / PurchasePlanner        │
│   ├── AccountDialog  ← "mis juntadas" vive acá dentro            │
│   ├── LocationPicker (maplibre-gl, lazy)                         │
│   └── PartyGames                                                 │
│                                                                  │
│  Estado: useState local + localStorage + socket.io               │
│  (React Query está instalado y montado pero casi no se usa)      │
└──────────────────┬───────────────────────┬──────────────────────┘
                   │ fetch (REST)          │ socket.io
                   ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  NestJS — Fly.io                                                 │
│                                                                  │
│  AppModule                                                       │
│   ├── ThrottlerGuard global (120 req / 60s) ← sin @Throttle      │
│   ├── AuthModule      → SupabaseAuthService (verifica JWT)       │
│   ├── GatheringsModule                                           │
│   │    ├── GatheringsController  (30 endpoints, 434 líneas)      │
│   │    ├── GatheringsService     ← 2.086 líneas, God Object      │
│   │    └── GatheringsGateway     ← presencia en Map en memoria   │
│   ├── LocationsModule → proxy Nominatim (cola global 1,1s)       │
│   ├── UsersModule     → historial + borrado                      │
│   └── PrismaModule                                               │
└──────────────────┬──────────────────────────────────────────────┘
                   │ Prisma 6 (pooler :6543 / directo :5432)
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase Postgres 17 — sa-east-1                                │
│  13 tablas · RLS habilitado · 0 políticas                        │
└─────────────────────────────────────────────────────────────────┘
```

**Observación de altura:** la arquitectura de infraestructura está bien elegida (monolito Nest, Postgres administrado, front estático). El problema no es la infra, es que **dentro** del monolito no hay separación de dominios: hay un módulo (`gatherings`) que contiene scheduling + compras + gastos + settlements + vinculación de identidad.

---

## 4. Modelo de datos actual

13 tablas. Reproducidas desde [schema.prisma](sale-juntada-back/prisma/schema.prisma):

```
Gathering (11 filas)
  slug ◄── única barrera de acceso (randomBytes(8), correcto)
  title, description, locationHint, locationLatitude, locationLongitude
  organizerName, timeZone
  windowStart, windowEnd, durationMinutes
  dailyStartMinutes, dailyEndMinutes, slotStepMinutes
  status: DRAFT | OPEN | PROPOSED | CONFIRMED | CANCELLED
  finalizedStart, finalizedEnd, finalizedLocation
  expenseRound ◄── contador para invalidar transferencias viejas

Participant (21)
  gatheringId, name, contact, avatarUrl
  googleSubject ◄── auth legacy
  authUserId    ◄── auth Supabase
  dietaryPreferences[], mealArrangement, paymentAlias
  isOrganizer   ◄── ÚNICO rol que existe (booleano)
  responseToken ◄── @default(cuid())  ⚠️ CREDENCIAL NO SEGURA
  expensesReadyAt

Availability (64)      participantId, startsAt, endsAt, kind(AVAILABLE|MAYBE|UNAVAILABLE)
Expense (18)           gatheringId, paidByParticipantId, description, amountCents(Int)
TransferConfirmation(1) gatheringId, from, to, amountCents, expenseRound
Proposal (0)           ◄── TABLA MUERTA, nunca se escribe
PurchasePlan (3)       includeAlcohol, ageConfirmed, participantBaseline
PurchaseItem (29)      key, label, unit, quantity, category, assignedParticipantId, isReady
PurchaseContribution(2) purchaseItemId, participantId, description, quantity, isReady
CatalogProduct (43)    key, categoryKey, name, brand, visualKey, isAlcohol
CatalogPresentation(84) productId, key, label, unit
UserPaymentProfile (2) authUserId, paymentAlias  ◄── único dato cross-juntada
```

### Lo que el modelo NO tiene

| Entidad de la visión | ¿Existe? | Nota |
|---|---|---|
| `User` | ❌ | No hay tabla. Sólo `authUserId` suelto en `Participant` |
| `Group` (recurrente) | ❌ | No existe. Cada juntada es una isla |
| `Rsvp` (voy/no sé/no voy) | ❌ | `Availability` es scheduling, no confirmación |
| `Invitation` | ❌ | El slug ES la invitación. Sin trazabilidad |
| `Item` libre | ❌ | Sólo 9 keys fijas del catálogo hardcodeado |
| `Contribution` / vaquita | ❌ | No existe concepto de "poné $8.000" |
| `ExpenseSplit` | ❌ | **Todo se divide en partes iguales entre todos** |
| `ExpensePayer` (múltiple) | ❌ | Un solo `paidByParticipantId` |
| `Settlement` persistido | ❌ | Se recalcula en cada request |
| `Activity` | ❌ | Sólo eventos efímeros por socket |
| `Notification` | ❌ | No existe |
| `Template` | 🟡 | `templateGatheringId` duplica una juntada propia, pero no hay plantillas de sistema |

**`UserPaymentProfile` es la pista importante.** Es la única tabla que reconoce que una persona existe **más allá** de una juntada. Ese es exactamente el eje sobre el que hay que construir `User` y `Group`.

---

## 5. Flujo actual del usuario

**Camino del organizador:**

```
Landing (demo falso hardcodeado: "Asado con los pibes", demoSlots)
  → botón "Crear una juntada"
  → formulario: título, organizador, avatar, ubicación (mapa),
                fecha desde, fecha hasta, hora inicio, hora fin, duración
  → POST /gatherings → slug
  → navigate a /j/:slug
  → compartir (navigator.share o portapapeles)
```

**Camino del invitado:**

```
Recibe link por WhatsApp  ← preview genérico, no dice de qué juntada se trata
  → abre /j/:slug
  → GET /gatherings/:slug  (público, devuelve todo)
  → si no hay sesión en localStorage → dialog "sumate"
  → escribe nombre + elige emoji
  → POST /gatherings/:id/participants → responseToken → localStorage
  → marca bloques horarios (debounce 600ms → PUT availability)
  → ve coincidencias
  → [más tarde] carga gastos → ve quién le transfiere a quién
```

**Fricciones medidas en pasos:**

| Acción | Pasos hoy | Pasos ideales |
|---|---|---|
| Crear juntada | 9 campos | 2 (nombre + "el sábado") |
| Decir "voy" | Imposible como acción directa; hay que marcar bloques horarios | 1 toque |
| Sumarse | 2 (nombre, avatar) | 1 |
| Cargar gasto | 2 campos | 2 ✅ |

---

## 6. Fortalezas actuales — **KEEP**

Esto está bien hecho y hay que conservarlo:

1. **Dinero en enteros de centavos.** `Expense.amountCents Int` ([schema.prisma:130](sale-juntada-back/prisma/schema.prisma)). Nunca float. Correcto y no negociable.

2. **Minimización de transferencias.** El algoritmo greedy deudores↔acreedores en [gatherings.service.ts:1547-1569](sale-juntada-back/src/gatherings/gatherings.service.ts) produce el mínimo práctico de transferencias. Es exactamente lo que la visión pide en la Etapa 7.

3. **Reparto del resto sin perder centavos.** `baseShare + (index < remainder ? 1 : 0)` ([:1502](sale-juntada-back/src/gatherings/gatherings.service.ts)) garantiza que la suma de lo adeudado sea exactamente el total. No se evapora ni se inventa un centavo.

4. **Zonas horarias resueltas del lado del servidor.** [slots.ts](sale-juntada-back/src/gatherings/slots.ts) genera los slots en la zona de la juntada con doble pasada para bordes de horario de verano. `setAvailability` además rechaza horarios fuera de la grilla ([:633-648](sale-juntada-back/src/gatherings/gatherings.service.ts)). Esto es sutil y está bien hecho.

5. **`expenseRound` como invalidador de transferencias.** Cuando se agrega/edita/borra un gasto, `reopenExpenses` incrementa la ronda ([:1755-1782](sale-juntada-back/src/gatherings/gatherings.service.ts)) y las confirmaciones viejas dejan de aplicar. Diseño correcto para un problema real.

6. **`avatarUrl` restringido.** Sólo emoji, data URI o `*.googleusercontent.com` ([dto/avatar.ts](sale-juntada-back/src/gatherings/dto/avatar.ts)). Cierra la cosecha de IPs vía `<img src>`.

7. **Claim de items con concurrencia real.** `updateMany({ where: { assignedParticipantId: null } })` + verificación de `count === 0` ([:1876-1894](sale-juntada-back/src/gatherings/gatherings.service.ts)). Es un compare-and-swap correcto, no un read-then-write.

8. **`ValidationPipe` con `whitelist` + `forbidNonWhitelisted`** ([main.ts:25-31](sale-juntada-back/src/main.ts)). Rechaza campos no declarados. Buena postura por defecto.

9. **Helmet + CORS con lista explícita** ([main.ts:20-24](sale-juntada-back/src/main.ts)).

10. **Tests que efectivamente prueban lógica de negocio.** Los 37 tests del backend cubren settlements, slots y auth. No son tests de humo vacíos.

---

## 7. Problemas actuales

### 🔴 P0-1 — `responseToken` no es criptográficamente seguro

**Archivo:** [sale-juntada-back/prisma/schema.prisma:83](sale-juntada-back/prisma/schema.prisma)
**Ruta:** `Participant.responseToken String @unique @default(cuid())`

**Problema:** `cuid()` (v1, el que genera Prisma) se compone de: prefijo `c` + timestamp en base36 + contador incremental + fingerprint de la máquina + 4 bytes de aleatoriedad derivada de `Math.random()`. Está documentado explícitamente como **no apto para secretos**. Ese token es la **única credencial** para: cargar y borrar gastos, confirmar transferencias, editar la compra, finalizar la juntada y cancelarla.

El contraste dentro del mismo repositorio es elocuente: el `slug` usa `randomBytes(8)` con un comentario que explica por qué ([gatherings.service.ts:197-199](sale-juntada-back/src/gatherings/gatherings.service.ts)). El token que protege la plata quedó en `cuid()`.

**Impacto:** quien obtenga un token cercano en el tiempo (por ejemplo, otro participante de la misma juntada, que ve su propio token) reduce enormemente el espacio de búsqueda para adivinar los de otros. Con el token de otra persona se pueden borrar sus gastos o confirmar transferencias en su nombre.

**Recomendación:** migrar a `randomBytes(32).toString("base64url")` generado en aplicación. Es una migración compatible: agregar la generación en el servicio, rotar tokens existentes en una migración, mantener la columna.

---

### 🔴 P0-2 — Los endpoints de plata son públicos con sólo el ID

**Archivo:** [sale-juntada-back/src/gatherings/gatherings.controller.ts](sale-juntada-back/src/gatherings/gatherings.controller.ts)

| Endpoint | Línea | Auth | Devuelve |
|---|---|---|---|
| `GET /gatherings/:slug` | 52 | ninguna | participantes, avatares, disponibilidad, **lat/long exacta** |
| `GET /:gatheringId/matches` | 124 | ninguna | quién puede y quién no, por nombre |
| `GET /:gatheringId/purchase` | 228 | ninguna | plan de compras completo |
| `GET /:gatheringId/expenses/settlement` | 395 | **ninguna** | **quién debe cuánto a quién, con nombres** |

**Problema:** el `gatheringId` (cuid) viaja en el body de `GET /gatherings/:slug`, que es público. Pero además el settlement es accesible con sólo el ID, sin siquiera el slug. No hay verificación de que quien pregunta sea participante.

**Impacto:** el estado financiero completo de un grupo — nombres reales, montos, deudas — es legible por cualquiera que obtenga un ID. Un ID filtrado en una captura de pantalla, un log o el historial del navegador expone toda la juntada. Sumado a que `locationLatitude/Longitude` es la casa de alguien, el riesgo no es sólo financiero.

**Recomendación:** exigir `x-participant-token` válido en `matches`, `purchase` y `settlement`. Para `getBySlug`, separar en dos respuestas: una pública mínima (título, fecha, cuántos van) para la pantalla de "sumate", y una completa sólo con token.

---

### 🔴 P0-3 — Sin idempotencia en la creación de gastos

**Archivo:** [sale-juntada-back/src/gatherings/gatherings.service.ts:1331-1344](sale-juntada-back/src/gatherings/gatherings.service.ts)

```ts
return this.prisma.$transaction(async (transaction) => {
  await this.reopenExpenses(transaction, gatheringId);
  return transaction.expense.create({ data: { ... } });   // ← sin clave de idempotencia
});
```

**Problema:** dos POST idénticos crean dos gastos. En móvil, con conexión lenta, el doble toque es el comportamiento por defecto del usuario. El frontend tiene `isSavingExpense` como guarda, pero es estado de UI: no sobrevive a un reintento de red, a un back/forward, ni a un service worker reintentando.

**Impacto:** `$42.000` de carne cargado dos veces cambia lo que paga **cada** integrante del grupo. Es el peor error posible para la confianza en una app de plata, y es silencioso.

**Recomendación:** header `Idempotency-Key` (UUID generado en el cliente por intento) + índice único parcial `@@unique([gatheringId, idempotencyKey])`. Reintento con la misma clave devuelve el gasto ya creado, no uno nuevo.

---

### 🔴 P0-4 — El WebSocket no autentica la suscripción

**Archivo:** [sale-juntada-back/src/gatherings/gatherings.gateway.ts:37-42](sale-juntada-back/src/gatherings/gatherings.gateway.ts)

```ts
@SubscribeMessage("gathering:watch")
async watch(client: Socket, payload: { gatheringId: string }) {
  if (!payload.gatheringId) return;
  await client.join(this.room(payload.gatheringId));   // ← sin validar nada
  this.broadcastPresence(payload.gatheringId);
}
```

**Problema:** `gathering:join` sí valida el token contra la base ([:60-68](sale-juntada-back/src/gatherings/gatherings.gateway.ts)), pero `gathering:watch` no valida nada. Cualquiera con un `gatheringId` entra a la sala y recibe todos los eventos: presencia con nombres, quién está escribiendo un gasto, cada cambio de compra.

**Impacto:** vigilancia pasiva de un grupo en tiempo real.

**Recomendación:** `watch` debe exigir el mismo par `participantId` + `participantToken` que `join`.

---

### 🟠 P1-5 — División en partes iguales, sin excepción posible

**Archivo:** [sale-juntada-back/src/gatherings/gatherings.service.ts:1490-1511](sale-juntada-back/src/gatherings/gatherings.service.ts)

```ts
const baseShare = Math.floor(totalCents / participantCount);
```

**Problema:** `participantCount` es **todos los que están en la juntada**, sin excepción. No hay tabla `ExpenseSplit`. No se puede: excluir a quien no comió, dividir desigual, dividir por porcentaje, ni marcar que alguien pagó sólo lo suyo.

Y hay un efecto perverso concreto: **alguien que abrió el link y puso su nombre pero nunca fue, paga igual.** Como sumarse no requiere confirmar asistencia (no hay RSVP), la lista de participantes y la lista de quienes van son la misma cosa.

**Impacto:** este es el techo funcional del producto. Splitwise, Tricount y Splid resuelven esto desde hace años. Es la razón principal por la que un grupo abandonaría Sale Juntada al segundo uso.

**Recomendación:** tabla `ExpenseSplit(expenseId, participantId, shareCents)`. El caso común (partes iguales) se genera automáticamente y la UI ni lo muestra; los casos raros se vuelven posibles. Ver §21.

---

### 🟠 P1-6 — El link de WhatsApp no dice de qué juntada se trata

**Archivo:** [sale-juntada-front/index.html:14-21](sale-juntada-front/index.html)

```html
<meta property="og:title" content="Sale Juntada — Coordinar sin vueltas" />
<meta property="og:image" content="/og.png" />
```

**Problema doble:**
1. Los metadatos son **estáticos**. `salejuntada.com/j/asado-abc123` y `salejuntada.com/j/cumple-xyz789` muestran exactamente el mismo preview en WhatsApp. No existe `sale-juntada-front/api/preview.ts` en `main` (verificado).
2. `og:image` es una **ruta relativa**. Los crawlers de WhatsApp y Facebook requieren URL absoluta. La imagen probablemente no se muestra en absoluto.

**Impacto:** este es el punto exacto donde se juega la viralidad. El link pegado en el grupo de WhatsApp es la primera impresión del producto para 8 personas a la vez. Hoy dice una frase de marketing genérica en lugar de "Asado con los pibes — 5 de 8 ya respondieron".

**Recomendación:** edge function en Vercel que intercepte `/j/:slug`, consulte la API y devuelva HTML con OG dinámicos para user-agents de bots, y el SPA para el resto. Ver §24.

---

### 🟠 P1-7 — La landing es una simulación, no el producto

**Archivo:** [sale-juntada-front/src/App.tsx:73, 347-353, 544](sale-juntada-front/src/App.tsx)

```ts
const demoSlots: Slot[] = [ ... ];                       // :73
const [eventName, setEventName] = useState("Asado con los pibes");   // :347
const [yourSlots, setYourSlots] = useState(["fri-21", "sat-21", "sun-20"]);
if (!activeGathering) return demoSlots;                  // :544
```

**Problema:** el USUARIO A (nunca escuchó de Sale Juntada) aterriza en una interfaz con datos falsos ya cargados: una juntada que no existe, con horarios ya seleccionados. Puede tocar y "usar" la app sin que nada de eso sea real.

**Impacto:** confusión sobre qué es real. Y arquitectónicamente: el estado de demo y el estado real viven en las mismas 47 variables de `useState`, lo que hace que cada cambio futuro tenga que razonar sobre ambos mundos.

**Recomendación:** separar `LandingPage` (estática, vendedora, con un CTA) de `GatheringPage` (real). Requiere routing (ver P1-9).

---

### 🟠 P1-8 — `GatheringsService` es un God Object de 2.086 líneas

**Archivo:** [sale-juntada-back/src/gatherings/gatherings.service.ts](sale-juntada-back/src/gatherings/gatherings.service.ts)

Una sola clase con más de 30 métodos públicos que abarcan: creación de juntadas, generación de slots, matching, perfiles alimentarios, catálogo de compras, asignación de responsables, aportes, gastos, settlements, alias de pago, transferencias y vinculación de identidad.

**Impacto:** cada cambio toca un archivo que nadie puede tener entero en la cabeza. Es el principal obstáculo para que el roadmap avance rápido.

**Recomendación:** dividir en servicios por dominio dentro del mismo módulo (ver §17). No microservicios — sólo archivos separados con responsabilidades claras.

---

### 🟠 P1-9 — No hay routing

**Archivo:** [sale-juntada-front/src/App.tsx:568](sale-juntada-front/src/App.tsx)

```ts
const match = locationState.pathname.match(/^\/j\/([^/]+)$/);
```

`BrowserRouter` está montado en [main.tsx:26](sale-juntada-front/src/main.tsx) pero **no hay un solo `<Route>`** en todo el proyecto (verificado con grep). El ruteo es una regex dentro de un `useEffect` en un componente de 3.302 líneas.

**Impacto:**
- Imposible hacer code splitting por ruta → el bundle inicial carga todo.
- "Mis juntadas" no tiene URL propia: vive dentro de `AccountDialog` ([AccountDialog.tsx:54](sale-juntada-front/src/components/AccountDialog.tsx)), un modal detrás del botón de avatar. No se puede compartir ni volver con el botón atrás.
- No hay pantalla de grupo, de perfil ni de historial posible sin refactor.

---

### 🟡 P2-10 — Catálogo de compras con dos fuentes de verdad

**Archivos:** [gatherings.service.ts:58-122](sale-juntada-back/src/gatherings/gatherings.service.ts) (array hardcodeado de 9 keys) y las tablas `CatalogProduct` / `CatalogPresentation` (43 + 84 filas en producción).

El array del código define **las categorías** (`meat`, `salad`, `ice`, `beer`…); la base define **los productos concretos** dentro de cada categoría. Agregar una categoría requiere deploy de código. Y `legacyPurchaseKeys` ([:124](sale-juntada-back/src/gatherings/gatherings.service.ts)) mantiene keys muertas (`bread`, `water`, `fernet`, `wine`) para no romper datos viejos.

**Impacto:** la visión pide "lista de cosas para llevar" libre — "hielo", "el parlante", "la reposera de Nico". Hoy sólo se puede elegir entre 9 casilleros fijos.

---

### 🟡 P2-11 — Sin validación de rango en la creación

**Archivo:** [gatherings.service.ts:206-213](sale-juntada-back/src/gatherings/gatherings.service.ts)

`create()` valida la franja horaria y la zona, pero **no valida que `windowStart < windowEnd`**. `updateGathering` sí lo hace ([:441-443](sale-juntada-back/src/gatherings/gatherings.service.ts)). Una juntada creada con el rango invertido genera cero slots y queda inutilizable sin mensaje de error.

---

### 🟡 P2-12 — Caché de direcciones sin límite

**Archivo:** [locations.service.ts:23, 80](sale-juntada-back/src/locations/locations.service.ts)

```ts
private readonly cache = new Map<string, LocationSearchResult[]>();
// ...
this.cache.set(cacheKey, results);   // nunca se limpia, nunca se limita
```

Cada búsqueda única queda en memoria para siempre. Vector de agotamiento de memoria trivial: variar la query.

---

### 🟡 P2-13 — Tabla `Proposal` muerta

`Proposal` tiene 0 filas en producción y no hay un solo `proposal.create` en el código. Se lee en `getBySlug` ([:340](sale-juntada-back/src/gatherings/gatherings.service.ts)) y se borra en `updateGathering`, pero nunca se escribe. **REMOVE.**

---

### 🟡 P2-14 — Dos sistemas de autenticación en paralelo

- `addGoogleParticipant` → valida contra `oauth2.googleapis.com/tokeninfo` ([:551-601](sale-juntada-back/src/gatherings/gatherings.service.ts)), usa `Participant.googleSubject`.
- `addAuthenticatedParticipant` → valida JWT de Supabase, usa `Participant.authUserId`.

El frontend sólo usa el segundo. El primero es código muerto con superficie de ataque propia. **REMOVE** (previa verificación de que no haya `googleSubject` en uso en producción).

---

## 8. Deuda técnica

| # | Deuda | Archivo | Acción |
|---|---|---|---|
| 1 | `GatheringsService` 2.086 líneas | `gatherings.service.ts` | REFACTOR |
| 2 | `App.tsx` 3.302 líneas, 47 `useState` | `App.tsx` | REFACTOR |
| 3 | Sin routing real | `App.tsx:568` | REFACTOR |
| 4 | Tabla `Proposal` muerta | `schema.prisma:156` | REMOVE |
| 5 | Auth Google legacy | `gatherings.service.ts:551` | REMOVE |
| 6 | `legacyPurchaseKeys` | `gatherings.service.ts:124` | REMOVE tras migración |
| 7 | React Query montado y sin usar | `main.tsx:11` | REFACTOR (usarlo o sacarlo) |
| 8 | Chunk `maps` de 1.053 kB | `vite.config.ts` | REFACTOR |
| 9 | Sin CI | — | BUILD |
| 10 | Presencia en `Map` en memoria | `gatherings.gateway.ts:33` | REFACTOR antes de escalar |
| 11 | Caché de ubicaciones sin tope | `locations.service.ts:23` | REFACTOR |
| 12 | `MobileExperience.tsx` 1.530 líneas | `components/` | REFACTOR |
| 13 | Sin `Currency` en `Expense` | `schema.prisma:123` | BUILD (aunque sea ARS fijo explícito) |
| 14 | 3 `package-lock.json` sin workspaces | raíz | REFACTOR (opcional) |

---

## 9. Problemas UX — simulación de los 5 usuarios

### USUARIO A — Nunca escuchó hablar de Sale Juntada

| | |
|---|---|
| **Qué entiende** | Que sirve para coordinar horarios. El copy es claro: "Que coincidir sea la parte fácil" |
| **Qué NO entiende** | Que también maneja gastos y compras. La landing no lo menciona |
| **Dónde se confunde** | Ve "Asado con los pibes" con horarios ya marcados y no sabe si es real ([App.tsx:347](sale-juntada-front/src/App.tsx)) |
| **Fricción** | El formulario pide 9 campos, incluido "duración en minutos" — un concepto de calendario corporativo, no de asado |
| **Dónde abandona** | En el formulario de creación, al ver fecha desde / fecha hasta / hora inicio / hora fin |

**Diagnóstico:** el producto se presenta como una herramienta de scheduling. La visión quiere que se presente como "organizá la juntada".

---

### USUARIO B — Recibió un link por WhatsApp ← **el usuario más importante**

| | |
|---|---|
| **Qué entiende** | Nada, antes de abrir. El preview dice "Sale Juntada — Coordinar sin vueltas", no de qué juntada se trata ([index.html:16](sale-juntada-front/index.html)) |
| **Qué NO entiende** | Quién lo invitó, a qué, cuándo, quiénes ya dijeron que van |
| **Dónde se confunde** | Al abrir, lo primero que ve es un diálogo pidiendo su nombre ([App.tsx:617](sale-juntada-front/src/App.tsx) → `setShowJoin(true)`) antes de mostrarle de qué se trata |
| **Fricción** | Se le pide identificarse **antes** de darle contexto. Es al revés de como funciona la confianza |
| **Dónde abandona** | En el preview de WhatsApp, sin abrir. O en el diálogo de nombre |

**Diagnóstico:** este es el punto de mayor pérdida del producto y el más barato de arreglar. Dos cambios: OG dinámico + mostrar la juntada antes de pedir el nombre.

---

### USUARIO C — Organiza seguido

| | |
|---|---|
| **Qué entiende** | El flujo, ya lo hizo antes |
| **Qué NO encuentra** | Sus juntadas anteriores. Están en `AccountDialog`, detrás del botón de avatar, sin URL propia ([AccountDialog.tsx:54](sale-juntada-front/src/components/AccountDialog.tsx)) |
| **Fricción** | Repetir el asado de todos los meses = llenar los 9 campos de nuevo. `templateGatheringId` existe en el backend y funciona, pero está enterrado |
| **Qué falta** | Grupos. "Los pibes" son las mismas 8 personas cada vez y hay que reinvitarlas una por una, cada vez |
| **Dónde abandona** | Vuelve a WhatsApp, que al menos recuerda quiénes son "los pibes" |

**Diagnóstico:** el producto no tiene memoria social. Esta es la mayor oportunidad de retención sin explotar.

---

### USUARIO D — Sólo quiere saber cuánto tiene que pagar

| | |
|---|---|
| **Qué entiende** | El resultado final es claro y está bien resuelto |
| **Fricción** | Tiene que esperar a que **todos** marquen "listo" (`allReady`) para ver el número. Si una persona nunca lo marca, nadie ve nada ([:1605](sale-juntada-back/src/gatherings/gatherings.service.ts)) |
| **Dónde abandona** | Preguntando por WhatsApp "che, ¿cuánto le debo a Juan?" |

**Diagnóstico:** el gate `allReady` es correcto conceptualmente (evita pagar sobre una cuenta incompleta) pero no tiene salida de emergencia. Falta que el organizador pueda forzar el cierre.

---

### USUARIO E — Pagó varias cosas

| | |
|---|---|
| **Qué entiende** | Cargar gastos es simple: descripción + monto |
| **Qué NO puede hacer** | Decir que la carne la pagó entre dos. Decir que el vino no lo toma nadie más. Excluir a quien no fue |
| **Fricción** | Riesgo real de cargar el mismo gasto dos veces sin darse cuenta (P0-3) |
| **Dónde abandona** | Cuando la división en partes iguales le resulta injusta y no hay forma de corregirla |

---

### Problemas transversales de UX

| Categoría | Hallazgo |
|---|---|
| **Jerarquía visual** | La disponibilidad domina la pantalla; gastos y compras quedan abajo. El orden refleja el modelo de datos, no la prioridad del usuario |
| **Navegación** | Sin rutas → sin botón atrás coherente, sin deep links, sin compartir una sección |
| **CTA** | "Crear una juntada" y "Ver cómo funciona" compiten en el hero sin jerarquía clara |
| **Onboarding** | No existe. Se entra directo a una interfaz llena |
| **Formularios** | "Duración en minutos" y "franja horaria" son lenguaje de calendario, no de juntada |
| **Feedback** | Bien resuelto: `notice` + toasts + estado "En vivo"/"Reconectando" ([App.tsx:1655](sale-juntada-front/src/App.tsx)) |
| **Responsive** | Bien: `MobileDashboard` + `MobileBottomNav` separados del layout desktop |
| **Accesibilidad** | Buena base: `aria-label` en botones, `role="status"`, respeto por `prefers-reduced-motion` (hay un test e2e dedicado) |
| **Consistencia** | Rota entre el mundo demo y el mundo real: los mismos componentes con datos falsos o reales |
| **Info excesiva** | La grilla de disponibilidad muestra todos los slots de hasta 31 días |
| **Info faltante** | No se ve quién confirmó asistencia (porque no existe el concepto) |

---

## 10. Problemas de arquitectura

**CURRENT — un módulo que hace todo**

```
gatherings/
  gatherings.service.ts   ← scheduling + compras + gastos + settlements + identidad
  gatherings.controller.ts ← 30 endpoints
  gatherings.gateway.ts
  dto/ (17 archivos)
```

**PROPOSED — dominios separados dentro del mismo monolito** (detalle en §17)

**REASON:** hoy agregar RSVP obliga a tocar el mismo archivo donde vive el cálculo de settlements. Los dominios no comparten reglas de negocio; comparten un archivo por accidente histórico.

**Otros problemas estructurales:**

1. **El frontend no tiene capa de dominio.** `App.tsx` mezcla estado de UI, estado de servidor, lógica de negocio y presentación. React Query está montado pero prácticamente sin usar: el estado de servidor se maneja a mano con `useState` + `useEffect` + `fetch`.

2. **Autorización dispersa.** Cada método del servicio repite el mismo patrón de verificación (`findFirst` + comparar token). Debería ser un Guard de Nest, no 20 copias del mismo `if`.

3. **El gateway habla directo con Prisma** ([gatherings.gateway.ts:60](sale-juntada-back/src/gatherings/gatherings.gateway.ts)), saltándose la capa de servicio.

---

## 11. Problemas de escalabilidad

| Escala | ¿Aguanta? | Qué se rompe primero |
|---|---|---|
| **1.000 usuarios** | ✅ Sí | Nada. La arquitectura actual está sobrada |
| **10.000** | 🟡 Con ajustes | Búsqueda de ubicaciones (ver abajo); caché sin tope; Supabase free tier |
| **100.000** | ❌ No sin cambios | Presencia en memoria; sin paginación; sin caché de settlements |
| **1.000.000** | ❌ Requiere rediseño | Pero **no hay que resolverlo ahora** |

### Los tres cuellos de botella reales

**1. Búsqueda de ubicaciones — límite duro de ~0,9 req/segundo para toda la aplicación**

[locations.service.ts:39-50](sale-juntada-back/src/locations/locations.service.ts): una cola global (`this.requestQueue`) serializa **todas** las búsquedas de **todos** los usuarios, con 1,1s de espera entre cada una. No es por usuario: es global.

Con 50 personas creando juntadas simultáneamente, la última espera ~55 segundos. Es el límite más bajo de todo el sistema y aparece mucho antes que cualquier otro.

**Recomendación:** mover la caché a Redis o a una tabla, y ante todo permitir concurrencia (Nominatim limita por IP, no exige serialización total). Alternativa: proveedor con plan pago (MapTiler/Stadia ya son necesarios para los tiles).

**2. Presencia en memoria — rompe con más de una instancia**

[gatherings.gateway.ts:33](sale-juntada-back/src/gatherings/gatherings.gateway.ts): `private readonly members = new Map<string, LiveMember>()`.

Con 2+ máquinas en Fly, cada una conoce sólo a sus propios conectados. Los usuarios ven presencia parcial e inconsistente. **Esto bloquea el escalado horizontal**, que es lo primero que se hace bajo carga.

**Recomendación:** adaptador de Redis para Socket.IO (`@socket.io/redis-adapter`).

**3. Sin paginación en ningún lado**

`getBySlug` trae todos los participantes con todas sus disponibilidades. Con 40 participantes × 31 días × varios slots, la respuesta crece rápido. `getExpenseSettlement` trae todos los gastos y recalcula todo en cada request.

**Recomendación (no urgente):** cachear el settlement invalidado por `expenseRound`.

### Índices

Los advisors de Supabase reportan 10 índices sin uso (`Gathering_status_windowStart_idx`, `Participant_authUserId_idx`, etc.). **No hay que tocarlos:** con 11 juntadas el planner no los usa porque el seq scan es más barato. Serán necesarios cuando haya volumen. Ignorar por ahora.

---

## 12. Riesgos de seguridad

| # | Riesgo | Severidad | Archivo |
|---|---|---|---|
| 1 | `responseToken` con `cuid()` no criptográfico | 🔴 Crítico | `schema.prisma:83` |
| 2 | Settlement financiero público por ID | 🔴 Crítico | `gatherings.controller.ts:395` |
| 3 | `gathering:watch` sin autenticación | 🔴 Alto | `gatherings.gateway.ts:37` |
| 4 | Sin idempotencia en gastos | 🔴 Alto | `gatherings.service.ts:1331` |
| 5 | Lat/long exacta en respuesta pública | 🟠 Medio | `gatherings.service.ts:322` |
| 6 | `addParticipant` sin credencial alguna | 🟠 Medio | `gatherings.controller.ts:63` |
| 7 | Caché de ubicaciones sin tope | 🟠 Medio | `locations.service.ts:23` |
| 8 | RLS habilitado con 0 políticas en 13 tablas | 🟡 Latente | Supabase |
| 9 | Leaked password protection deshabilitado | 🟡 Bajo | Supabase Auth |
| 10 | Swagger expuesto salvo `ENABLE_SWAGGER=false` | 🟡 Bajo | `main.ts:33` |

### Detalle de los que no se explicaron arriba

**#5 — Ubicación exacta pública.** `getBySlug` devuelve `locationLatitude` y `locationLongitude` sin filtrar. Es la casa de alguien, expuesta a quien tenga el link. **Recomendación:** devolver coordenadas sólo a participantes autenticados; a los no participantes, sólo `locationHint` textual ("Yerba Buena").

**#6 — `addParticipant` sin credencial.** [controller:63](sale-juntada-back/src/gatherings/gatherings.controller.ts) no pide nada. Las mitigaciones existentes (tope de 40, choque de nombres, throttle global de 120/min) ayudan pero el throttle es **global para toda la API**, no por endpoint. **Recomendación:** `@Throttle` específico en join y creación. No hay ni un solo `@Throttle` en el código (verificado con grep).

**#8 — RLS sin políticas.** Las 13 tablas tienen RLS habilitado y **cero** políticas. Hoy no rompe nada porque el backend se conecta con el rol de servicio vía Prisma (que hace bypass de RLS). Pero es una trampa: el día que alguien consulte desde el cliente con la anon key, o falle así, no hay defensa en profundidad. **Recomendación:** documentar explícitamente que el acceso a datos es sólo vía API, o escribir políticas `deny all` explícitas.

**Lo que está bien:** no hay SQL crudo (Prisma parametriza todo), no hay `dangerouslySetInnerHTML` (React escapa por defecto), CORS con lista blanca, Helmet activo, secretos fuera del repo (`.env` en `.gitignore`), `avatarUrl` restringido. CSRF no aplica porque la autenticación va por headers, no por cookies.

---

## 13. Funcionalidades faltantes

Contrastando la visión (§6 del brief) contra el código:

| Etapa | Funcionalidad | Estado |
|---|---|---|
| 1 — Idea | Crear juntada rápido | 🟡 Existe, pero con 9 campos |
| 2 — Invitación | Link | ✅ |
| 2 | Botón WhatsApp explícito | ❌ Sólo `navigator.share` genérico |
| 2 | Preview del link | ❌ **Estático y roto** |
| 2 | QR | ❌ |
| 3 — Confirmación | ✅ Voy / ❓ No sé / ❌ No voy | ❌ **No existe** |
| 3 | +1 (acompañante) | ❌ |
| 4 — Organización | Items para llevar | 🟡 Sólo 9 categorías fijas |
| 4 | Items libres | ❌ |
| 4 | "Falta alguien para el hielo" | 🟡 Se ve, pero no se pide activamente |
| 5 — Vaquita | Objetivo + quién puso | ❌ **No existe** |
| 6 — Durante | Cargar gasto rápido | ✅ |
| 6 | Múltiples pagadores | ❌ |
| 6 | División desigual / excluir / % / unidades | ❌ **Ninguna** |
| 7 — Cierre | Quién le paga a quién, minimizado | ✅ **Bien resuelto** |
| 8 — Pago | Copiar alias | ✅ |
| 8 | CBU/CVU, QR, link MP | ❌ |
| 8 | Marcar pagado / confirmar recepción | ✅ |
| 9 — Historial | Ver juntadas pasadas | 🟡 En un modal, sin URL |
| 9 | Duplicar juntada | 🟡 Backend sí, UI enterrada |
| — | Grupos recurrentes | ❌ **No existe** |
| — | Plantillas (Asado/Cumple/Viaje) | ❌ |
| — | Encuesta de lugar | ❌ |
| — | Recordatorios / push | ❌ |
| — | Feed de actividad | ❌ |
| — | Comentarios | ❌ |
| — | Fotos | ❌ |
| — | Analytics | ❌ **Ni un evento** |
| — | PWA | ✅ Instalable |
| — | Offline | 🟡 Sólo shell cacheado |
| — | OCR de tickets | ❌ |

---

## 14. Análisis competitivo

### Qué hacen mejor que nosotros

| App | Fortaleza | Nuestro estado |
|---|---|---|
| **Splitwise** | Grupos persistentes con balance acumulado entre juntadas | ❌ Cada juntada es una isla |
| **Splitwise** | División por %, por partes, por monto exacto | ❌ Sólo partes iguales |
| **Splitwise** | "Simplify debts" entre múltiples eventos | 🟡 Sólo dentro de una juntada |
| **Tricount** | Funciona sin cuenta, muy simple | ✅ **Empatamos o ganamos** |
| **Tricount** | Multi-moneda con tipo de cambio | ❌ Sin campo de moneda |
| **Splid** | Offline-first real | 🟡 Sólo shell |
| **Settle Up** | Escaneo de tickets (OCR) | ❌ |
| **Todas** | Exportar a CSV/PDF | ❌ |
| **Todas** | Recordatorios de deuda | ❌ |

### Qué NO deberíamos copiar

1. **El onboarding de Splitwise.** Exige cuenta antes de hacer nada. Es lo contrario de nuestro principio de fricción mínima y de nuestra mayor ventaja.
2. **La densidad de Splitwise.** Su UI es una planilla. Nosotros somos mobile-first y social; la estética importa.
3. **Multi-moneda desde el día uno.** Tucumán, pesos. YAGNI. Basta con dejar el campo listo.
4. **Categorías de gasto elaboradas.** Nadie clasifica "carne" como "Alimentación > Carnicería" en un asado.
5. **Notificaciones de cobro agresivas.** Culturalmente equivocado acá. Entre amigos, la app no debe ser el cobrador.

### Qué problemas resuelven que nos faltan

1. División desigual (P1-5) — **el más importante**.
2. Balance persistente entre eventos del mismo grupo.
3. Recordatorios de deuda pendiente.
4. Historial exportable.

### Qué podría hacer Sale Juntada que ellos NO priorizan

Acá está el diferencial, y es real:

1. **Toda la etapa previa.** Splitwise entra en escena cuando ya gastaste. Nosotros podemos estar desde el "¿sale algo?". **Ninguno de los cuatro competidores organiza el evento.**
2. **"Quién trae qué".** Es un problema social resuelto hoy por WhatsApp y la memoria de alguien. Nadie lo estructura.
3. **Vaquita anticipada.** "Ponemos $8.000 cada uno" es un patrón argentino que ninguna app internacional modela.
4. **Grupos recurrentes con evento.** Splitwise tiene grupos, pero para gastos, no para "fútbol de los jueves".
5. **Alias de pago argentino nativo.** Ya está: `UserPaymentProfile.paymentAlias` con validación de formato de alias ([:2021-2030](sale-juntada-back/src/gatherings/gatherings.service.ts)).
6. **WhatsApp-first de verdad.** Preview rico, formato de mensaje pensado para pegar en el grupo.

**Conclusión:** el diferencial no está en dividir mejor, está en **llegar antes**. Cuando Splitwise entra, nosotros ya tenemos al grupo adentro hace una semana.

---

## 15. Nueva propuesta de producto

### El reposicionamiento

**CURRENT:** "Encontrá el mejor día y horario para juntarte con tu grupo."
Un solucionador de calendarios que además anota gastos.

**PROPOSED:** "De 'sale algo?' a 'quedó todo pago'."
Una capa de organización sobre el grupo de WhatsApp, que acompaña las 9 etapas.

**REASON:** el posicionamiento actual compite con Doodle y When2meet, mercados chicos y resueltos. El propuesto compite con "el caos del grupo de WhatsApp", que es enorme y no tiene dueño.

### El cambio conceptual central

**CURRENT — la disponibilidad es la puerta de entrada:**
```
Crear con rango de fechas → todos marcan bloques → matching → confirmar
```
Le exige a 8 personas resolver un problema combinatorio antes de que alguien pueda decir "voy".

**PROPOSED — el RSVP es la puerta de entrada, la disponibilidad es opcional:**
```
Crear ("Asado", "el sábado")
  → compartir
  → cada uno: ✅ Voy / ❓ No sé / ❌ No voy      ← 1 toque
  → [OPCIONAL] si la fecha no está definida, encuesta de fechas
  → quién trae qué
  → gastos
  → cierre
```

**REASON:** el 80% de las juntadas argentinas ya tienen fecha cuando alguien dice "sale asado el sábado". El matching de horarios es el caso del 20%, y hoy es obligatorio para todos. Invertir esa relación es el cambio de producto más importante de esta auditoría.

**Nota importante:** el matching **no se tira**. Está bien hecho y resuelve un caso real. Pasa de ser el camino obligatorio a ser una función opcional ("¿todavía no saben qué día? Hacé una encuesta").

### Las tres pantallas del producto

```
1. LANDING          — qué es, un CTA. Sin demo falso
2. JUNTADA (/j/:slug) — el corazón. Progresiva según la etapa:
                        Voy/No voy → Qué llevamos → Gastos → Cierre
3. MIS JUNTADAS     — historial, grupos, repetir. Con URL propia
```

---

## 16. Modelo de dominio propuesto

Evaluación entidad por entidad de las 17 propuestas en el brief:

| Entidad | ¿Crear? | Cuándo | Razón |
|---|---|---|---|
| `User` | ✅ Sí | P0 | Ya existe implícito (`authUserId` + `UserPaymentProfile`). Formalizarlo |
| `Group` | ✅ Sí | P4 | Clave para retención, pero no antes de que el evento suelto funcione |
| `Gathering` | ✅ Existe | — | KEEP, renombrar conceptualmente a Event en la UI |
| `Participant` | ✅ Existe | — | KEEP. Es el "EventMember" del brief |
| `Invitation` | 🟡 Parcial | P5 | El slug alcanza para el MVP. Se necesita cuando haya analytics de invitación |
| `Rsvp` | ✅ Sí | **P1** | **La pieza faltante más importante** |
| `Item` | ✅ Sí | P2 | Reemplaza el catálogo hardcodeado, permite items libres |
| `ItemAssignment` | ❌ No | — | YAGNI: `Item.assignedParticipantId` alcanza. Sólo si se necesitan varios responsables |
| `Contribution` (vaquita) | ✅ Sí | P3 | Patrón argentino, diferencial real |
| `Expense` | ✅ Existe | — | KEEP |
| `ExpensePayer` | ❌ No aún | P3+ | YAGNI. Un pagador cubre el 95%. Modelar para poder agregarlo después |
| `ExpenseSplit` | ✅ Sí | **P3** | **Desbloquea todos los casos de división** |
| `Settlement` | ❌ No | — | Se calcula. Persistirlo introduce inconsistencia. `TransferConfirmation` ya cubre lo necesario |
| `PaymentRequest` | ❌ No | — | YAGNI hasta Mercado Pago |
| `Activity` | ✅ Sí | P5 | Habilita feed, notificaciones y analytics con una sola tabla |
| `Notification` | ❌ No aún | P5 | Derivar de `Activity` primero |
| `Template` | 🟡 Parcial | P4 | `templateGatheringId` ya existe. Faltan plantillas de sistema (Asado, Cumple, Viaje) |

### Diagrama del modelo propuesto

```
User (nuevo — formaliza authUserId)
 │  id, authUserId, displayName, avatarUrl, paymentAlias
 │  ← absorbe UserPaymentProfile
 │
 ├──< GroupMember >── Group (P4)
 │                     │  "Los pibes", "Fútbol jueves"
 │                     │
 └──< Participant ──── Gathering ──┐  (groupId opcional)
        │                          │
        │  ┌───────────────────────┤
        │  │                       │
        ▼  ▼                       ▼
      Rsvp (P1)              Item (P2)          Expense
      status: GOING          label libre         │
              MAYBE          assignedTo          ├──< ExpenseSplit (P3)
              NOT_GOING      isReady             │     participantId
      plusOnes: Int                              │     shareCents
                                                 │
      Availability (KEEP)    Contribution (P3)   TransferConfirmation (KEEP)
      ← ahora opcional       targetCents
                             paidCents
                             Activity (P5) ← todo lo anterior escribe acá
```

---

## 17. Arquitectura propuesta

### Backend — modular monolith

**CURRENT:**
```
src/gatherings/gatherings.service.ts   ← 2.086 líneas, todo
```

**PROPOSED:**
```
src/
├── shared/
│   ├── prisma/
│   ├── auth/                      SupabaseAuthService
│   └── guards/
│       ├── participant.guard.ts   ← reemplaza 20 copias del mismo if
│       └── organizer.guard.ts
├── gatherings/                    crear, editar, cerrar, cancelar, duplicar
├── participants/                  sumarse, vincular identidad, perfil
├── scheduling/                    slots, availability, matching  ← ya casi aislado en slots.ts
├── rsvp/                          NUEVO (P1)
├── items/                         lista de cosas para llevar (P2)
├── expenses/                      gastos + splits
├── settlements/                   balances, minimización, transferencias
├── contributions/                 vaquita (P3)
├── groups/                        grupos recurrentes (P4)
├── activity/                      feed + analytics (P5)
└── realtime/                      gateway + adaptador Redis
```

**REASON:** cada carpeta tiene un dueño conceptual claro. Sigue siendo un monolito: un deploy, una base, transacciones locales. No hay red entre módulos. Si algún día uno necesita separarse, la costura ya está hecha.

**Regla de dependencias:** los módulos de dominio pueden depender de `shared/`, nunca entre sí lateralmente. La composición ocurre en los controladores.

### Autorización — de 20 `if` a un Guard

**CURRENT** — repetido en cada método ([ejemplo](sale-juntada-back/src/gatherings/gatherings.service.ts):1600):
```ts
const participant = await this.prisma.participant.findFirst({ where: { id, gatheringId } });
if (!participant) throw new NotFoundException(...);
if (!participantToken || participant.responseToken !== participantToken) {
  throw new UnauthorizedException(...);
}
```

**PROPOSED:**
```ts
@UseGuards(ParticipantGuard)
@Post(":gatheringId/expenses")
addExpense(@CurrentParticipant() participant: Participant, @Body() dto: AddExpenseDto) { ... }
```

**REASON:** un solo lugar donde se decide quién puede qué. Hoy, agregar un rol nuevo obliga a revisar 20 métodos y confiar en no olvidarse de ninguno.

### Frontend

**PROPOSED:**
```
src/
├── routes/
│   ├── LandingPage.tsx        /
│   ├── GatheringPage.tsx      /j/:slug        ← lazy
│   ├── MyGatheringsPage.tsx   /mis-juntadas   ← lazy, sale del modal
│   └── GroupPage.tsx          /g/:slug        ← lazy (P4)
├── features/
│   ├── rsvp/  items/  expenses/  settlement/  scheduling/
├── shared/ (ui, hooks, lib)
└── services/ (api client por dominio)
```

Con `<Route>` reales + `React.lazy`, `maplibre-gl` (1.053 kB) sólo se carga en la pantalla que muestra el mapa. Hoy pesa en el bundle inicial de todos.

**Y usar React Query de verdad:** ya está montado e instalado ([main.tsx:11](sale-juntada-front/src/main.tsx)). Reemplaza la mayoría de los 47 `useState` y los 7 `useEffect` con fetch manual, y resuelve caché, revalidación y estados de carga gratis.

---

## 18. Cambios de base de datos requeridos

Hay datos reales en producción (11 juntadas, 18 gastos). Todas las migraciones deben ser **aditivas y compatibles hacia atrás**.

### P0 — Seguridad e integridad

```prisma
model Participant {
  // CAMBIO: generar en aplicación con randomBytes(32), no cuid()
  responseToken String @unique      // migración: rotar los existentes
}

model Expense {
  idempotencyKey String?
  currency       String  @default("ARS")   // explícito, aunque hoy sea siempre ARS
  @@unique([gatheringId, idempotencyKey])
}
```

### P1 — RSVP

```prisma
enum RsvpStatus { GOING MAYBE NOT_GOING }

model Rsvp {
  id            String      @id @default(cuid())
  participantId String      @unique
  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade)
  status        RsvpStatus
  plusOnes      Int         @default(0)
  respondedAt   DateTime    @default(now())
}
```

**Migración de datos:** los 21 participantes existentes → `status: GOING` (es lo que la app asumía implícitamente).

### P2 — Items libres

```prisma
model Item {
  id            String   @id @default(cuid())
  gatheringId   String
  label         String              // libre: "hielo", "el parlante"
  quantity      Int      @default(1)
  unit          String?
  categoryKey   String?             // opcional, para el catálogo visual
  assignedParticipantId String?
  isReady       Boolean  @default(false)
  createdByParticipantId String?
  position      Int      @default(0)
  @@index([gatheringId, position])
}
```

`PurchaseItem` / `PurchaseContribution` se mantienen durante la transición y se migran a `Item` cuando la UI nueva esté lista.

### P3 — Splits y vaquita

```prisma
model ExpenseSplit {
  id            String @id @default(cuid())
  expenseId     String
  participantId String
  shareCents    Int                 // suma == Expense.amountCents (invariante)
  @@unique([expenseId, participantId])
}

model Contribution {
  id            String   @id @default(cuid())
  gatheringId   String
  targetCents   Int                 // "$8.000 cada uno"
  description   String
  createdAt     DateTime @default(now())
}

model ContributionPayment {
  id             String   @id @default(cuid())
  contributionId String
  participantId  String
  amountCents    Int
  confirmedAt    DateTime @default(now())
  @@unique([contributionId, participantId])
}
```

**Migración de los 18 gastos existentes:** generar `ExpenseSplit` en partes iguales entre los participantes de cada juntada, replicando exactamente el comportamiento actual (incluido el reparto del resto). El cálculo del settlement pasa a leer splits en vez de dividir; con esta migración, los números no cambian para nadie.

### P4 — Grupos

```prisma
model Group {
  id        String  @id @default(cuid())
  slug      String  @unique
  name      String
  createdBy String
}

model GroupMember {
  groupId  String
  userId   String
  role     GroupRole @default(MEMBER)
  @@id([groupId, userId])
}

model Gathering {
  groupId String?    // opcional: una juntada puede no pertenecer a ningún grupo
}
```

### P5 — Actividad

```prisma
model Activity {
  id            String   @id @default(cuid())
  gatheringId   String
  participantId String?
  type          String              // "rsvp.changed", "expense.created", ...
  payload       Json
  createdAt     DateTime @default(now())
  @@index([gatheringId, createdAt])
}
```

### Limpieza

```prisma
model Proposal { }         // REMOVE — 0 filas, nunca se escribe
model Participant {
  googleSubject String?    // REMOVE tras verificar que no haya filas con valor
}
```

---

## 19. Estrategia guest/user

Este es el mecanismo central de crecimiento y hay que diseñarlo con cuidado.

### CURRENT

Ya existe una base parcial ([gatherings.service.ts:1962-2004](sale-juntada-back/src/gatherings/gatherings.service.ts)):

```
Guest se suma → Participant { name, responseToken }        (sin authUserId)
Guest crea cuenta → linkAuthenticatedParticipant()
                    → Participant.authUserId = identity.id
```

El endpoint pide **ambas** credenciales: el `responseToken` del participante Y el JWT de Supabase ([controller:93-107](sale-juntada-back/src/gatherings/gatherings.controller.ts)). Eso es correcto: prueba que quien reclama la participación efectivamente la controlaba.

**Limitación:** sólo vincula **la juntada que está abierta en ese momento**. Si Pedro participó en 4 juntadas como invitado y después crea cuenta, recupera 1.

### PROPOSED

```
1. Pedro abre el link, escribe "Pedro"
   → Participant { responseToken: randomBytes(32) }
   → localStorage: { gatheringId → { participantId, responseToken } }

2. [Semanas después] Pedro crea cuenta
   → el cliente recorre TODAS las sesiones en localStorage
   → POST /users/me/claim-participations
       body: [{ gatheringId, participantId, responseToken }, ...]
   → el backend valida cada par y vincula todas las que verifiquen

3. Resultado: Pedro ve su historial completo
```

**REASON:** el momento del registro es el único en que se puede capturar todo el historial de una persona. Si sólo se vincula la juntada actual, se pierde el 75% del valor que justifica crear la cuenta.

**Reglas de seguridad:**
- La vinculación exige **siempre** el `responseToken` original. Nunca vincular por coincidencia de nombre o email.
- Si ya existe un `Participant` con ese `authUserId` en esa juntada, no duplicar: preferir el existente (ya implementado en [:1988-1994](sale-juntada-back/src/gatherings/gatherings.service.ts)).
- La vinculación es irreversible y de un solo sentido.

**Recuperación de sesión perdida** (quien borra datos del navegador): hoy el backend frena los nombres repetidos y ofrece "recuperá tu acceso" ([:528-538](sale-juntada-back/src/gatherings/gatherings.service.ts)), pero **no hay mecanismo real de recuperación** sin cuenta. Propuesta: si la persona tiene cuenta, la recupera automáticamente por `authUserId`. Si no, sólo el organizador puede reasignarle el acceso — la alternativa (recuperar por nombre) permitiría a cualquiera hacerse pasar por otro.

---

## 20. Estrategia de invitaciones

### CURRENT
El slug es la invitación. Sin trazabilidad: no se sabe cuántos abrieron el link ni cuántos se sumaron.

### PROPOSED — tres capas

**Capa 1 — El link (ya existe, KEEP).** `randomBytes(8)` es suficiente.

**Capa 2 — El preview (P1, crítico).** Ver §24.

**Capa 3 — Trazabilidad (P5).** Cuando se quieran medir conversiones:
```prisma
model Invitation {
  id          String @id @default(cuid())
  gatheringId String
  code        String @unique      // ?i=abc123
  createdBy   String
  opens       Int    @default(0)
  joins       Int    @default(0)
}
```
Permite medir el K-factor por invitación individual.

**Explícitamente NO hacer ahora:** invitaciones por email, por SMS, o códigos individuales por persona. Rompen el principio de fricción mínima y en Argentina se comparte por WhatsApp, no por mail.

**Sí agregar (barato, alto impacto):** botón explícito de WhatsApp con mensaje preformateado.
```
https://wa.me/?text={mensaje + link}
```
Hoy sólo hay `navigator.share` genérico ([App.tsx:962](sale-juntada-front/src/App.tsx)), que en desktop no ofrece WhatsApp.

---

## 21. Estrategia de gastos

### El principio rector

> El caso común debe ser de dos campos. Los casos raros deben ser posibles.

### CURRENT

```
Gasto: { descripción, monto, pagadoPor }
División: total / cantidad_de_participantes    ← siempre, sin excepción
```

### PROPOSED

```
Gasto: { descripción, monto, pagadoPor, splits[] }

Al crear un gasto, por defecto:
  splits = partes iguales entre quienes tienen RSVP = GOING
            ← el cambio silencioso más importante: quien no va, no paga

UI progresiva:
  [Descripción] [Monto]                    ← 95% de los casos, sin más
  "Dividir entre todos ▾"                  ← un toque revela:
      ☑ Juan  ☑ Pedro  ☐ Lucas (no fue)
      [Partes iguales | Por monto | Por porcentaje]
```

**REASON:** el 95% de los gastos son "carne, $42.000, la pagué yo, entre todos". Ese caso no debe pedir un campo más que hoy. Pero el 5% restante — "el vino sólo lo tomamos tres" — es justamente el que hace que un grupo abandone la app.

### Integridad financiera

**Invariante:** `SUM(ExpenseSplit.shareCents) == Expense.amountCents`, siempre. Verificado en la transacción de escritura, no como validación posterior.

**Reparto del resto:** reutilizar la lógica ya probada de [gatherings.service.ts:1502](sale-juntada-back/src/gatherings/gatherings.service.ts) (`index < remainder ? 1 : 0`), pero **rotando el orden por gasto** (por ejemplo, con hash del `expenseId`) para que no sea siempre el mismo quien absorbe el centavo extra.

**Concurrencia e idempotencia:**

| Riesgo | Mitigación |
|---|---|
| Doble toque | `Idempotency-Key` + `@@unique([gatheringId, idempotencyKey])` |
| Gasto agregado durante el cierre | `expenseRound` ya lo resuelve — KEEP |
| Split inconsistente | Escribir gasto + splits en una sola transacción |
| Confirmar transferencia obsoleta | Ya validado contra el settlement vigente ([:1716-1726](sale-juntada-back/src/gatherings/gatherings.service.ts)) — KEEP |
| Dos personas editan el mismo gasto | Agregar `version Int` + optimistic locking |

**Moneda:** agregar `currency String @default("ARS")` ahora, aunque nunca se use otro valor. Agregarlo después, con gastos en producción, es una migración con ambigüedad real.

**Nunca:** `Float` para dinero. `Int` de centavos hasta que haga falta `Decimal`. Con `Int` de 4 bytes el techo es ~$21.000.000 por gasto, suficiente; el DTO ya limita a 100.000.000 centavos ([add-expense.dto.ts:13](sale-juntada-back/src/gatherings/dto/add-expense.dto.ts)).

---

## 22. Estrategia de settlements

### CURRENT — está bien y hay que conservarlo

El algoritmo de [gatherings.service.ts:1547-1569](sale-juntada-back/src/gatherings/gatherings.service.ts) ordena deudores y acreedores y los va cruzando greedy. Produce como máximo `n-1` transferencias, que es el mínimo teórico para el caso general. **KEEP sin cambios.**

### Cambios propuestos

**1. Basar los balances en splits, no en división uniforme.**
```
CURRENT:  owedCents = floor(total / participantCount) + resto
PROPOSED: owedCents = SUM(ExpenseSplit.shareCents WHERE participantId = X)
```

**2. Dar una salida al gate `allReady`.**
Hoy si una persona no marca "listo", nadie ve el resultado ([:1605](sale-juntada-back/src/gatherings/gatherings.service.ts)). Propuesta: el organizador puede forzar el cierre. La app avisa a quienes no marcaron.

**3. Balance persistente por grupo (P4).**
Cuando existan grupos, arrastrar el saldo entre juntadas: "Juan te debe $3.000 del asado anterior". Es la funcionalidad de Splitwise que más retiene.

**4. Mantener el settlement calculado, no persistido.**
Un settlement guardado puede quedar inconsistente con los gastos. Recalcular es barato (40 participantes máximo). Si alguna vez pesa, cachear invalidando por `expenseRound` — ya existe el contador.

---

## 23. Estrategia de analytics

### Estado actual: no hay nada. Ni un evento.

### Recomendación: no instalar una herramienta todavía

**REASON:** con 11 juntadas, un dashboard de analytics no dice nada estadísticamente. Y elegir herramienta antes de tener el modelo de eventos lleva a instrumentar mal.

### Propuesta en dos fases

**Fase 1 (P5, junto con `Activity`) — eventos propios en la base.**

La tabla `Activity` de §18 sirve simultáneamente como feed de la juntada y como log de analytics. Un solo esquema, dos usos.

```
event_created         { source: "scratch" | "template" | "group" }
invite_shared         { channel: "whatsapp" | "native" | "clipboard" }
invite_opened         { isFirstVisit }
guest_joined          { timeToJoinMs }
rsvp_set              { status }
item_claimed
expense_created       { splitType: "equal" | "custom" }
settlement_viewed
transfer_confirmed
gathering_closed
gathering_duplicated
user_registered       { fromGuest: boolean, claimedParticipations: number }
```

**Fase 2 — herramienta externa** (PostHog o Umami, ambos con free tier y self-host) cuando haya volumen para justificarla.

### Las métricas que importan

| Métrica | Fórmula | Por qué |
|---|---|---|
| **K-factor** | `invitados_que_crean_juntada / creadores` | > 1 = crecimiento viral |
| **Invitados por juntada** | `AVG(participantes)` | Alcance de cada link |
| **Conversión de link** | `guest_joined / invite_opened` | Mide la calidad del preview y del onboarding |
| **Guest → registrado** | `user_registered[fromGuest] / guest_joined` | Mide si vale la pena tener cuenta |
| **D7 / D30** | Usuarios que vuelven | Retención |
| **Juntadas por usuario** | `COUNT / usuario` | ¿Es ocasional o habitual? |
| **Tasa de cierre** | `gathering_closed / event_created` | ¿Se completa el ciclo o se abandona? |

**La métrica número uno hoy:** conversión `invite_opened → guest_joined`. Es la que mide si el producto funciona como capa sobre WhatsApp, y hoy no se puede medir en absoluto.

**Privacidad:** eventos propios, en la base propia, sin cookies de terceros, sin PII en el payload (IDs, no nombres). Coherente con la postura de privacidad que el proyecto ya tiene.

---

## 24. Estrategia de crecimiento viral

### El loop

```
Alguien crea una juntada
   └→ comparte el link en WhatsApp
        └→ 8 personas VEN el preview        ← 🔴 ROTO HOY
             └→ abren
                  └→ se suman sin cuenta     ← ✅ funciona
                       └→ viven la juntada
                            └→ alguno crea la próxima  ← 🔴 sin camino
```

**Dos eslabones rotos, y son los dos extremos.**

### Arreglo 1 — El preview (P1, máxima prioridad de crecimiento)

**CURRENT** ([index.html:14-21](sale-juntada-front/index.html)): metadatos estáticos e idénticos para toda juntada. `og:image` relativo, que los crawlers rechazan.

**PROPOSED:** edge function en Vercel que intercepte `/j/:slug`:

```
Bot (WhatsApp/Telegram/Twitter)  →  HTML con OG dinámicos
Persona                          →  el SPA de siempre
```

```html
<meta property="og:title"       content="Asado con los pibes" />
<meta property="og:description" content="Sábado 21:00 · Yerba Buena · 5 de 8 confirmaron" />
<meta property="og:image"       content="https://salejuntada.com/api/og/asado-abc123.png" />
```

**REASON:** el link pegado en el grupo es la única impresión que 8 personas reciben del producto, y hoy dice una frase de marketing en vez de decir de qué juntada se trata. Es el cambio con mejor relación impacto/esfuerzo de toda esta auditoría.

*(Nota: esto ya se había construido en la rama abandonada `auditoria/p0-p1-fixes` como `sale-juntada-front/api/preview.ts` y nunca llegó a `main`. Vale la pena revisarlo antes de escribirlo de cero.)*

### Arreglo 2 — Botón de WhatsApp explícito (P1, trivial)

**CURRENT** ([App.tsx:959-976](sale-juntada-front/src/App.tsx)): sólo `navigator.share`, que en desktop no ofrece WhatsApp y en móvil abre un selector genérico.

**PROPOSED:** botón dedicado, verde, que diga WhatsApp, con mensaje preformateado:
```
¿Sale asado? 🔥
Sábado 21:00 · Yerba Buena
Decí si venís 👇
https://salejuntada.com/j/asado-abc123
```

### Arreglo 3 — Cerrar el loop (P4)

Hoy la juntada termina y no pasa nada más. Propuesta: al cerrarse, ofrecer **"Repetir con los mismos"** — un toque que crea la próxima con los mismos participantes preinvitados. El backend **ya lo soporta** (`templateGatheringId`, [service:228-265](sale-juntada-back/src/gatherings/gatherings.service.ts)); falta la superficie de UI en el momento correcto.

### Lo que NO hay que hacer

- Programa de referidos con premios. Artificial para este producto.
- Pedir contactos del teléfono. Rompe la confianza que el producto viene construyendo.
- Bloquear funciones hasta invitar N personas. Coercitivo.
- Gamificación de invitaciones. La motivación ya existe: quieren organizar el asado.

---

## 25. Matriz Impacto / Esfuerzo

```
   ALTO │  ⚡ HACER YA                    │  📌 PLANIFICAR
        │                                 │
        │  • Preview WhatsApp dinámico    │  • ExpenseSplit (división)
        │  • RSVP (Voy/No sé/No voy)      │  • Grupos recurrentes
   I    │  • Idempotencia en gastos       │  • Items libres
   M    │  • Token seguro (randomBytes)   │  • Routing + code splitting
   P    │  • Cerrar endpoints públicos    │  • Vaquita
   A    │  • Botón WhatsApp               │  • Refactor GatheringsService
   C    │  • Auth en socket watch         │  • Refactor App.tsx
   T    │  • CI                           │
   O    │─────────────────────────────────┼──────────────────────────────
        │  🤔 OPORTUNISTA                 │  ❄️ NO AHORA
        │                                 │
        │  • Forzar cierre de gastos      │  • Mercado Pago
   BAJO │  • Validar windowStart<End      │  • OCR de tickets
        │  • Tope a caché de ubicaciones  │  • Multi-moneda
        │  • Borrar Proposal / auth Google│  • Offline real
        │  • Leaked password protection   │  • Push notifications
        │  • og:image absoluto            │  • Encuestas de lugar
        │                                 │  • Comentarios / fotos
        └─────────────────────────────────┴──────────────────────────────
             BAJO ESFUERZO                     ALTO ESFUERZO
```

### Top 10 por relación impacto/esfuerzo

| # | Cambio | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|---|
| 1 | Preview dinámico de WhatsApp | 🔥🔥🔥 | Bajo | **P1** |
| 2 | Idempotencia en gastos | 🔥🔥🔥 | Bajo | **P0** |
| 3 | `responseToken` con `randomBytes` | 🔥🔥🔥 | Bajo | **P0** |
| 4 | Cerrar endpoints de plata | 🔥🔥🔥 | Bajo | **P0** |
| 5 | RSVP | 🔥🔥🔥 | Medio | **P1** |
| 6 | Botón WhatsApp | 🔥🔥 | Trivial | **P1** |
| 7 | Auth en `gathering:watch` | 🔥🔥 | Trivial | **P0** |
| 8 | CI | 🔥🔥 | Bajo | **P0** |
| 9 | `ExpenseSplit` | 🔥🔥🔥 | Alto | **P3** |
| 10 | Grupos recurrentes | 🔥🔥🔥 | Alto | **P4** |

---

## 26. Roadmap

> El brief propone P0–P6. Coincido con la estructura, con **dos correcciones** que el análisis del código justifica:
>
> **Corrección 1 — El preview de WhatsApp sube de P5 a P1.** Está listado como "crecimiento", pero no es una optimización de crecimiento: es el punto donde el producto se presenta a 8 personas a la vez y hoy no funciona. Cuesta poco y multiplica todo lo demás.
>
> **Corrección 2 — El refactor completo de arquitectura baja de P0 a incremental.** El brief pone "arquitectura" en P0. Pero el código actual, aunque tenga un God Object, **funciona y está testeado**. Reescribirlo antes de validar el producto es exactamente la sobreingeniería que el §16 del brief pide evitar. Propongo refactorizar cada dominio **cuando se lo vaya a tocar**, no en un big bang inicial.

---

### P0 — FUNDACIONES (~1 semana)
*No agrega ni una funcionalidad. Cierra lo que puede lastimar a un usuario real.*

| # | Tarea | Archivo |
|---|---|---|
| 1 | `responseToken` con `randomBytes(32)` + rotación | `schema.prisma:83` |
| 2 | Exigir token en `matches`, `purchase`, `settlement` | `gatherings.controller.ts` |
| 3 | Autenticar `gathering:watch` | `gatherings.gateway.ts:37` |
| 4 | `Idempotency-Key` en gastos | `gatherings.service.ts:1331` |
| 5 | Lat/long sólo para participantes | `gatherings.service.ts:322` |
| 6 | CI en GitHub Actions | `.github/workflows/` ⚠️ *ya escrito, sin commitear* |
| 7 | `@Throttle` específico en join y create | `gatherings.controller.ts` |
| 8 | Tope a la caché de ubicaciones | `locations.service.ts:23` |
| 9 | Validar `windowStart < windowEnd` en `create` | `gatherings.service.ts:206` |
| 10 | Borrar `Proposal` y auth Google legacy | varios |
| 11 | Activar leaked password protection | Supabase |

**Criterio de salida:** ningún dato financiero accesible sin credencial; ningún gasto duplicable; CI en verde en cada PR.

---

### P1 — CORE SOCIAL (~2 semanas) ← **el cambio de producto**

| # | Tarea |
|---|---|
| 1 | Modelo `Rsvp` + migración (existentes → `GOING`) |
| 2 | UI de RSVP: tres botones grandes, primer elemento de la pantalla |
| 3 | **Preview dinámico de WhatsApp** (edge function + OG por juntada + `og:image` absoluto) |
| 4 | Botón explícito de WhatsApp con mensaje preformateado |
| 5 | Creación en 2 pasos: nombre + "¿ya saben qué día?" (sí → fecha; no → encuesta) |
| 6 | Ver la juntada **antes** de pedir el nombre |
| 7 | Routing real + `LandingPage` separada del demo falso |
| 8 | Disponibilidad pasa a ser opcional, no la puerta de entrada |

**Criterio de salida:** un invitado ve de qué juntada se trata en el preview de WhatsApp, la abre, entiende, y confirma con un toque.

---

### P2 — ORGANIZACIÓN (~2 semanas)

| # | Tarea |
|---|---|
| 1 | Modelo `Item` con label libre |
| 2 | UI: "¿Qué falta?" con items sugeridos + agregar libre |
| 3 | Reclamar item (reutilizar el compare-and-swap ya probado) |
| 4 | "Falta alguien para el hielo" como pedido activo |
| 5 | Migrar `PurchaseItem` → `Item`, retirar el catálogo hardcodeado |

---

### P3 — DINERO (~2 semanas)

| # | Tarea |
|---|---|
| 1 | Modelo `ExpenseSplit` + migración de los 18 gastos existentes |
| 2 | Splits por defecto entre quienes tienen RSVP `GOING` |
| 3 | UI progresiva de división (colapsada por defecto) |
| 4 | Settlement basado en splits |
| 5 | Vaquita (`Contribution` + `ContributionPayment`) |
| 6 | El organizador puede forzar el cierre |
| 7 | `currency` explícito |

---

### P4 — RETENCIÓN (~3 semanas)

| # | Tarea |
|---|---|
| 1 | Modelo `Group` + `GroupMember` |
| 2 | Pantalla de grupo con historial de eventos |
| 3 | Crear juntada desde un grupo (miembros preinvitados) |
| 4 | "Repetir con los mismos" al cerrar |
| 5 | Plantillas de sistema (Asado, Cumple, Viaje, Fútbol, Previa) |
| 6 | `/mis-juntadas` como página, fuera del modal |
| 7 | Balance persistente entre juntadas del grupo |

---

### P5 — CRECIMIENTO (~2 semanas)

| # | Tarea |
|---|---|
| 1 | Modelo `Activity` (feed + analytics con un solo esquema) |
| 2 | Instrumentar los 12 eventos de §23 |
| 3 | Feed de actividad en la juntada |
| 4 | Dashboard interno de K-factor y conversiones |
| 5 | `Invitation` con trazabilidad |
| 6 | Push notifications (la PWA ya está instalable) |
| 7 | Redis para presencia (desbloquea escalar horizontalmente) |

---

### P6 — AVANZADO (sin fecha)

Mercado Pago · OCR de tickets · sugerencias con IA · multi-moneda · offline real · encuestas de lugar · fotos y comentarios.

**Ninguno de estos importa si el loop de P1 no funciona.**

---

## Anexo — Clasificación KEEP / REFACTOR / REMOVE / BUILD

### ✅ KEEP
Dinero en centavos enteros · algoritmo de minimización de transferencias · reparto del resto sin perder centavos · `slots.ts` con zonas horarias · `expenseRound` · restricción de `avatarUrl` · claim de items con CAS · `ValidationPipe` estricto · Helmet + CORS · `UserPaymentProfile` · flujo de vinculación guest→user · PWA · tests existentes · la elección de infraestructura (Nest + Postgres + Vercel + Fly).

### 🔧 REFACTOR
`GatheringsService` → servicios por dominio · `App.tsx` → rutas + features · autorización → Guards · routing real · usar React Query · presencia → Redis · caché de ubicaciones con tope · `MobileExperience.tsx` · code splitting de `maplibre-gl`.

### 🗑️ REMOVE
Tabla `Proposal` · auth Google legacy (`googleSubject` + `addGoogleParticipant`) · `legacyPurchaseKeys` · catálogo hardcodeado en el servicio · datos de demo en `App.tsx` · `sale-juntada-e2e/e2e-run.log` (sin trackear, ya cubierto por `.gitignore` modificado).

### 🏗️ BUILD
`Rsvp` · `Item` libre · `ExpenseSplit` · `Contribution` (vaquita) · `Group` + `GroupMember` · `Activity` · preview dinámico de WhatsApp · idempotencia · CI · plantillas · `/mis-juntadas` como página.

---

## Nota sobre el estado del working tree

Antes de esta auditoría, en la sesión anterior, quedaron **dos cambios sin commitear** que no forman parte de la auditoría:

- `.github/workflows/ci.yml` (nuevo) — pipeline con tres jobs. Frontend y backend validados en local; el job de e2e **no se llegó a verificar**.
- `.gitignore` (modificado) — se agregó `*.log`.

Corresponden a la tarea P0-6 del roadmap. Quedan a la espera de decisión: commitear o descartar.

*(Resuelto durante la implementación de P0: ambos se conservaron. El job de e2e quedó verificado y activo en CI. Ver [P0_FOUNDATIONS_IMPLEMENTATION.md](P0_FOUNDATIONS_IMPLEMENTATION.md).)*

---

## Post-audit corrections

Correcciones a esta auditoría surgidas durante la implementación de P0. El resto del documento queda tal como se escribió.

### Corrección 1 — Los datos existentes eran de desarrollo, no productivos

La auditoría trató las 11 juntadas, 21 participantes y 18 gastos de Supabase como datos productivos, y de ahí salió la recomendación repetida de "migraciones aditivas y compatibles hacia atrás" (§18) y la advertencia de que "toda migración debe ser aditiva, nunca `db push`".

Son **datos ficticios de desarrollo y testing**. No hay clientes, usuarios ni dinero real. Eso habilita eliminar datos, resetear la base, invalidar tokens y crear migraciones destructivas cuando estén justificadas.

### Corrección 2 — No hace falta compatibilidad hacia atrás con esos registros

Como consecuencia de la corrección 1: **no** se debe construir compatibilidad hacia atrás, tokens legacy, sistemas de doble token, capas de migración ni fallbacks para sostener registros de testing. Antes del lanzamiento conviene una sola estrategia limpia. La auditoría proponía, por ejemplo, rotar tokens conservando los viejos: es innecesario, se invalidan y listo.

### Corrección 3 — La cola de Nominatim es cumplimiento de política, no un cuello de botella accidental

La §11 identificó la cola global de 1,1 segundos de [locations.service.ts](../sale-juntada-back/src/locations/locations.service.ts) como "el límite más bajo de todo el sistema" y recomendó "permitir concurrencia (Nominatim limita por IP, no exige serialización total)".

**Esa recomendación es incorrecta.** La Usage Policy de la API pública de Nominatim permite como máximo **1 request por segundo por aplicación**. La cola global es deliberada y hay que conservarla mientras se use ese proveedor; subir la concurrencia lleva al bloqueo. El problema real era otro y sí se corrigió: la caché sin límite. Cuando el volumen lo justifique, la salida es cambiar de proveedor, no de límite.

### Corrección 4 — El algoritmo de settlements no garantiza el mínimo global

La §6 afirmó que el algoritmo greedy "produce como máximo `n-1` transferencias, que es el mínimo teórico para el caso general", y la §22 lo llamó "el mínimo práctico".

Es **impreciso**. El greedy deudores↔acreedores **simplifica significativamente** la cantidad de transferencias, pero no garantiza el mínimo global para todo conjunto posible de balances: encontrar ese mínimo es un problema NP-difícil, y hay configuraciones donde una asignación distinta produce menos transferencias.

Esto **no es un bug a resolver**. El resultado actual es correcto —las cuentas cierran— y suficientemente bueno para grupos de hasta 40 personas. Aplica YAGNI: se conserva el algoritmo tal cual y se corrige la afirmación.
