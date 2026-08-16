# Sale Juntada

Aplicación mobile-first para organizar juntadas en grupo sin perder horas en encuestas interminables.

Sale Juntada ayuda a coordinar una reunión con amigos, familia o equipo de trabajo definiendo un rango de fechas, recibiendo la disponibilidad de cada persona, buscando los mejores horarios de coincidencia y cerrando la propuesta con confirmación y gastos compartidos.

## ✨ Qué hace

- Crea una juntada con nombre, fechas, horario y duración
- Invita participantes sin exigir registro obligatorio
- Recibe disponibilidad individual y calcula la mejor coincidencia
- Muestra los horarios más probables según el grupo
- Soporta cierre de la propuesta, confirmación y enlace para compartir
- Sugiere la compra y permite que cada participante elija en vivo qué va a llevar
- Gestiona gastos y liquidaciones entre participantes
- Prepara integración con Google Calendar para automatizar disponibilidad

## 🧩 Stack

- Frontend: React 19, TypeScript, Vite, React Router, Tailwind CSS
- Backend: NestJS, Prisma, PostgreSQL / Supabase, Swagger, Socket.IO
- Calidad: Vitest, Playwright, Jest
- Infra: Vercel + Fly.io

## 📁 Estructura del proyecto

- [sale-juntada-front](sale-juntada-front): aplicación web del usuario
- [sale-juntada-back](sale-juntada-back): API, dominio y lógica de coincidencias
- [sale-juntada-e2e](sale-juntada-e2e): pruebas end-to-end del flujo crítico
- [docs/google-calendar.md](docs/google-calendar.md): especificación de la integración con Google Calendar

## 🚀 Arranque local

Requisitos recomendados:

- Node.js 22 o superior
- PostgreSQL 15 o superior, o los binarios locales incluidos en `C:\Program Files\pgsql\bin`

### 1) Frontend

```bash
cd sale-juntada-front
npm install
npm run dev
```

### 2) Backend

```bash
cd sale-juntada-back
cp .env.example .env
npm install
npm run db:setup
npm run start:dev
```

`db:setup` inicializa PostgreSQL local en el puerto `54329`, aplica todas las
migraciones y carga una juntada demo idempotente. La base y sus logs se guardan
en `sale-juntada-back/.local-postgres` y no se versionan.

Comandos útiles:

```bash
npm run db:local:start
npm run db:status
npm run prisma:seed
npm run db:local:stop
```

La juntada demo queda disponible en:

- http://localhost:5173/j/asado-demo-tucuman
- http://localhost:3001/api/gatherings/asado-demo-tucuman

La API queda disponible en:

- http://localhost:3001/api
- Swagger: http://localhost:3001/api/docs

## 🏗️ Variables de entorno

El frontend usa variables del tipo:

```bash
VITE_API_URL
VITE_SOCKET_URL
VITE_GOOGLE_CLIENT_ID
```

El backend está preparado para PostgreSQL/Supabase con:

```bash
DATABASE_URL
DIRECT_URL
FRONTEND_URLS
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALENDAR_REDIRECT_URI
GOOGLE_TOKEN_ENCRYPTION_KEY
```

## 🗄️ Base de datos con Supabase

El backend usa Supabase Postgres mediante Prisma con dos conexiones:

- `DATABASE_URL`: pooler transaccional para la app y Prisma Client
- `DIRECT_URL`: pooler de sesión para Prisma Migrate

Copiá ambas cadenas desde **Connect → ORM → Prisma** en Supabase. Para inicializar una base nueva:

```bash
cd sale-juntada-back
npm run migrate:deploy
npm run prisma:seed
npm run start:dev
```

Los secretos se mantienen en `sale-juntada-back/.env`, quedan fuera del repositorio y nunca deben exponerse en el frontend.

## 📌 Alcance actual

