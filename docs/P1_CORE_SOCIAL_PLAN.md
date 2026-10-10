# P1 — Core Social: plan

> Planificación sobre la rama `fix/p0-security-integrity`, con el código tal como quedó después de P0.
> **No se modificó código para escribir este documento.**

---

## 1. Executive Summary

P0 dejó la casa segura. P1 tiene que cambiar quién entra por la puerta.

Hoy Sale Juntada le pide a ocho personas que resuelvan un problema de calendario **antes** de que alguien pueda decir "voy". P1 invierte esa relación: decir *voy* pasa a ser el primer gesto, y buscar fecha pasa a ser una herramienta que se enciende sólo cuando hace falta.

El análisis del código posterior a P0 arrojó cuatro hallazgos que definen el plan:

1. **No hace falta ninguna columna nueva para distinguir "juntada con fecha" de "juntada buscando fecha".** `status` + `finalizedStart` ya lo codifican exactamente. La primera versión del plan iba a agregar un `schedulingMode`; el código dice que sobra.
2. **`DRAFT` y `PROPOSED` están muertos.** Verificado: no se escriben ni se leen en ninguna lógica del backend ni del frontend ([grep en `gatherings.service.ts`](../sale-juntada-back/src/gatherings/gatherings.service.ts) sólo usa `OPEN`, `CONFIRMED`, `CANCELLED`). El enum mezcla ciclo de vida con estado de scheduling y arrastra dos valores fantasma.
3. **El chunk de mapas ya está diferido.** La auditoría lo listó como deuda; en realidad `LocationPicker` es un `lazy()` ([App.tsx:51](../sale-juntada-front/src/App.tsx)) y `maps` (1.053 KB) **no** carga en el link de invitación. Lo que sí carga de más son 307 KB de `index.js` con gastos, compras, minijuegos y grilla de disponibilidad, para alguien que sólo quiere decir "voy".
4. **El diálogo de ingreso tapa el contexto.** `showJoin` abre un modal encima de la juntada ([App.tsx:3144](../sale-juntada-front/src/App.tsx)), así que la primera pantalla del invitado le pide el nombre antes de dejarlo entender a qué lo invitaron. Es exactamente al revés de como funciona la confianza.

**Decisión de modelo más importante:** RSVP vive en `Participant`, no en tabla propia. Detalle y contra-argumento en §8.

**Presupuesto de cambio:** una migración, tres campos nuevos, dos rutas, ~9 componentes nuevos y una extracción parcial de `App.tsx`. Nada de `User`, `Group` ni `Activity`.

---

## 2. P1 Product Goal

Que estas seis cosas sean ciertas al terminar:

| Rol | Debe poder |
|---|---|
| **Creador** | Crear una juntada con dos campos, sin configurar un calendario |
| **Invitado** | Abrir el link y entender **qué / cuándo / dónde / cuántos** antes de identificarse |
| **Invitado** | Sumarse sin cuenta, sin email, sin contraseña |
| **Cualquiera** | Decir ✅ / ❓ / ❌ en un toque |
| **Organizador** | Ver cuántos van, en vivo |
| **Grupo** | Seguir teniendo búsqueda de fecha — pero sólo cuando no la saben |

Y una medible: **el link de invitación tiene que cargar menos JavaScript que hoy**, no más.

---

## 3. Current Flow

```
Landing (demo falso: "Asado con los pibes" + demoSlots hardcodeados)
  └→ "Crear una juntada"
       └→ formulario de 9 campos:
          título · organizador · avatar · ubicación (mapa)
          fecha desde · fecha hasta · hora inicio · hora fin · duración
            └→ POST /gatherings  →  navigate(/j/:slug)

Invitado
  └→ abre /j/:slug
       └→ preview de WhatsApp genérico (no dice de qué juntada se trata)
            └→ MODAL "¿cómo te llamás?" encima del contenido
                 └→ POST participants → token en localStorage
                      └→ grilla de disponibilidad (marcar bloques horarios)
                           └→ coincidencias
```

**Lo que el invitado no puede hacer en ningún momento: decir que va.** No existe el concepto.

**Qué carga hoy en `/j/:slug`** (medido sobre `dist/index.html`):

| Chunk | Tamaño |
|---|---|
| `index.js` | 307 KB |
| `react` | 278 KB |
| `motion` | 80 KB |
| `index.css` | 73 KB |
| `realtime` (socket.io) | 41 KB |
| `query` | 24 KB |
| **Total** | **~806 KB** (~230 KB gzip) |

`realtime` se descarga aunque después de P0 el socket **sólo se abre con sesión** ([App.tsx](../sale-juntada-front/src/App.tsx), efecto del socket): un invitado que abre el link por primera vez nunca lo usa.

---

## 4. Proposed Flow

```
LANDING (/)
  qué es Sale Juntada · un CTA · sin demo falso
  └→ "Crear una juntada"

CREAR  (2 pasos, dentro de /)
  ┌ Paso 1 ────────────────────┐
  │ ¿Qué juntada es?           │
  │ [ Asado del sábado      ]  │
  │ ¿Cómo te llamás?           │
  │ [ Tomy                  ]  │
  └────────────────────────────┘
  ┌ Paso 2 ────────────────────┐
  │ ¿Ya saben cuándo?          │
  │ [ Sí, ya sabemos ]         │
  │ [ Todavía no     ]         │
  └────────────────────────────┘
       │                    │
       ▼                    ▼
   fecha + hora          ¿más o menos cuándo?
   (ubicación opc.)      → ventana elegida por
   status = CONFIRMED       el creador
   finalizedStart = fecha  status = OPEN
       │                  finalizedStart = null
       │                    │
       └────────┬───────────┘
                ▼
        /j/:slug  +  botón WhatsApp

INVITADO — juntada CON fecha  (/j/:slug, sin credencial)
  ┌────────────────────────────┐
  │ 🔥 Asado del sábado        │  ← QUÉ
  │ Sábado 21:00               │  ← CUÁNDO
  │ Yerba Buena                │  ← DÓNDE
  │ 5 personas ya se sumaron   │  ← CUÁNTOS (anónimo)
  │ [ Sumarme ]                │
  └────────────────────────────┘
       └→ ¿Cómo te llamás? [ Tomás ]   ← un solo campo
            └→ ┌──────────────────┐
               │ ¿Venís?          │   ← RSVP: sólo existe
               │ [ ✅ Voy      ]  │      porque hay fecha
               │ [ ❓ No sé    ]  │
               │ [ ❌ No voy   ]  │
               └──────────────────┘
                    └→ (si Voy) ¿venís con alguien? [-] 0 [+]

INVITADO — juntada SIN fecha
  ┌────────────────────────────┐
  │ 🔥 Asado con los pibes     │
  │ Buscando fecha             │  ← todavía no hay cuándo
  │ Yerba Buena                │
  │ 5 personas ya se sumaron   │
  │ [ Sumarme ]                │
  └────────────────────────────┘
       └→ ¿Cómo te llamás? [ Tomás ]
            └→ ┌──────────────────┐
               │ ¿Cuándo podés?   │   ← NO hay RSVP.
               │ [grilla horarios]│      Sumarse ya expresa
               └──────────────────┘      el interés
```

**Reducción de pasos:**

| Acción | Hoy | P1 |
|---|---|---|
| Crear juntada | 9 campos | 2 campos + 1 elección |
| Entender la invitación | imposible antes de dar el nombre | inmediato |
| Sumarse | 2 campos (nombre + avatar) | 1 campo |
| Decir que vas | **no existe** | 1 toque *(cuando hay fecha)* |

---

## 5. Organizer Journey

```
1. Landing → "Crear una juntada"
2. Título + su nombre
3. "¿Ya saben cuándo?"
   ├── Sí  → fecha, hora opcional, lugar opcional
   │         status = CONFIRMED · organizador queda en GOING
   └── No  → "¿más o menos cuándo?" → elige una ventana
             status = OPEN · nadie tiene RSVP todavía
4. Aterriza en /j/:slug ya como participante
5. Botón grande de WhatsApp
6. Según el estado:
   ├── CON fecha → ve las respuestas llegar: "5 van · 2 no saben · 1 no va"
   └── SIN fecha → ve la disponibilidad del grupo y las coincidencias
7. Si hubo encuesta: elige la fecha → CONFIRMED
   → ahí recién se habilita el RSVP para todos
   → él queda GOING; el resto arranca sin responder
8. Puede editar fecha/lugar y cancelar
   ⚠️ cambiar la fecha resetea el RSVP del resto (§9)
```

**Qué ve distinto:** el botón de compartir en primer plano, el resumen de asistencia con detalle por persona, el acceso a "cambiar fecha" y "cancelar". Nada más. Los controles administrativos siguen viviendo en `GatheringManagementDialog`, que ya existe y funciona — **no se rediseña en P1**.

**RSVP del organizador:** se crea con `GOING` automáticamente. Quien organiza el asado va al asado; pedirle que lo confirme es fricción sin información.

---

## 6. Guest Journey

El flujo más importante del producto.

