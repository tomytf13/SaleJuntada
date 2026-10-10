# Invitados, asistencia en vivo y necesidades de la juntada

La invitación ahora muestra título, fecha, lugar aproximado y cantidad de participantes antes de pedir el nombre. «Sumarme» abre un formulario en la misma página. Tras ingresar, la vista se carga nuevamente con la credencial del participante: aparecen las identidades del grupo y, cuando hay fecha confirmada, «Voy / No sé / No voy», acompañantes y resumen de asistencia.

## Tiempo real

La juntada se consulta con React Query; el caché separa slug y credencial. RSVP usa una actualización optimista y revierte sólo la respuesta propia ante error, preservando cambios de otros participantes. La disponibilidad, compras, gastos y liquidaciones mantienen sus flujos anteriores.

El socket autenticado escucha `rsvp:changed`, `participants:changed`, `availability:changed`, `gathering:changed`, `dietary:changed`, `purchase:changed`, `expenses:changed`, `transfers:changed` y `checklist:changed`. Se agregaron avisos de ingreso y disponibilidad al backend. El gateway confirma que la suscripción a la sala terminó; luego el cliente recupera juntada, coincidencias, compra, cuentas y necesidades para cubrir cambios perdidos durante una desconexión. Los eventos `offline` / `online` del navegador desconectan y vuelven a conectar el socket. Juntada y necesidades también se refrescan cada 30 segundos y al recuperar foco.

La vista pública conserva la proyección de P0: no publica nombres, respuestas ni necesidades del grupo. El socket sólo abre después de que la API reconoce la credencial. Las rutas se montan nuevamente al cambiar de slug, evitando arrastrar una sesión entre juntadas.

## Necesidades y responsables

La mesa de aportes existente ya permite productos personalizados y múltiples aportantes por categoría. Eso registra lo que alguien decidió llevar, pero no representaba necesidades todavía sin responsable.

La nueva sección «Qué falta resolver» permite:

- A cualquier participante, agregar necesidades o tareas (hasta 120 caracteres), incluso mientras se busca fecha.
- A cada invitado, anotarse en una necesidad libre y marcar su tarea lista o pendiente, o liberarla.
- Al organizador, asignar/reasignar a cualquier participante de esa juntada, actualizar el estado y quitar necesidades.
- A todos, ver quién se encarga y los totales sin responsable / pendientes / listas en vivo.

Incluye sugerencias de carbón, sal, herramientas para el asado, diario para limpiar la parrilla y parlante. Son botones para agregarlas; no se impone una lista a todas las juntadas.

`ChecklistItem` guarda cada necesidad por separado de los aportes y los gastos. Reasignar o liberar vuelve la necesidad a pendiente. El servidor compara responsable y estado al actualizar: dos pedidos simultáneos no pueden apropiarse de la misma necesidad ni sobrescribir un cambio que ocurrió mientras se procesaban. No se permite asignar participantes de otra juntada. Sólo quien organiza puede quitar necesidades. Las canceladas conservan contexto, respuestas y lista, pero rechazan mutaciones.

## API y migración

Migración nueva: `20261003090000_gathering_checklist`. Las migraciones anteriores quedan intactas. Debe aplicarse junto con el despliegue del backend, antes de publicar el frontend.

- `GET /api/gatherings/:gatheringId/checklist`: requiere credencial de participante.
- `POST /api/gatherings/:gatheringId/participants/:participantId/checklist`: agrega una necesidad.
- `PATCH /api/gatherings/:gatheringId/participants/:participantId/checklist/:itemId`: `claim`, `release`, `ready`, `pending` o `assign` (con `assignedParticipantId`).
- `DELETE /api/gatherings/:gatheringId/participants/:participantId/checklist/:itemId`: sólo organizador.

Todos los cambios usan `x-participant-token`; los permisos se resuelven en el backend.

## Verificación

Se agregó cobertura de permisos, pertenencia a la juntada, cancelación, reclamos concurrentes, reinicio de estado al reasignar, ingreso sin modal, RSVP por socket y recuperación tras reconectar. Una prueba de frontend verifica que el rollback de una respuesta no pierda una actualización ajena.

`tests/smoke/social-realtime.spec.ts` usa PostgreSQL y la API reales, con dos sesiones independientes, en móvil y escritorio. Cubre invitación pública, ingreso, respuestas, acompañantes, toma de tareas, asignación del organizador, estado listo, pérdida de internet y reconexión, persistencia tras recarga, privacidad de la lista y cancelación. Se habilita con `E2E_REAL_DB=1`; `E2E_API_URL` permite elegir una API local de prueba. Ejecutar siempre contra una base local aislada.

Se mantienen las pruebas smoke existentes de creación, disponibilidad, compras y gastos, ajustadas para abrir el ingreso en la página y simular la vista privada completa después de sumarse.

Resultados finales: 33/33 pruebas de frontend, 194/194 de backend y 14 pruebas de navegador aprobadas (12 smoke existentes y 2 con dos sesiones contra PostgreSQL real); los 2 smoke del seed histórico se omiten porque corresponden a otra base. Lint de frontend y archivos modificados del backend, ambos builds y `git diff --check` aprobados. La advertencia del chunk de mapas ya existía y sigue diferida.

## Alcance restante

No se desplegó a producción. La creación en dos pasos y los previews dinámicos de WhatsApp continúan en sus etapas posteriores del plan. Los acompañantes cuentan para asistencia, pero todavía no cambian la división de gastos. Las necesidades son de cada juntada y no se copian al duplicarla.
