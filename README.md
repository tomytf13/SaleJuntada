# Sale Juntada

Aplicación mobile-first para organizar juntadas en grupo sin perder horas en encuestas interminables.

Sale Juntada ayuda a coordinar una reunión con amigos, familia o equipo de trabajo definiendo un rango de fechas, recibiendo la disponibilidad de cada persona, buscando los mejores horarios de coincidencia y cerrando la propuesta con confirmación y gastos compartidos.

## ✨ Qué hace

- Crea una juntada con nombre, fechas, horario y duración
- Invita participantes sin exigir registro obligatorio
- Recibe disponibilidad individual y calcula la mejor coincidencia
- Muestra los horarios más probables según el grupo
- Soporta cierre de la propuesta, confirmación y enlace para compartir
- Gestiona gastos y liquidaciones entre participantes
- Prepara integración con Google Calendar para automatizar disponibilidad

## 🧩 Stack

- Frontend: React 19, TypeScript, Vite, React Router, Tailwind CSS
- Backend: NestJS, Prisma, PostgreSQL / Neon, Swagger, Socket.IO
- Calidad: Vitest, Playwright, Jest
- Infra: Vercel + Fly.io

## 📁 Estructura del proyecto

- [sale-juntada-front](sale-juntada-front): aplicación web del usuario
- [sale-juntada-back](sale-juntada-back): API, dominio y lógica de coincidencias
- [sale-juntada-e2e](sale-juntada-e2e): pruebas end-to-end del flujo crítico
- [docs/google-calendar.md](docs/google-calendar.md): especificación de la integración con Google Calendar

## 🚀 Arranque local

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
npm run prisma:generate
npm run migrate:deploy
npm run start:dev
```

La API queda disponible en:

- http://localhost:3001/api
- Swagger: http://localhost:3001/api/docs

## 🏗️ Variables de entorno

El frontend usa variables del tipo:

```bash
VITE_API_URL
VITE_SOCKET_URL
VITE_SUPPORT_ALIAS
VITE_GOOGLE_CLIENT_ID
```

El backend está preparado para PostgreSQL/Neon con:

```bash
DATABASE_URL
DATABASE_URL_UNPOOLED
FRONTEND_URLS
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALENDAR_REDIRECT_URI
GOOGLE_TOKEN_ENCRYPTION_KEY
```

## 🗄️ Base de datos con Neon

El backend está listo para trabajar con Neon Postgres usando dos conexiones:

- `DATABASE_URL`: Pry para la app y Prisma Client
- `DATABASE_URL_UNPOOLED`: conexión directa para migraciones

Para inicializar una base nueva:

```bash
cd sale-juntada-back
npx -y neon@latest init
npx -y neon env pull
npm run migrate:deploy
npm run start:dev
```

Los secretos se mantienen en [sale-juntada-back/.env](sale-juntada-back/.env) y quedan fuera del repositorio.

## 📌 Alcance actual

- crear juntadas con rango de fechas y duración
- registrar participantes sin login obligatorio
- cargar disponibilidad manual o tentativa
- ordenar las mejores coincidencias
- preparar confirmación y compartir enlace
- administrar gastos y saldos

## 🔮 Próximas integraciones

- Google Calendar: importar bloques ocupados de forma opcional
- sincronización de disponibilidad por participante
- confirmación del evento final en el calendario personal
- refinamiento del algoritmo de matching y cierre de reuniones

El alcance funcional, la estrategia de privacidad y los criterios de aceptación quedan detallados en [docs/google-calendar.md](docs/google-calendar.md).

## 🌐 Entornos

- Frontend: Vercel
- API: Fly.io
- Base de datos: Neon Postgres

## 🧪 Validación

Se incluye soporte para ejecutar pruebas de frontend, backend y E2E:

```bash
cd sale-juntada-front && npm run test
cd sale-juntada-back && npm run test
cd sale-juntada-e2e && npm test
```

## 📄 Licencia

Este proyecto está en desarrollo activo y se usa como base para una solución de coordinación de reuniones y gastos compartidos.