```
WhatsApp: "🔥 Asado del sábado · Sábado 21:00 · Yerba Buena
           Decí si venís 👇  salejuntada.com/j/asado-a1b2"
   │
   ├─ preview rico (§16) ─────────► ya entiende antes de tocar
   │
   └─ toca ──► GET /j/:slug SIN token
                └→ proyección pública de P0 (§14): sin nombres, sin avatares
                     │
                     ▼
              ┌──────────────────────────┐
              │ 🔥 Asado del sábado      │
              │ Sábado 21:00             │
              │ Yerba Buena              │
              │ 5 personas ya se sumaron │
              │ [ Sumarme ]              │
              └──────────────────────────┘
                     │
                     ▼  un solo campo, sin cuenta
              ¿Cómo te llamás?  [ Tomás ]  → [ Entrar ]
                     │
                     ▼  POST participants → token → localStorage
                     │
        ┌────────────┴────────────┐
        ▼ hay fecha               ▼ no hay fecha
   ¿Venís? ✅ / ❓ / ❌      ¿Cuándo podés?
   (RSVP)                    (disponibilidad)
```

**La última pantalla depende del estado de la juntada.** Si todavía no hay fecha, no se pregunta si viene: sumarse ya expresó el interés, y lo que falta saber es cuándo puede. Ver §9.

**¿Se puede reducir más?** Se evaluó fusionar nombre + RSVP en una pantalla (`[Tomás] [✅ Voy]`). **Se descarta para P1:** hoy el backend frena nombres duplicados con un 400 que ofrece dos salidas ("recuperá tu acceso" o "entrá con otro nombre", [gatherings.service.ts](../sale-juntada-back/src/gatherings/gatherings.service.ts)). Fusionar los pasos obliga a manejar ese conflicto en la misma pantalla donde la persona ya eligió su respuesta, y complica más de lo que ahorra. Queda anotado como mejora medible para después.

**Lo que NO se pide:** email, contraseña, Google, Supabase. El registro sigue siendo opcional y posterior.

---

## 7. Member Journey

Quien ya se sumó y vuelve a abrir el link:

```
/j/:slug con token en localStorage
  └→ proyección de participante
       ├─ su RSVP actual, destacado y cambiable
       ├─ quiénes van (ahora sí con nombres y avatares)
       ├─ qué falta llevar          → si hay plan de compra
       ├─ gastos                    → después de la juntada
       └─ disponibilidad            → sólo si la juntada la está buscando
```

**No ve** acciones de organizador: ni editar fecha, ni cancelar, ni elegir la fecha final. El backend ya lo garantiza con `requireOrganizer` ([participant-auth.service.ts](../sale-juntada-back/src/participants/participant-auth.service.ts)); el frontend simplemente no las dibuja.

---

## 8. RSVP Decision

### `RECOMMENDED`: Option A — campos en `Participant`

```prisma
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
}
```

### `WHY`

1. **`Participant` ya es exactamente "una persona dentro de una juntada".** Un `Rsvp` sería 1:1 con `Participant`, con la misma clave y el mismo ciclo de vida. Una tabla 1:1 sin datos opcionales pesados es una tabla de más.

2. **`getBySlug` es la query más caliente del producto** — se ejecuta en cada apertura del link — y ya carga `participants`. Tres columnas se leen gratis; una tabla aparte agrega un join en el camino crítico del flujo que P1 viene a optimizar.

3. **RSVP es estado, no historia.** Lo que importa es "¿va o no va ahora?". Nadie pregunta "¿qué respondió Mica el martes?".

4. **El futuro no se cierra.** Si algún día hace falta historial, se agrega un log append-only (`RsvpChange` o el `Activity` de P5) **sin mover el estado actual de `Participant`**. Estado-en-la-entidad + log de eventos aparte es el patrón normal; empezar por la tabla 1:1 no acerca a ese destino, sólo agrega un join hoy.

5. **Contar es trivial:** `groupBy(rsvpStatus)` sobre `Participant`, sin joins.

6. **`rsvpStatus` es opcional (`?`) a propósito.** `null` cubre **dos** situaciones, y el contexto de `Gathering.finalizedStart` alcanza para distinguirlas sin una columna más:

   | `finalizedStart` | `rsvpStatus` | Significa |
   |---|---|---|
   | `null` | `null` | El RSVP **no aplica**: la juntada todavía no tiene fecha |
   | fecha | `null` | Hay fecha y esta persona **todavía no respondió** |
   | fecha | `GOING` / `MAYBE` / `NOT_GOING` | Respondió |

   Agregar un flag para separar los dos `null` sería guardar por segunda vez algo que `finalizedStart` ya dice.

### `WHY NOT THE OTHER`

Option B (tabla `Rsvp`) se justifica cuando: hay historial de cambios, hay RSVPs de gente que no es participante (invitados externos por email), o el RSVP tiene muchos campos propios. **Ninguna de las tres aplica en P1**, y las tres pertenecen a fases que ni siquiera están planificadas. Elegirla ahora sería pagar un join permanente por opcionalidad que no vamos a ejercer.

Es la opción que "suena más arquitectónica" — y por eso conviene decir explícitamente que no.

### plusOnes: **sí, con revelación progresiva**

**Incluir.** Un asado con tres +1 es un asado para once, no para ocho: sin esto el número que ve el organizador —que es el punto entero del RSVP— está mal.

**Sin romper el toque único:** el stepper aparece **después** de elegir `GOING`, por debajo, con valor 0. El RSVP sigue siendo un toque; el +1 es un ajuste opcional.

**Sin nombres de acompañantes.** Un `Int` y nada más.

⚠️ **Deuda que P1 crea deliberadamente:** los `plusOnes` cuentan para la asistencia pero **no** para la división de gastos (P3 todavía no existe). Queda anotado en §26 y es decisión explícita de P3 cómo tratarlos.

---

## 9. Scheduling Strategy

### Las seis preguntas de §16 del brief

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | ¿Cómo se accede? | Sección propia dentro de `/j/:slug`, no una ruta aparte |
| 2 | ¿Cuándo aparece? | Sólo si `status !== CONFIRMED`, o sea si la juntada no tiene fecha |
| 3 | ¿Sólo si no hay fecha definitiva? | Sí. Con fecha confirmada, la grilla desaparece |
| 4 | ¿Puede activarla el organizador? | Sí: "cambiar fecha" vuelve la juntada a `OPEN` y reabre la encuesta |
| 5 | ¿Cómo se relaciona con RSVP? | **Son excluyentes.** Sin fecha hay disponibilidad y no hay RSVP; con fecha hay RSVP y no hay encuesta |
| 6 | ¿Qué pasa al elegir fecha? | `finalizeGathering`: `status = CONFIRMED` + `finalizedStart`. Se oculta la encuesta y **recién ahí nace el RSVP** |

### RSVP y disponibilidad son excluyentes, no ortogonales

> **Corregido.** La primera versión de este plan decía que RSVP y disponibilidad eran independientes y que el RSVP estaba siempre activo. Es incorrecto y produce una falsedad semántica.

**El problema concreto:**

```
La juntada todavía no tiene fecha
  Pedro responde GOING              ← ¿"voy" a qué?
  Pedro marca el jueves UNAVAILABLE
  El organizador elige el jueves
  → Pedro figura GOING el jueves    ← FALSO. Nunca dijo eso.
```

El mismo valor cambiaría de significado según el momento del evento. `GOING` antes de haber fecha significa "me interesa"; después significa "voy ese día". Guardar los dos en la misma columna hace que el dato mienta.

**La regla:**

```
finalizedStart == null   →  ser Participant YA significa "me interesa".
                            No hay RSVP. La pregunta es "¿cuándo podés?".

finalizedStart != null   →  Hay una fecha concreta.
                            La pregunta es "¿venís?".
```

Ser `Participant` de una juntada sin fecha **ya es** la expresión de interés: alguien abrió el link, puso su nombre y se sumó. Pedirle además que confirme algo que todavía no existe es fricción sin información.

### La máquina de estados

```
                    crear
                      │
        ┌─────────────┴──────────────┐
        ▼ sí, ya sabemos             ▼ todavía no
   status=CONFIRMED            status=OPEN
   finalizedStart=fecha        finalizedStart=null
   organizador → GOING         TODOS → rsvpStatus=null
   resto → null                       plusOnes=0
        │                             │
        │                    ┌────────┴────────┐
        │                    │ DISPONIBILIDAD  │
        │                    │ (sin RSVP)      │
        │                    └────────┬────────┘
        │                     organizador elige
        │                     finalizeGathering()
        │                     · organizador → GOING
        │                     · resto → null (nace el RSVP)
        │                             │
        └─────────────┬───────────────┘
                      ▼
              ┌───────────────┐
              │ status=CONFIRMED
              │ RSVP habilitado
              └───────┬───────┘
                      │
      ┌───────────────┼────────────────┐
      ▼               ▼                ▼
 cambia fecha    reabre encuesta   status=CANCELLED
 resetea RSVP    CONFIRMED→OPEN    RSVP bloqueado
 del resto       resetea RSVP
 (org→GOING)     de TODOS
```

**Hallazgo clave: no hace falta ninguna columna nueva.**

El estado y la fecha alcanzan. Ni `schedulingMode`, ni `hasDate`, ni un flag de "RSVP aplica" — sería un tercer lugar guardando la misma verdad.

> **P1.2 final review correction — la equivalencia no vale para las canceladas.**
> Este plan decía `status === CONFIRMED ⟺ finalizedStart !== null`. **Dejó de ser cierto**: desde que cancelar conserva el contexto, una juntada `CANCELLED` puede tener `finalizedStart` cargado. La equivalencia sigue valiendo entre `OPEN` y `CONFIRMED`, pero **no** se puede deducir el estado a partir de la fecha.

