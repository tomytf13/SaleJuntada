# Sale Juntada

Aplicación web mobile-first para coordinar juntadas sin encuestas eternas.

## Stack

La base replica el stack tecnológico de Turnero:

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, React Router y TanStack Query.
- Backend: NestJS, Prisma, PostgreSQL/Neon, Swagger y Socket.IO.
- Calidad: Vitest y Playwright.

## Estructura

- `sale-juntada-front/`: experiencia web para organizadores e invitados.
- `sale-juntada-back/`: API, dominio de juntadas y cálculo de coincidencias.
- `sale-juntada-e2e/`: pruebas de los recorridos críticos.

## Desarrollo local

Frontend:

```bash
cd sale-juntada-front
npm install
npm run dev
```

Backend:

```bash
cd sale-juntada-back
cp .env.example .env
npm install
npm run prisma:generate
npm run migrate:deploy
npm run start:dev
```

La API queda disponible en `http://localhost:3001/api` y Swagger en
`http://localhost:3001/api/docs`.

## Producción

- Frontend (Vercel): https://sale-juntada-front.vercel.app
- API (Fly.io, región `gru`): https://sale-juntada-api-tomytf13.fly.dev/api
- Base de datos: Neon Postgres

El frontend se compila con `VITE_API_URL` y `VITE_SOCKET_URL`. El backend
ejecuta `prisma migrate deploy` antes de cada release y restringe HTTP y
Socket.IO al dominio configurado en `FRONTEND_URLS`.

## Base de datos con Neon

El backend está preparado para Neon Postgres mediante dos conexiones:

- `DATABASE_URL`: conexión pooled usada por NestJS y Prisma Client.
- `DATABASE_URL_UNPOOLED`: conexión directa usada por Prisma Migrate.

Para enlazar una instalación nueva:

```bash
cd sale-juntada-back
npx -y neon@latest init
npx -y neon env pull
```

Luego aplicar las migraciones y levantar la API:

```bash
npm run migrate:deploy
npm run start:dev
```

Las credenciales permanecen en `sale-juntada-back/.env`, archivo ignorado por
Git.

## Primer alcance

- Crear una juntada con rango de fechas y duración.
- Incorporar participantes sin obligarlos a registrarse.
- Cargar disponibilidad exacta o tentativa.
- Ordenar las tres mejores coincidencias.
- Preparar la confirmación y el enlace para compartir.

## Próximas integraciones

- Google Calendar: cada participante podrá conectar su cuenta de forma opcional
  para importar automáticamente sus bloques ocupados, sin compartir nombres ni
  detalles de sus eventos.
- La disponibilidad manual seguirá funcionando para quienes no usen Calendar y
  permitirá corregir o complementar lo importado.
- Al confirmar la juntada, se podrá agregar el evento al calendario de cada
  participante con una acción explícita.

El alcance funcional, las decisiones de privacidad y los criterios de aceptación
están documentados en [`docs/google-calendar.md`](docs/google-calendar.md).