- crear juntadas con rango de fechas y duración
- registrar participantes sin login obligatorio
- cargar disponibilidad manual o tentativa
- ordenar las mejores coincidencias
- preparar confirmación y compartir enlace
- armar una mesa visual de aportes con responsables y estado listo en tiempo real
- elegir cerveza, fernet, vino, postre y otros productos como misiones separadas
- registrar necesidades sin gluten, veganas o vegetarianas y cómo se resolverá cada menú
- jugar rondas locales de rompehielo, prendas y brindis responsable +18
- administrar gastos y saldos

## 🔮 Próximas integraciones

- Google Calendar: importar bloques ocupados de forma opcional
- permitir productos personalizados y varias personas responsables por un mismo producto
- confirmación del evento final en el calendario personal
- refinamiento del algoritmo de matching y cierre de reuniones
- sincronizar una ronda de minijuegos entre teléfonos, con moderación y mazos configurables
- incorporar comercios de Tucumán recién en una etapa posterior, con consentimiento y datos verificables

El alcance funcional, la estrategia de privacidad y los criterios de aceptación quedan detallados en [docs/google-calendar.md](docs/google-calendar.md).

## ⏰ Zonas horarias

Cada juntada guarda la zona horaria IANA en la que fue creada (`Gathering.timeZone`)
y el backend genera los horarios candidatos en esa zona
([slots.ts](sale-juntada-back/src/gatherings/slots.ts)). El frontend sólo los
formatea para mostrarlos.

Esto importa porque el matching agrupa las disponibilidades por instante exacto:
si cada navegador generara los horarios con su hora local, dos participantes en
husos distintos producirían instantes diferentes y no coincidirían en ninguna
opción, sin ningún error visible. `setAvailability` también rechaza horarios que
no pertenezcan a la grilla de la juntada.

## 🔒 Notas de seguridad

- El slug de cada juntada usa 8 bytes aleatorios: es la única barrera que
  protege nombres, fotos, disponibilidad, gastos y la ubicación exacta del
  encuentro, dado que unirse no requiere cuenta.
- Cada juntada admite hasta 40 participantes. Como los gastos y la compra se
  dividen por cabeza, sumar gente falsa cambia lo que paga y lo que le toca
  llevar a cada uno.
- `avatarUrl` (unirse o crear sin sesión) sólo acepta un emoji, una imagen
  comprimida a data URI por el propio navegador, o una foto de perfil de
  `*.googleusercontent.com` (para quien ya tiene sesión de Google al unirse).
  Antes se aceptaba cualquier URL, y como se renderiza en un `<img src>`,
  servía para cosechar la IP de cada persona que abriera el link. El flujo
  autenticado con Supabase (`AuthParticipantDto`) no pasa por esta
  restricción porque ahí la identidad ya está verificada por el JWT.
- `VITE_MAP_TILES_URL` es obligatoria en producción: la Tile Usage Policy de
  OpenStreetMap no permite usar `tile.openstreetmap.org` desde una
  aplicación. MapTiler, Protomaps y Stadia Maps tienen plan gratuito.

## 🌐 Entornos

- Frontend: [sale-juntada-front.vercel.app](https://sale-juntada-front.vercel.app)
- API: [sale-juntada-api-tomytf13.fly.dev](https://sale-juntada-api-tomytf13.fly.dev/api/health)
- Base de datos: Supabase Postgres en São Paulo

El frontend se comunica con la API por HTTPS y Socket.IO. Fly ejecuta las migraciones de Prisma antes de reemplazar una versión, y los secretos de conexión se administran en la plataforma, nunca en Git.

## 🧪 Validación

Se incluye soporte para ejecutar pruebas de frontend, backend y E2E:

```bash
cd sale-juntada-front && npm run test
cd sale-juntada-back && npm run test
cd sale-juntada-e2e && npm test
```

Para incluir el smoke test real contra PostgreSQL y la API local:

```powershell
$env:E2E_REAL_DB="1"
$env:E2E_BASE_URL="http://127.0.0.1:5173"
npm run test:smoke
```

## 📄 Licencia

Este proyecto está en desarrollo activo y se usa como base para una solución de coordinación de reuniones y gastos compartidos.