### Máquina de estados vigente

| Estado | Fecha | RSVP | Disponibilidad |
|---|---|---|---|
| **`OPEN`** | `finalizedStart = null` | ❌ no aplica | ✅ permitida |
| **`CONFIRMED`** | `finalizedStart != null` | ✅ permitido | ❌ no aplica |
| **`CANCELLED`** | **puede conservarla** | ❌ bloqueado | ❌ bloqueado |

`CANCELLED` es terminal y conserva `finalizedStart`, `finalizedEnd`, `finalizedLocation`, la ventana y el RSVP, para poder mostrar *"iba a ser el 29/08 a las 21:00 en Yerba Buena"*.

### Reglas para la UI (P1.3+)

**No usar `status !== CONFIRMED` para decidir si se muestra la disponibilidad** — con esta semántica incluiría a las canceladas.

```
Disponibilidad   →  status === OPEN
RSVP             →  status === CONFIRMED && finalizedStart != null
Cancelada        →  status === CANCELLED
                    → banner de cancelación
                    → acciones interactivas deshabilitadas
                    → sigue mostrando cuándo y dónde iba a ser
```

**Ningún guard del backend puede deducir "cancelada" de que no haya fecha.** Lo que manda es el estado, y `requireActiveParticipant` lo verifica antes de cualquier chequeo de fecha.

### Reglas de transición (se definen acá; se implementan en P1.2)

Una confirmación de asistencia pertenece a **una fecha concreta**. Si la fecha cambia, la respuesta anterior deja de ser confiable.

| Transición | Organizador | Resto |
|---|---|---|
| **Crear con fecha** | `GOING`, `rsvpAt = now()` | — (todavía no hay nadie) |
| **Crear sin fecha** | `null`, `plusOnes = 0` | `null`, `plusOnes = 0` |
| **`finalizeGathering()`** — nace el RSVP | pasa a `GOING` | `null`, `plusOnes = 0`, `rsvpAt = null` |
| **Cambia una fecha ya confirmada** | se mantiene `GOING` | **reset**: `null`, `0`, `null` |
| **Se reabre la encuesta** (`CONFIRMED → OPEN`) | **reset** | **reset** |
| **`CANCELLED`** | se conserva | se conserva (el endpoint rechaza cambios) |

**No se arrastra una respuesta previa al confirmar**, porque antes del `finalizeGathering` esa respuesta no existía: todos estaban en `null` por definición.

**P1.1 implementa sólo lo mínimo para que el endpoint respete el estado actual** (rechazar RSVP sin fecha y en canceladas). Los resets de `finalizeGathering`, cambio de fecha y reapertura son **P1.2**.

---

## 10. Gathering Lifecycle

### El problema del enum actual

```prisma
enum GatheringStatus { DRAFT  OPEN  PROPOSED  CONFIRMED  CANCELLED }
```

**Verificado en el código:** sólo se usan tres.

| Valor | ¿Se escribe? | ¿Se lee? |
|---|---|---|
| `DRAFT` | ❌ nunca | ❌ nunca |
| `OPEN` | ✅ `updateGathering` al cambiar cronograma; `@default` | ✅ |
| `PROPOSED` | ❌ nunca | ❌ nunca |
| `CONFIRMED` | ✅ `finalizeGathering` | ✅ |
| `CANCELLED` | ✅ `cancelGathering` | ✅ |

`DRAFT` y `PROPOSED` sólo existen en el enum de Prisma y en el tipo TS del frontend ([gatheringService.ts:62](../sale-juntada-front/src/services/gatheringService.ts)).

### ¿Mezcla scheduling con ciclo de vida?

**Sí, un poco** — pero de forma útil, no problemática. `OPEN` significa "buscando fecha" (scheduling) y `CONFIRMED` significa "tiene fecha" (scheduling), mientras que `CANCELLED` es ciclo de vida. Los tres son mutuamente excluyentes en la práctica y ninguna combinación queda sin representar.

**PROPOSED**: quitar `DRAFT` y `PROPOSED`. No inventar estados nuevos.

**Razón para no ir más lejos:** separar `lifecycle` de `schedulingState` en dos columnas sería más "correcto" en abstracto y tocaría `finalizeGathering`, `updateGathering`, `cancelGathering`, `setAvailability` y `ParticipantAuthService` — todo código con tests de P0. Se gana pureza conceptual y se arriesga regresión en la capa que acabamos de asegurar. **YAGNI.** Si en P4 los grupos recurrentes necesitan más estados, ahí se revisa con una razón concreta.

**Lo que P1 no representa y hay que anotar:** no existe un estado "ya pasó". Una juntada de la semana pasada queda `CONFIRMED` para siempre. En P1 se resuelve **derivándolo** de `finalizedEnd < now()` para ordenar el historial, sin columna nueva.

---

## 11. Routing Architecture

### CURRENT

`BrowserRouter` montado en [main.tsx:26](../sale-juntada-front/src/main.tsx) con **cero `<Route>`**. El ruteo es una regex dentro de un `useEffect`:

```ts
const match = locationState.pathname.match(/^\/j\/([^/]+)$/);
```

### PROPOSED

```tsx
<Routes>
  <Route path="/"          element={<LandingPage />} />       {/* lazy */}
  <Route path="/j/:slug"   element={<GatheringPage />} />     {/* lazy */}
  <Route path="*"          element={<NotFoundPage />} />
</Routes>
```

`/mis-juntadas` **no se crea en P1** — pero la estructura `routes/` la admite sin refactor. Hoy el historial vive dentro de `AccountDialog` y ahí se queda.

### Lo que habilita

| | Hoy | P1 |
|---|---|---|
| Code splitting | por componente (`LocationPicker`) | **por ruta** |
| `index.js` en el link de invitación | 307 KB con todo | sólo lo de la juntada |
| Botón atrás | incoherente | coherente |
| 404 | pantalla en blanco | pantalla propia |

### Estados a cubrir

| Estado | Tratamiento |
|---|---|
| Cargando `/j/:slug` | Esqueleto con la forma del hero, no un spinner centrado |
| Slug inválido (404 de la API) | "Esta juntada no existe o el link venció" + CTA a crear una |
| Juntada `CANCELLED` | Se muestra, con banner claro y acciones deshabilitadas |
| Token inválido/vencido | Se degrada **a la vista pública**, no a un error — y se ofrece sumarse de nuevo |
| Red caída | Mensaje + reintentar. Nunca loading infinito |
| Ruta desconocida | `NotFoundPage` |

El caso de token inválido es importante: después de P0 el backend responde `isParticipant: false` en vez de fallar ([gatherings.service.ts](../sale-juntada-back/src/gatherings/gatherings.service.ts)), así que la degradación es natural. Sólo hay que limpiar el `localStorage` que quedó viejo.

---

## 12. Landing Strategy

### El problema

`App.tsx` arranca con estado ficticio:

```ts
const demoSlots: Slot[] = [ ... ];                                    // :73
const [eventName] = useState("Asado con los pibes");                  // :347
const [yourSlots] = useState(["fri-21", "sat-21", "sun-20"]);
if (!activeGathering) return demoSlots;                               // :544
```

El visitante nuevo puede tocar una juntada que no existe. Y arquitectónicamente es peor: el mundo demo y el real comparten las mismas 47 variables de estado, así que cualquier cambio futuro tiene que razonar sobre los dos.

### PROPOSED: eliminar el demo interactivo por completo

`LandingPage` estática:

```
┌───────────────────────────────────┐
│  Sale Juntada                     │
│                                   │
│  De "¿sale algo?"                 │
│  a "quedó todo pago".             │
│                                   │
│  Organizá la juntada donde ya la  │
│  estás organizando: el grupo.     │
│                                   │
│  [ Crear una juntada ]            │
│                                   │
│  ─────────────────────────────    │
│  1. Creás y compartís el link     │
│  2. Cada uno dice si va           │
│  3. Se organiza lo que falta      │
└───────────────────────────────────┘
```

**Sin CTA secundario.** Se evaluó "Ver cómo funciona"; hoy compite con el principal en el hero sin agregar nada — quien quiere ver cómo funciona, crea una. Si más adelante hay datos que digan lo contrario, se agrega.

**Sin enseñar funcionalidades futuras.** La landing responde *qué hace*, no *todo lo que hace*.

Con la extracción, `demoSlots`, `eventName` y `yourSlots` iniciales **desaparecen**, y `GatheringPage` puede asumir que siempre hay una juntada real.

---

## 13. Gathering Page Architecture

### Jerarquía propuesta

```
┌─ HERO ────────────────────────────┐
│ 🔥 Asado del sábado               │   QUÉ
│ Sábado 21:00 · Yerba Buena        │   CUÁNDO · DÓNDE
│ 5 van · 2 no saben                │   QUIÉNES
├─ RSVP ────────────────────────────┤   ¿VOY?   ← el gesto central
│  [ ✅ Voy ]  [ ❓ No sé ]  [ ❌ ] │
│  (si Voy) ¿con alguien? [-] 0 [+] │
├─ COMPARTIR (organizador) ─────────┤
│  [ 📱 Compartir por WhatsApp ]    │
├─ ASISTENCIA ──────────────────────┤
│  Van: Tomy, Sofi, Fede…           │   ← sólo participantes
├─ ¿CUÁNDO NOS VIENE BIEN? ─────────┤
│  (sólo si status !== CONFIRMED)   │   ← scheduling condicional
├─ QUÉ LLEVAMOS ────────────────────┤
│  (colapsado hasta que se use)     │
├─ GASTOS ──────────────────────────┤
│  (colapsado; tiene sentido después)│
└───────────────────────────────────┘
```

**El cambio real** es que hoy la grilla de disponibilidad ocupa el primer scroll y el RSVP no existe. Después de P1, RSVP está arriba y la disponibilidad puede no estar.

### Clasificación de lo existente (§26 del brief)

| Feature | Clase | Tratamiento |
|---|---|---|
| **RSVP** | `PRIMARY` | Nuevo. Inmediatamente bajo el hero |
| **Asistencia** | `PRIMARY` | Nuevo. Resumen + lista para participantes |
| **Compartir WhatsApp** | `PRIMARY` | Destacado para el organizador |
| **Availability / matches** | `CONTEXTUAL` | Sólo si `status !== CONFIRMED` |
| **Purchase planner** | `SECONDARY` | Se conserva entero. Colapsado por defecto |
| **Expenses / Settlements** | `SECONDARY` | Se conservan enteros. Colapsados |
| **LocationPicker** | `CONTEXTUAL` | Sigue `lazy`. Sólo creación y edición |
| **PartyGames** | `HIDDEN UNTIL NEEDED` | Se conserva, detrás de "Más" |
| **PwaStatus** | `HIDDEN UNTIL NEEDED` | Sin cambios |
| **Realtime** | `PRIMARY` (invisible) | Se extiende a RSVP |
| **GatheringManagementDialog** | `CONTEXTUAL` | Sin cambios. Sólo organizador |
| **AccountDialog** | `CONTEXTUAL` | Sin cambios |

**Nada se borra.** Varias cosas dejan de estar en el centro.

### Navegación inferior

`MobileBottomNav` hoy tiene Inicio / Horarios / Compra / Más, con `useActiveSection` siguiendo el scroll. **Cambio mínimo en P1:** "Horarios" pasa a mostrarse sólo cuando la juntada está buscando fecha. El resto queda igual — reescribir la navegación no es necesario para el objetivo de P1.

---

## 14. Public vs Participant View

P0 ya construyó exactamente lo que P1 necesita. **No se agrega ni un campo público.**

### PUBLIC — 22 campos, ninguna identidad

`id`, `slug`, `title`, `description`, `status`, `timeZone`, `windowStart`, `windowEnd`, `durationMinutes`, `dailyStartMinutes`, `dailyEndMinutes`, `slotStepMinutes`, `slots`, `locationHint`, `finalizedStart`, `finalizedEnd`, `finalizedLocation`, `participantCount`, `participants: []`, `locationLatitude: null`, `locationLongitude: null`, `isParticipant: false`, `viewerParticipantId: null`.

Alcanza para el hero completo del invitado: qué, cuándo, dónde aproximado, cuántos.

### P1 no agrega nada a la vista pública

> **Corregido.** La primera versión proponía publicar `rsvpSummary`. Se revirtió.

Cómo respondió el grupo **no es información pública**. Saber que "3 dijeron que no van" es información del grupo, no del link. La prueba social anónima que ya existe —`participantCount`— alcanza para que alguien entienda que la juntada está viva.

**La allowlist pública de P0 queda exactamente igual: 22 campos, ninguno nuevo.**

Se evaluó agregar `respondedCount` (cuántos contestaron, sin decir qué). Se descarta para P1.1: no hace falta para ninguna pantalla del plan, y todo campo público es una decisión que después cuesta revertir. Queda anotado por si aparece una necesidad concreta.

### PARTICIPANT — acá sí

Todo lo público más:

```ts
rsvpSummary: {
  going: number;           // participantes con GOING
  maybe: number;
  notGoing: number;
  pending: number;         // rsvpStatus === null
  goingHeadcount: number;  // suma de (1 + plusOnes) entre los GOING
}
```

y dentro de `participants[]`: nombres, avatares, `isOrganizer`, `availabilities`, **`rsvpStatus`, `plusOnes`, `rsvpAt`**, más `organizerName` y coordenadas exactas.

### Semántica de los contadores

| Campo | Definición | Alcance |
|---|---|---|
| `participantCount` | Cantidad de `Participant` identificados | **público** |
| `going` | `Participant` con `rsvpStatus = GOING` | participante |
| `maybe` / `notGoing` | Ídem con su estado | participante |
| `pending` | `rsvpStatus === null` | participante |
| `goingHeadcount` | `SUM(1 + plusOnes)` entre los `GOING` | participante |

```
Tomy  GOING +0
Mica  GOING +1
Fede  GOING +2

going = 3          ← personas que respondieron que van
goingHeadcount = 6 ← gente que va a haber
```

Permite mostrar **"3 confirmados · 6 personas"** cuando aporta.

**P1 no crea `Participant` ficticios por acompañante.** Un +1 es un número en la fila de quien lo trae, no una persona en la base. P3 decide qué hacen con los gastos.

El test de allowlist de P0 ([gathering-visibility.spec.ts](../sale-juntada-back/src/gatherings/gathering-visibility.spec.ts)) compara el conjunto exacto de claves públicas. Como P1 **no** agrega campos públicos, ese test **debe seguir pasando sin tocarlo**: es la comprobación de que el RSVP no se filtró.

---

## 15. WhatsApp Sharing

### CURRENT

Sólo `navigator.share` genérico ([App.tsx:959](../sale-juntada-front/src/App.tsx)); en desktop no ofrece WhatsApp y en móvil abre un selector.

### PROPOSED

Botón dedicado, verde, que **diga WhatsApp**:

```
https://wa.me/?text=<encodeURIComponent(mensaje)>
```

Mensaje:

```
🔥 Asado del sábado

Sábado 21:00 · Yerba Buena

Decí si venís 👇
https://salejuntada.com/j/asado-a1b2c3
```

Adaptado al estado: con fecha muestra fecha; sin fecha dice *"Elegí cuándo te viene bien 👇"*.

**Detalles que importan en Argentina/móvil:**

- `wa.me` sin número abre el selector de contactos de WhatsApp: exactamente "mandalo al grupo".
- Funciona en web y en móvil, sin depender de `navigator.share`.
- El link va **último**: WhatsApp genera el preview del último enlace.
- Línea en blanco antes del link, para que el preview no se pegue al texto.

**Se mantiene** `navigator.share` como botón secundario "Compartir de otra forma". No se integra WhatsApp Business API.

---

## 16. Dynamic OG Strategy

### El problema

[index.html:14-21](../sale-juntada-front/index.html): metadatos **estáticos**. Toda juntada muestra el mismo preview. Y `og:image` es una ruta relativa (`/og.png`) — los crawlers de WhatsApp y Facebook exigen URL absoluta, así que probablemente hoy no se muestra imagen alguna.

### Alternativas evaluadas contra el stack real (Vite SPA en Vercel + NestJS en Fly)

| Opción | Veredicto |
|---|---|
| **A. Vercel Function + rewrite condicional por user-agent** | ✅ **Elegida** |
| B. Función que envuelve *todo* `/j/:slug` | ❌ Agrega una invocación serverless a cada visita humana: más latencia y costo en el camino crítico que P1 viene a acelerar |
| C. Endpoint HTML en el backend de Fly + rewrite | ❌ Fly está en GRU (una región); el crawler de WhatsApp puede estar en cualquier lado. Además acopla la superficie de marketing a la disponibilidad de la API |
| D. Prerender externo (Prerender.io y similares) | ❌ Servicio de terceros, costo y un salto más para un problema que se resuelve con 40 líneas |
| E. SSR completo (migrar a Next/Remix) | ❌ Reescritura de plataforma para resolver metadatos. Desproporcionado |
| F. Generación estática | ❌ Imposible: los slugs se crean en runtime |

### La solución

```json
{
  "rewrites": [
    {
      "source": "/j/:slug",
      "has": [{
        "type": "header",
        "key": "user-agent",
        "value": ".*(WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|Discordbot|LinkedInBot|SkypeUriPreview).*"
      }],
      "destination": "/api/preview?slug=:slug"
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

La función `api/preview`:

1. Lee `slug`.
2. Llama `GET {API}/api/gatherings/:slug` **sin token** → proyección pública de P0.
3. Devuelve HTML mínimo con OG absolutos y `Cache-Control: s-maxage=300`.
4. Ante cualquier error, cae al `index.html` de siempre: **el preview nunca puede romper el link**.

**Ventaja de fondo:** la privacidad no depende de que la función recuerde filtrar. Consume el mismo endpoint público que P0 ya blindó, y ese endpoint **no tiene** nombres ni avatares para filtrar.

### ⚠️ Riesgo que hay que verificar antes de implementar

Hay **dos `vercel.json`**: uno en la raíz y otro en `sale-juntada-front/`. Cuál gana depende del *Root Directory* configurado en el dashboard de Vercel, y eso determina si la función va en `/api/preview.ts` o en `sale-juntada-front/api/preview.ts`. La rama abandonada `auditoria/p0-p1-fixes` la había puesto en `sale-juntada-front/api/`, lo que sugiere que el root es el front — pero el `vercel.json` de la raíz con `installCommand --prefix` sugiere lo contrario.

**Primera tarea del slice de OG: confirmarlo y eliminar el `vercel.json` duplicado.** Es config contradictoria que va a morder tarde o temprano.

### Imagen

**P1: imagen estática de marca, URL absoluta.** Corrige el bug real (`/og.png` relativo) con una línea.

**Se descarta para P1** generar la imagen dinámicamente (`@vercel/og` / Satori con el título dibujado): agrega una dependencia pesada y tiempo de render en el camino del crawler, para un beneficio estético. El texto del preview ya es dinámico, que es lo que comunica. Queda anotado para P5.

---

## 17. Database Changes

### CURRENT SCHEMA (post-P0)

```prisma
enum GatheringStatus { DRAFT  OPEN  PROPOSED  CONFIRMED  CANCELLED }

model Participant {
  id, gatheringId, name, contact, avatarUrl, authUserId,
  dietaryPreferences, mealArrangement, paymentAlias,
  isOrganizer, responseToken, expensesReadyAt, ...
}
```

### P1 SCHEMA

```prisma
enum GatheringStatus {
  OPEN        // buscando fecha
  CONFIRMED   // tiene fecha
  CANCELLED
}
// DRAFT y PROPOSED se eliminan: nunca se escribieron ni se leyeron.

enum RsvpStatus {
  GOING
  MAYBE
  NOT_GOING
}

model Participant {
  // ...todo lo actual...

  /// Respuesta a la invitación. `null` significa una de dos cosas, y el
  /// `finalizedStart` de la juntada alcanza para distinguirlas: si no hay
  /// fecha, el RSVP no aplica; si hay fecha, todavía no respondió.
  rsvpStatus  RsvpStatus?
  /// Acompañantes. Cuentan para la asistencia; P3 decide qué hacen
  /// con la división de gastos.
  plusOnes    Int         @default(0)
  rsvpAt      DateTime?

  @@index([gatheringId, rsvpStatus])
}
```

**Tres columnas, un índice, un enum nuevo, dos valores muertos menos. Ninguna tabla nueva.**

El índice `[gatheringId, rsvpStatus]` sirve al `groupBy` del resumen de asistencia.

### MIGRATION

`0_init` **queda congelada**. Migración nueva:

```
prisma/migrations/20260826xxxxxx_p1_core_social/migration.sql
```

```sql
CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING');

ALTER TABLE "Participant" ADD COLUMN "rsvpStatus" "RsvpStatus";
ALTER TABLE "Participant" ADD COLUMN "plusOnes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Participant" ADD COLUMN "rsvpAt" TIMESTAMP(3);

CREATE INDEX "Participant_gatheringId_rsvpStatus_idx"
  ON "Participant"("gatheringId", "rsvpStatus");

-- Sin backfill a GOING. Bajo la regla nueva el RSVP sólo aplica cuando hay
-- fecha, así que poner a todos los organizadores en GOING inventaría
-- respuestas para juntadas que todavía están buscando día. El estado
-- inicial correcto es el que dan los defaults: null / 0 / null.
-- El seed crea los ejemplos explícitos.

-- DRAFT y PROPOSED nunca se escribieron. Postgres no permite quitar valores
-- de un enum, así que se recrea el tipo.
ALTER TABLE "Gathering" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "GatheringStatus" RENAME TO "GatheringStatus_old";
CREATE TYPE "GatheringStatus" AS ENUM ('OPEN', 'CONFIRMED', 'CANCELLED');
ALTER TABLE "Gathering" ALTER COLUMN "status"
  TYPE "GatheringStatus" USING ("status"::text::"GatheringStatus");
ALTER TABLE "Gathering" ALTER COLUMN "status" SET DEFAULT 'OPEN';
DROP TYPE "GatheringStatus_old";
```

**Se verifica con `scripts/verify-empty-rebuild.sh`**, que P0 dejó listo. El `USING` falla ruidosamente si alguna fila tuviera `DRAFT` o `PROPOSED` — comprobar antes con un `SELECT DISTINCT status`.

### SEED CHANGES

[`prisma/seed.ts`](../sale-juntada-back/prisma/seed.ts) hoy crea 1 juntada + 4 participantes + disponibilidades + 2 gastos + 3 items. P1 lo lleva a cubrir **los dos modos**:

**Juntada `CONFIRMED`** (con fecha, RSVP habilitado) — un participante por cada estado posible:

| Persona | `rsvpStatus` | `plusOnes` |
|---|---|---|
| Organizador | `GOING` | 0 |
| A | `GOING` | 1 |
| B | `MAYBE` | 0 |
| C | `null` (no respondió) | 0 |
| D | `NOT_GOING` | 0 |

→ `going = 2 · goingHeadcount = 3 · maybe = 1 · notGoing = 1 · pending = 1`

**Juntada `OPEN`** (sin fecha, RSVP no aplica): todos con `rsvpStatus = null`, `plusOnes = 0`, y algunas disponibilidades cargadas para poder probar la encuesta y las coincidencias a mano.

Datos exclusivamente de desarrollo.

---

## 18. API Changes

Principio: **hacer evolucionar lo que existe antes que agregar endpoints**.

### 1. `POST /api/gatherings` — creación mínima

**CURRENT:** `title`, `organizerName`, `windowStart`, `windowEnd` obligatorios; `durationMinutes`, `dailyStartMinutes`, `dailyEndMinutes`, `slotStepMinutes`, ubicación, `timeZone` opcionales ([create-gathering.dto.ts](../sale-juntada-back/src/gatherings/dto/create-gathering.dto.ts)).

**PROPOSED:** `title` y `organizerName` obligatorios. Todo lo demás opcional, más:

```ts
startsAt?: string;   // ISO. Si viene → juntada con fecha
```

Comportamiento:

| Entrada | Resultado |
|---|---|
| Con `startsAt` | `status = CONFIRMED`, `finalizedStart = startsAt`. `windowStart/End` se derivan de ese mismo día. Organizador → `GOING` |
| Sin `startsAt` | `status = OPEN`, `finalizedStart = null`. **`windowStart/windowEnd` los elige el creador.** Encuesta habilitada. Nadie tiene RSVP |

> **Corregido — sin ventana inventada.** La primera versión ponía `hoy → hoy + 14 días` por defecto. Se elimina: es una decisión de agenda que el usuario no tomó, y aparecería en la UI como si la hubiera elegido. Cuando dice "todavía no sabemos", la UI de P1.2 le pregunta *"¿más o menos cuándo?"* (por ejemplo *este finde* / *el finde que viene* / *elegir fechas*) y esa elección llena `windowStart/windowEnd`, que **ya existen** en el schema. Sin `schedulingMode` nuevo.

> **Corregido — `finalizedEnd` no se inventa.** La primera versión ponía `finalizedEnd = startsAt + durationMinutes`. `durationMinutes` pertenece al motor de scheduling —cuánto dura un bloque candidato— y no es lo mismo que cuánto dura la juntada de verdad. Si el creador no dijo a qué hora termina, la respuesta honesta es **`finalizedEnd = null`**. El schema ya lo permite: `finalizedEnd DateTime?`.
>
> ⚠️ Hay que revisar en P1.2 si algún consumidor asume que `finalizedEnd` no es nulo cuando `status = CONFIRMED`; `finalizeGathering` hoy siempre lo setea. **P1.1 no lo toca.**

> **P1.2 final review correction — mover la fecha es una acción propia.**
> La primera implementación derivaba una ventana de un solo día y validaba la fecha nueva contra ella, así que mover la juntada a otro día obligaba a reabrir la búsqueda primero. **Corregido**: cambiar la fecha y reabrir la encuesta son dos acciones distintas.
>
> `finalizeGathering` decide por el estado previo: si la juntada todavía no tiene fecha, es *elegir una opción de la encuesta* y se valida contra la ventana; si ya la tiene, es *mover la juntada de día* y la ventana **se recalcula** al día local de la fecha nueva, sin pasar por `OPEN`. El reset de RSVP y la atomicidad no cambian. Ver [P1_2_CREATION_DATE_LIFECYCLE_IMPLEMENTATION.md §6bis](P1_2_CREATION_DATE_LIFECYCLE_IMPLEMENTATION.md).

**BREAKING?** No. `windowStart/windowEnd` pasan de obligatorios a opcionales: relajar un contrato no rompe a quien ya los manda. El frontend actual sigue funcionando durante toda la transición.

**WHY:** es el corazón de P1. Nueve campos son la fricción número uno del producto. Derivar la ventana (sólo en el caso con fecha, donde "la ventana es ese día" es una descripción honesta) evita tocar `slots.ts`, `setAvailability`, `updateGathering` y `finalizeGathering` — todo código con tests de P0.

### 2. `PUT /api/gatherings/:gatheringId/participants/:participantId/rsvp` — **nuevo**

```
Headers: x-participant-token
Body:    { status: "GOING" | "MAYBE" | "NOT_GOING", plusOnes?: number }
→ { participantId, rsvpStatus, plusOnes, rsvpAt, rsvpSummary }
```

**Reglas del servidor** (ninguna se delega al frontend):

| Condición | Respuesta |
|---|---|
| `finalizedStart == null` | **409** — "La juntada todavía no tiene una fecha confirmada" |
| `status == CANCELLED` | **409** — reutiliza `requireActiveParticipant` de P0 |
| Token ausente / de otra persona / de otra juntada | **401 / 404** — `ParticipantAuthService` |
| `status != GOING` | `plusOnes` se fuerza a `0` |
| `plusOnes` fuera de rango | **400** |
| Mutación válida | `rsvpAt = now()` |

**Idempotente por naturaleza:** dos veces `GOING +1` dejan exactamente el mismo estado. **No lleva `Idempotency-Key`** — la de gastos existe porque un gasto duplicado suma plata; un RSVP duplicado es el mismo RSVP. YAGNI.

**BREAKING?** No, es nuevo.

**WHY nuevo y no parte de otro:** sigue el patrón ya establecido de `.../dietary-profile` y `.../payment-alias` — recurso propio del participante, autorizado con `requireParticipant`. Meterlo en `PATCH .../settings` (que es de organizador) mezclaría niveles de autorización.

### 3. `GET /api/gatherings/:slug` — `rsvpSummary` **sólo para participantes**

**CURRENT:** las dos proyecciones de P0.

**PROPOSED:**

- **Pública:** sin cambios. Ni un campo nuevo. La allowlist de P0 queda igual.
- **Participante:** suma `rsvpSummary` (con `goingHeadcount`) y, dentro de cada `participants[]`, `rsvpStatus`, `plusOnes` y `rsvpAt`.

**BREAKING?** No, aditivo y sólo en la rama privada. El test de allowlist pública de P0 **debe seguir pasando sin tocarlo**.

### 4. `POST /api/gatherings/:gatheringId/participants` — sin cambios en P1.1

Se evaluó aceptar `rsvpStatus?` al sumarse, para fusionar "entrar" y "responder". **Se difiere**: la fusión de pantallas se descartó para P1 (§6), así que el campo no tendría quién lo use. Se revisa si esa decisión cambia.

### 5. Lo que **no** cambia

`finalizeGathering`, `updateGathering`, `cancelGathering`, `setAvailability`, `getMatches`, todo lo de gastos, compras, liquidación y transferencias. **Ni un endpoint de P0 se toca.**

---

## 19. Frontend Changes

### Estructura propuesta

```
src/
├── routes/
│   ├── LandingPage.tsx          BUILD
│   ├── GatheringPage.tsx        BUILD  (recibe lo extraído de App.tsx)
│   └── NotFoundPage.tsx         BUILD
├── features/
│   ├── gathering/
│   │   ├── GatheringHero.tsx    BUILD
│   │   └── useGathering.ts      BUILD  (React Query)
│   ├── rsvp/
│   │   ├── RsvpSelector.tsx     BUILD
│   │   ├── AttendanceSummary.tsx BUILD
│   │   ├── PlusOnesStepper.tsx  BUILD
│   │   └── useRsvp.ts           BUILD  (React Query + optimistic)
│   ├── participants/
│   │   └── JoinGathering.tsx    BUILD  (sale del modal)
│   ├── scheduling/
│   │   └── AvailabilityPoll.tsx REFACTOR (extraído de App.tsx)
│   └── sharing/
│       ├── WhatsAppShareButton.tsx BUILD
│       └── shareMessage.ts      BUILD  (+ test unitario)
├── components/                  KEEP  (todo lo actual)
└── services/                    REFACTOR (agregar rsvp)
```

**No se crean carpetas vacías.** Cada una arriba corresponde a código real de este plan.

### Lo que NO se toca en P1

`MobileExperience.tsx` (1.531 líneas, planner de compras) · `GatheringManagementDialog` · `AccountDialog` · `LocationPicker` · `PartyGames` · `PwaStatus` · `AnimatedDialog` · toda la lógica de gastos y liquidación.

**`App.tsx` no se reescribe.** Se le sacan las dos rutas y las secciones de RSVP; lo demás se mueve tal cual a `GatheringPage`.

**El criterio no es la cantidad de líneas, es la responsabilidad.** Al terminar P1, `App.tsx` no debe seguir siendo responsable directo de: routing, landing, onboarding del invitado, RSVP ni hero de la juntada. Si el resultado son 1.800 o 2.300 líneas es indistinto; lo que importa es que esas cinco cosas vivan en otro lado.

---

## 20. WebSocket Changes

Se reutiliza el gateway de P0 sin infraestructura nueva.

**Backend** — un método más en [`GatheringsGateway`](../sale-juntada-back/src/gatherings/gatherings.gateway.ts), siguiendo el patrón exacto de `expensesChanged` / `purchaseChanged`:

```ts
rsvpChanged(gatheringId: string, activity: {
  participantId: string;
  participantName: string;
  status: RsvpStatus;
}) {
  this.server.to(this.room(gatheringId)).emit("rsvp:changed", activity);
}
```

Lo llama el controlador después del `PUT .../rsvp`, igual que los demás.

**Frontend** — un handler más en el efecto del socket que invalida la query de la juntada.

**La autorización ya está resuelta:** P0 dejó `gathering:watch` exigiendo credencial válida, así que sólo los participantes reciben `rsvp:changed`. Nadie con el link suelto ve las respuestas llegar.

⚠️ **Consecuencia conocida:** un invitado que todavía no se sumó **no** ve el contador subir en vivo — no tiene socket. Es correcto (P0 lo decidió) y basta con que el número esté fresco al cargar.

**Sin cambios** en presencia, typing, ni el `Map` en memoria. Sigue vigente que hace falta adaptador de Redis antes de escalar horizontalmente.

---

## 21. State Management Strategy

### Estrategia: React Query sólo para lo nuevo

React Query ya está montado ([main.tsx:11](../sale-juntada-front/src/main.tsx)) y casi sin usar: hoy el estado del servidor se maneja a mano con 47 `useState` + `useEffect` + `fetch`.

| Flujo | Estrategia |
|---|---|
| `useGathering(slug)` | **React Query** — nuevo |
| `useRsvp()` mutación | **React Query** con update optimista |
| `rsvpSummary` | Derivado de la query de la juntada |
| Gastos, liquidación, compra, disponibilidad | **Sin tocar.** Siguen con `useState` |
| Sesión de participante | **Sin tocar.** `localStorage` por slug |
| Socket | **Sin tocar.** Los handlers invalidan queries en vez de hacer `setState` |

**Por qué el RSVP se lleva bien con optimismo:** es idempotente por naturaleza (poner `GOING` dos veces da `GOING`), así que un rollback ante error es trivial y seguro. Muy distinto de un gasto, donde P0 necesitó idempotencia explícita.

**Por qué no migrar todo:** sería un refactor grande sin cambio de producto, en el mismo PR que cambia el flujo mental. Dos riesgos que conviene no sumar.

---

## 22. Component Plan

| Componente | Acción | Responsabilidad |
|---|---|---|
| `LandingPage` | BUILD | Qué es + un CTA. Sin demo |
| `CreateGatheringFlow` | BUILD | Dos pasos. Reemplaza el formulario de 9 campos |
| `GatheringHero` | BUILD | Qué / cuándo / dónde / cuántos |
| `JoinGathering` | BUILD | Un campo. Deja de ser modal |
| `RsvpSelector` | BUILD | Tres botones grandes |
| `PlusOnesStepper` | BUILD | Aparece tras `GOING` |
| `AttendanceSummary` | BUILD | "5 van · 2 no saben"; con nombres para participantes |
| `WhatsAppShareButton` | BUILD | `wa.me` + fallback |
| `AvailabilityPoll` | REFACTOR | Extraído de `App.tsx`, condicionado a `status !== CONFIRMED` |
| `NotFoundPage` | BUILD | 404 y slug inválido |
| `GatheringPage` | REFACTOR | Orquesta; recibe el grueso de `App.tsx` |
| `MobileBottomNav` | REFACTOR | "Horarios" condicional |
| `MobileExperience` | KEEP | Sin cambios |
| `GatheringManagementDialog` | KEEP | Sin cambios |
| `AccountDialog` · `LocationPicker` · `PartyGames` · `PwaStatus` · `AnimatedDialog` | KEEP | Sin cambios |

### Accesibilidad de `RsvpSelector`

Los tres estados **no** pueden distinguirse sólo por color:

- **Icono** distinto por opción (✓ / ? / ✕), no sólo color
- **Etiqueta** de texto siempre visible
- `role="radiogroup"` + `aria-checked`
- Estado seleccionado con **borde + fondo + icono**, no sólo tinte
- Touch target ≥ 48 px
- Respetar `prefers-reduced-motion`, como ya hace el resto (hay test e2e dedicado)

---

## 23. File-by-file Plan

### Backend

| FILE | ACTION | WHY | RISK |
|---|---|---|---|
| `prisma/schema.prisma` | REFACTOR | 3 campos, enum `RsvpStatus`, podar `GatheringStatus` | **Medio** — recrear el enum necesita `USING` |
| `prisma/migrations/20260826*/migration.sql` | BUILD | Migración P1. `0_init` congelada | Bajo |
| `prisma/seed.ts` | REFACTOR | RSVP variado + juntada sin fecha | Bajo |
| `src/gatherings/dto/create-gathering.dto.ts` | REFACTOR | `windowStart/End` opcionales; sumar `startsAt` | **Medio** — relajar validación |
| `src/gatherings/dto/set-rsvp.dto.ts` | BUILD | DTO nuevo | Bajo |
| `src/gatherings/gatherings.service.ts` | REFACTOR | `create` con dos modos; `setRsvp`; `rsvpSummary` en `getBySlug` | **Alto** — es el archivo más grande y `getBySlug` es el camino crítico |
| `src/gatherings/gatherings.controller.ts` | REFACTOR | Endpoint de RSVP | Bajo |
| `src/gatherings/gatherings.gateway.ts` | REFACTOR | `rsvpChanged` | Bajo |
| `src/gatherings/gathering-visibility.spec.ts` | REFACTOR | Sumar `rsvpSummary` al allowlist | Bajo — **debe** fallar primero |
| `src/gatherings/rsvp.spec.ts` | BUILD | Tests de RSVP | Bajo |
| `src/gatherings/gathering-creation.spec.ts` | BUILD | Fecha fija vs flexible | Bajo |

### Frontend

| FILE | ACTION | WHY | RISK |
|---|---|---|---|
| `src/main.tsx` | REFACTOR | `<Routes>` reales | Bajo |
| `src/App.tsx` | REFACTOR | Pasa a shell de rutas; pierde demo y RSVP | **Alto** — 3.355 líneas, 47 `useState` |
| `src/routes/LandingPage.tsx` | BUILD | Landing real | Bajo |
| `src/routes/GatheringPage.tsx` | BUILD | Recibe lo extraído | **Alto** — mismo riesgo que `App.tsx` |
| `src/routes/NotFoundPage.tsx` | BUILD | 404 | Bajo |
| `src/features/rsvp/*` | BUILD | RSVP completo | Bajo |
| `src/features/gathering/GatheringHero.tsx` | BUILD | Hero | Bajo |
| `src/features/participants/JoinGathering.tsx` | BUILD | Deja de ser modal | Medio — toca el flujo de nombre duplicado |
| `src/features/scheduling/AvailabilityPoll.tsx` | REFACTOR | Extraer grilla | **Alto** — lógica de debounce y rollback ya probada |
| `src/features/sharing/*` | BUILD | WhatsApp | Bajo |
| `src/services/gatheringService.ts` | REFACTOR | `setRsvp` | Bajo |
| `src/hooks/useActiveSection.ts` | REFACTOR | Secciones condicionales | Bajo |
| `src/components/MobileExperience.tsx` | KEEP | — | — |

### Infra

| FILE | ACTION | WHY | RISK |
|---|---|---|---|
| `vercel.json` (raíz) | REFACTOR | Rewrite condicional para bots | **Medio** — un rewrite mal puesto rompe el sitio |
| `sale-juntada-front/vercel.json` | REMOVE | Config duplicada y contradictoria | Medio — **confirmar primero** cuál usa Vercel |
| `api/preview.ts` | BUILD | OG dinámico | Medio — ubicación a confirmar |
| `sale-juntada-front/index.html` | REFACTOR | `og:image` absoluto | Bajo |
| `sale-juntada-e2e/tests/smoke/home.spec.ts` | REFACTOR | Mocks con RSVP | Medio |
| `sale-juntada-e2e/tests/smoke/rsvp.spec.ts` | BUILD | E2E estrella | Bajo |

---

## 24. Test Plan

Tests **antes** de implementar, por slice.

### Backend

| Test | Verifica |
|---|---|
| RSVP se crea con token válido | Camino feliz |
| RSVP se puede cambiar | `GOING → NOT_GOING` |
| RSVP con token de otro participante → 401 | Autorización |
| RSVP con token de **otra juntada** → 404/401 | Aislamiento cruzado |
| RSVP sin token → 401 | Credencial obligatoria |
| RSVP en juntada cancelada → 409 | Reutiliza `requireActiveParticipant` |
| `plusOnes` se fuerza a 0 si no es `GOING` | Regla del servidor |
| `plusOnes` negativo → 400 | Validación del DTO |
| RSVP en juntada **sin fecha** → 409 | **Regla de dominio central** |
| RSVP vuelve a funcionar cuando la juntada se confirma | Contraparte de lo anterior |
| `rsvpSummary` cuenta bien, `pending` incluye `null` | Agregación |
| `goingHeadcount` suma `1 + plusOnes` sólo entre los `GOING` | Headcount |
| **Vista pública NO trae `rsvpSummary` ni RSVP individual** | Privacidad: la allowlist de P0 no cambia |
| Vista de participante sí trae `rsvpSummary` | Proyección privada |
| Vista de participante trae `rsvpStatus` por persona | Proyección |
| `rsvpAt` cambia en cada mutación válida | Timestamp |
| `plusOnes` excesivo → 400 | Límite superior |
| `status` fuera del enum → 400 | Validación del DTO |
| Los 101 tests de P0 siguen verdes | **No regresión** |

*(P1.2)* Crear con `startsAt` → `CONFIRMED` + organizador en `GOING` · crear sin `startsAt` → `OPEN` con la ventana **elegida** · `finalizeGathering` habilita el RSVP y resetea al resto · cambiar fecha resetea · reabrir encuesta resetea a todos.

### Frontend

| Test | Verifica |
|---|---|
| `RsvpSelector` marca el estado elegido | Estado visual |
| `RsvpSelector` no depende sólo del color | Accesibilidad |
| `PlusOnesStepper` sólo aparece con `GOING` | Revelación progresiva |
| Vista de invitado sin sesión muestra hero + "Sumarme" | Guest-first |
| Vista de invitado **no** muestra nombres | Privacidad en la UI |
| `JoinGathering` con un solo campo | Fricción |
| Cambiar RSVP actualiza optimistamente y revierte ante error | Optimistic UI |
| Organizador ve compartir; miembro no | Roles |
| `AvailabilityPoll` no se renderiza si `CONFIRMED` | Scheduling condicional |
| `shareMessage()` arma bien el texto con y sin fecha | Unitario puro |

### E2E — el test estrella de P1

```
tests/smoke/rsvp.spec.ts

1. Organizador entra a "/"
2. Crea "Asado del sábado" con su nombre           ← 2 campos
3. Elige "Sí, ya sabemos" → sábado 21:00
4. Aterriza en /j/:slug y copia el link
5. [contexto nuevo, sin localStorage]              ← simula el invitado
6. Abre /j/:slug
7. Ve título, fecha, lugar y "1 persona ya se sumó"
8. NO ve ningún nombre                             ← privacidad de P0
9. Toca "Sumarme", escribe "Mica", entra
10. Toca "✅ Voy"
11. Ve su respuesta confirmada
12. [vuelve al contexto del organizador]
13. Ve "2 van"                                     ← en vivo o al recargar
```

Cubre en un solo recorrido: creación simple, proyección pública, guest sin cuenta, RSVP y asistencia. **Ése es el flujo que P1 tiene que hacer funcionar.**

Se mantienen los 6 e2e actuales, con mocks actualizados.

---

## 25. Migration Plan

1. **`0_init` queda congelada.** No se edita bajo ninguna circunstancia.
2. Migración nueva `20260826xxxxxx_p1_core_social` con `prisma migrate dev --create-only`, revisada a mano (la recreación del enum necesita `USING`, que Prisma no siempre genera bien).
3. **Antes del enum:** `SELECT DISTINCT status FROM "Gathering"` para confirmar que no hay `DRAFT` ni `PROPOSED`. Si hubiera, migrarlos a `OPEN` primero.
4. Verificar con [`scripts/verify-empty-rebuild.sh`](../sale-juntada-back/scripts/verify-empty-rebuild.sh) sobre una Postgres vacía: `EMPTY DATABASE → WORKING SALE JUNTADA` con dos migraciones.
5. Aplicar a la base de desarrollo con `migrate deploy`.
6. Actualizar el seed.

**Sin `db push`. Sin editar migraciones aplicadas.** Las dos lecciones de P0.

---

## 26. Risks

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | **Extraer `GatheringPage` de `App.tsx`** (3.355 líneas, 47 `useState`) rompe algo sutil | Mover **sin reescribir**; slice propio; los 6 e2e como red |
| 2 | **`getBySlug` es el camino crítico** y P1 lo toca | El test de allowlist de P0 falla ante cualquier campo nuevo no declarado |
| 3 | **Recrear `GatheringStatus`** puede fallar con datos inesperados | Verificar `SELECT DISTINCT` antes; probar en base vacía |
| 4 | **Relajar el DTO de creación** podría dejar pasar datos inválidos | Los tests de ventana de P0 se conservan; sumar tests de los dos modos |
| 5 | **La ubicación del `vercel.json` / `api/` es ambigua** (hay dos archivos) | Confirmarlo como primera tarea del slice de OG; borrar el duplicado |
| 6 | **Un rewrite mal configurado rompe el sitio entero** | La condición `has: user-agent` no toca tráfico humano; probar con `curl -A "WhatsApp/2"` |
| 7 | **`AvailabilityPoll`** arrastra debounce de 600 ms y rollback ya probados | Extraer sin tocar la lógica; slice separado y tardío |
| 8 | **`plusOnes` cuenta para asistencia pero no para gastos** | Deuda **deliberada y documentada**; decisión explícita de P3 |
| 9 | Alguien reintroduce RSVP en la vista pública "para mejorar la UX" | El test de allowlist de P0 falla ante cualquier campo público nuevo |
| 12 | `finalizedEnd = null` rompe a algún consumidor que lo asume presente | Revisar en P1.2 antes de cambiarlo; `finalizeGathering` hoy siempre lo setea |
| 13 | Los resets de RSVP (confirmar / cambiar fecha / reabrir) se olvidan en P1.2 | Definidos en §9 con tabla explícita; entran en la DoD de P1.2 |
| 10 | Alcance que se estira hacia P2/P3 | §27 es explícito; cada slice se revisa por separado |
| 11 | El invitado sin sesión no ve el contador en vivo | Correcto por diseño de P0; alcanza con el dato fresco al cargar |

---

## 27. Out of Scope

**Nada de esto se toca en P1:**

`User` · `Group` · `GroupMember` · `Activity` · analytics · `Invitation` con trazabilidad · `ExpenseSplit` · splits personalizados · múltiples pagadores · vaquita · `currency` · items libres · retirar el catálogo hardcodeado · plantillas sociales · balance entre juntadas · duplicar desde la UI · `/mis-juntadas` como página · Mercado Pago · OCR · IA · push · Redis para presencia · imagen OG generada dinámicamente · migrar toda la app a React Query · reescribir `MobileExperience` · rediseñar gastos o compras · nombres de acompañantes · invitados externos por email.

**Explícitamente conservado sin cambios:** todo lo de P0 (token seguro, comparación en tiempo constante, `ParticipantAuthService`, autorización de endpoints, autorización de WebSocket, idempotencia de gastos, `idempotencyKey NOT NULL`, semántica transaccional de `expenseRound`, rate limits, cola global de Nominatim, TTL/LRU de la caché, baja del legacy de Google, baja de `Proposal`, CI, y los 101 + 22 + 6 tests).

---

## 28. Definition of Done

P1 está terminado cuando:

**Producto**
- [ ] Se crea una juntada con **dos campos** y una elección
- [ ] Se puede crear **sin saber la fecha**, eligiendo una ventana (no inventada)
- [ ] El invitado entiende **qué / cuándo / dónde / cuántos** antes de identificarse
- [ ] Se suma con **un** campo, sin cuenta
- [ ] **Con fecha:** dice ✅ / ❓ / ❌ en **un toque** y puede cambiarlo
- [ ] **Sin fecha:** no ve RSVP; ve la pregunta "¿cuándo podés?"
- [ ] El organizador ve cuántos van, actualizado en vivo
- [ ] La disponibilidad aparece **sólo** si la juntada no tiene fecha
- [ ] Confirmar una fecha habilita el RSVP y deja al resto sin responder
- [ ] Cambiar una fecha ya confirmada resetea el RSVP del resto
- [ ] El botón de WhatsApp abre el selector con el mensaje armado
- [ ] El link pegado en WhatsApp muestra **título, fecha, lugar y cuántos van**

**Técnico**
- [ ] `/` y `/j/:slug` son rutas reales, con `lazy` y 404
- [ ] El demo ficticio ya no existe
- [ ] `App.tsx` **ya no es responsable** de routing, landing, onboarding del invitado, RSVP ni hero *(no se mide en líneas)*
- [ ] Nueva migración aplicada; **`0_init` intacta**
- [ ] `verify-empty-rebuild.sh` en verde con dos migraciones
- [ ] La vista pública **sigue sin exponer** nombres, avatares **ni RSVP** — el test de allowlist de P0 pasa **sin modificarse**
- [ ] Los 101 tests de backend de P0 siguen verdes
- [ ] El E2E estrella pasa
- [ ] Lint, tests y build en verde en los tres proyectos
- [ ] **El link de invitación descarga menos JS que hoy** (medido contra los ~806 KB actuales)

---

## 29. Implementation Order

El orden del brief es bueno; propongo **dos correcciones**, ambas justificadas por el código.

### Corrección 1 — RSVP (modelo + API) va **antes** que el routing

El brief propone `P1.1 Routing` → `P1.2 RSVP`. Conviene al revés: el RSVP de backend es **aditivo y aislado** (3 columnas, 1 endpoint, cero riesgo para lo existente), mientras que el routing es el cambio más riesgoso del frontend. Empezar por lo seguro deja valor commiteado antes de tocar `App.tsx`, y permite construir la UI de RSVP contra una API que ya funciona.

### Corrección 2 — La extracción de `AvailabilityPoll` va **al final**

Arrastra el debounce de 600 ms y el rollback al último estado confirmado por el servidor, que fueron bugs reales arreglados en `39d8dac`. Es el último lugar donde conviene meter mano.

### Slices

| # | Slice | Contenido | Riesgo |
|---|---|---|---|
| **P1.1** | **Modelo y API de RSVP** | Migración, `setRsvp` (rechaza sin fecha y canceladas), `rsvpSummary` privado, `rsvpChanged`, poda del enum, seed de los dos modos, tests backend | Bajo |
| **P1.2** | **Creación simple + ciclo de vida de la fecha** | `startsAt`; **`windowStart/End` elegidos por el creador, sin default silencioso**; **`finalizedEnd` no se inventa**; `finalizeGathering` habilita el RSVP y resetea al resto; cambiar fecha resetea; reabrir encuesta resetea a todos; DTO relajado | Medio |
| **P1.3** | **Routing + Landing** | `<Routes>`, `LandingPage`, `NotFoundPage`, `GatheringPage` como cáscara, borrar el demo | **Alto** |
| **P1.4** | **Guest flow + RSVP UI** | `GatheringHero`, `JoinGathering` sin modal, `RsvpSelector`, `PlusOnesStepper`, `AttendanceSummary`, React Query | Medio |
| **P1.5** | **Jerarquía de la GatheringPage** | Reordenar secciones, colapsar compras/gastos, nav condicional | Medio |
| **P1.6** | **Creación en 2 pasos (UI)** | `CreateGatheringFlow` | Bajo |
| **P1.7** | **WhatsApp** | `WhatsAppShareButton`, `shareMessage()` + test | Bajo |
| **P1.8** | **OG dinámico** | Confirmar config de Vercel, borrar duplicado, `api/preview`, rewrite, `og:image` absoluto | Medio |
| **P1.9** | **Availability opcional** | Extraer `AvailabilityPoll`, condicionar a `status` | **Alto** |
| **P1.10** | **E2E + limpieza** | Test estrella, mocks, medir el peso del bundle, documentación | Bajo |

**Cada slice debe:** compilar, dejar los tests verdes, poder revisarse solo, y **funcionar sin depender de que P1 esté entero**.

Concretamente: después de P1.1 el RSVP existe en la API aunque nadie lo use todavía. Después de P1.4 el flujo social funciona de punta a punta aunque el compartir y el OG sigan siendo los de hoy. Ningún slice deja el producto roto.

---

## Apéndice — Las 17 preguntas de §42

| # | Pregunta | Decisión |
|---|---|---|
| 1 | ¿RSVP en `Participant` o tabla propia? | **`Participant`.** Es 1:1, `getBySlug` ya lo carga, RSVP es estado y no historia (§8) |
| 2 | ¿Campos mínimos para crear? | **`title` + `organizerName`.** Todo lo demás opcional |
| 3 | ¿Cómo se crea sin fecha? | Sin `startsAt` → `status = OPEN`, `finalizedStart = null`. **La ventana la elige el creador** ("¿más o menos cuándo?"), no se inventa |
| 4 | ¿Qué pasa con `windowStart/End`? | **Pasan a opcionales.** Con fecha se derivan de ese día; sin fecha los elige el creador. No se hacen nullable: evita tocar `slots.ts` y todo lo probado en P0. **`finalizedEnd` no se inventa desde `durationMinutes`** |
| 5 | ¿La disponibilidad se activa sola o por el organizador? | **Sola**, según `finalizedStart === null`. El organizador la reabre con "cambiar fecha" |
| 6 | ¿Cuándo pasa de scheduling a RSVP? | **Al confirmar la fecha.** Son excluyentes: sin fecha hay disponibilidad y no hay RSVP; con fecha hay RSVP y no hay encuesta (§9) |
| 7 | ¿Qué significan `OPEN`, `PROPOSED`, `CONFIRMED`? | `OPEN` = buscando fecha · `CONFIRMED` = tiene fecha · `CANCELLED` = cancelada. **`DRAFT` y `PROPOSED` se eliminan**: están muertos |
| 8 | ¿`plusOnes` en P1? | **Sí**, revelado después de `GOING`. Sin nombres. P3 decide su efecto en los gastos |
| 9 | ¿Qué muestra el público? | **Exactamente los 22 campos de P0, sin agregados.** Ni RSVP individual ni `rsvpSummary`: cómo respondió el grupo es información del grupo |
| 10 | ¿Qué muestra el participante? | Todo lo anterior + nombres, avatares, RSVP individual, disponibilidad, coordenadas |
| 11 | ¿Qué ve distinto el organizador? | Compartir destacado, asistencia detallada, cambiar fecha, elegir fecha final, cancelar |
| 12 | ¿Cómo hacemos OG con Vite + Vercel? | **Vercel Function + rewrite condicional por user-agent.** Consume el endpoint público de P0 (§16) |
| 13 | ¿Cómo compartimos por WhatsApp? | `wa.me/?text=` con mensaje armado, link al final. `navigator.share` como secundario |
| 14 | ¿Qué se extrae de `App.tsx` ahora? | Rutas, landing, hero, join, RSVP y (al final) la grilla de disponibilidad |
| 15 | ¿Qué queda intacto? | `MobileExperience`, gastos, liquidación, compras, `GatheringManagementDialog`, `AccountDialog`, `LocationPicker`, `PartyGames` |
| 16 | ¿Qué usa React Query? | Sólo lo nuevo: `useGathering` y `useRsvp`. Nada legacy se migra |
| 17 | ¿Cuál es el E2E principal? | Organizador crea → invitado abre sin sesión → entiende sin ver nombres → se suma → dice Voy → el organizador ve "2 van" |
