# Experiencia modular y gestión de servicios

Implementado el 3 de octubre de 2026, siguiendo `MODULAR_GATHERING_EXPERIENCE_PLAN.md`.

## Alcance entregado

- Inicio de la juntada con contexto, respuesta de asistencia, acceso a Mi parte y seis accesos a herramientas.
- Fecha y lugar se abre desde la fecha del encabezado y está siempre en el catálogo y la navegación de escritorio.
- Pantallas con URL propia: Invitados, Fecha y lugar, Compra y aportes, Pendientes y útiles, Alimentación, Gastos y cuentas, Juegos, Servicios y Mi parte.
- Cuentas tiene navegación interna entre Gastos y Transferencias; el reparto de dinero conserva las reglas existentes.
- Navegación lateral en escritorio e inferior en móvil; cada módulo conserva un regreso a la juntada y acceso a Servicios.
- Alimentación se extrajo de `PurchasePlanner` a un componente independiente y funciona antes de confirmar fecha. Compra también puede prepararse durante OPEN.
- Se retiraron el marketing, el pie promocional y la navegación por scroll del espacio de la juntada.
- Crear una juntada OPEN o sumarse desde su inicio lleva a Fecha y lugar para cumplir la acción «elegir/marcar horarios». Un enlace directo a otro servicio conserva ese destino después de sumarse.

## Continuidad de datos y sesión

`/j/:slug/*` mantiene montado el controlador de la juntada. Su clave sigue siendo el slug: cambiar de herramienta no recrea sesión, query principal ni socket autenticado. Las pantallas sólo renderizan la herramienta activa.

La lista de pendientes y sus resúmenes usan la misma clave de React Query. Los eventos de asistencia y pendientes actualizan Inicio aunque el usuario estuviera en otra pantalla; la reconexión conserva la recuperación existente. Gastos sigue en el controlador compartido, con las mismas mutaciones y notificaciones del backend.

`useGatheringDraft` conserva en memoria los formularios de pendientes, aportes, alimentación, alias y la ronda de juegos mientras se navega dentro de la juntada. El formulario de gasto tiene monto y concepto controlados en el contenedor persistente. Los borradores no se guardan en disco: al recargar o salir de la juntada sólo sobrevive lo confirmado en el servidor.

Las cuentas muestran carga/error con reintento si falla la consulta inicial, en lugar de presentar un total ficticio de cero. Los resúmenes de pendientes distinguen carga y error.

## Privacidad y estados

- Sin una sesión de participante se muestra la invitación pública y el ingreso, también en enlaces directos a módulos privados.
- Invitados muestra disponibilidad durante OPEN y asistencia durante CONFIRMED.
- CANCELLED conserva la consulta, indica cancelación en todas las pantallas y deshabilita edición de alimentación, compra y cuentas; el backend conserva sus controles previos.
- Juegos sigue siendo una experiencia en un teléfono. La nueva navegación no introduce partidas multijugador.

## Verificación

- Frontend: 39 pruebas unitarias/de componentes aprobadas.
- E2E: 16 escenarios aprobados en Chrome móvil y escritorio, incluyendo los flujos anteriores de creación, disponibilidad, compra y liquidación.
- Lint estricto y build aprobados. Persiste el aviso previo de tamaño del paquete de mapas.
- Recorridos reales en Chrome móvil y escritorio: navegación, Atrás, enlaces directos y recarga, sesión, borradores, carga de gastos, alimentación, compra y ausencia de nuevas conexiones de socket al navegar.
- Dos sesiones reales: asistencia, acompañantes, responsables, reasignación del organizador, reconexión, persistencia y cancelación.
- El smoke histórico que depende del slug sembrado `asado-demo-tucuman` se excluye en la base aislada; los escenarios reales nuevos crean sus propias juntadas.

Los E2E se ejecutan contra la API y la base de pruebas local, con Node 22. No hubo migraciones ni despliegue en esta entrega.

## Segunda entrega: servicios configurables

Implementada el 3 de octubre de 2026.

- Quien organiza administra Compra y aportes, Pendientes y útiles, Alimentación, Gastos y cuentas y Juegos desde `/j/:slug/servicios`. Invitados y Fecha y lugar siempre están disponibles.
- La elección pertenece a la juntada, sobrevive a recargas y llega al grupo por el socket autenticado. Inicio, navegación lateral y Mi parte muestran sólo las herramientas activas. Los invitados encuentran los servicios desactivados en el catálogo para consultar su historial.
- Desactivar conserva los datos; una ruta directa muestra un aviso y controles deshabilitados. Reactivar permite continuar con los mismos datos y responsables. Juegos mantiene su alcance previo: ronda local en el teléfono, sin persistencia de partidas en el servidor.
- Los cambios son exclusivos del organizador. La API valida el servicio y el booleano, verifica rol/token y rechaza juntadas canceladas. Las escrituras de Compra, Pendientes, Alimentación y Cuentas comprueban la activación en el servidor.
- Configuración y escrituras toman el mismo bloqueo de fila dentro de transacciones breves. Dos cambios simultáneos de servicios distintos no se pisan; una escritura en vuelo termina antes del archivo o se rechaza después.
- Cuentas sólo se desactiva sin transferencias pendientes y, si existen gastos, con el cierre de todos. Al archivarla se conserva la liquidación: sumar una persona después no recalcula esa cuenta archivada. Al reactivar se usan los integrantes actuales y las reglas de reparto existentes.
- Los interruptores indican guardado pendiente, muestran errores y permiten reintentar. La elección se confirma con la consulta al servidor.

### Contrato y migración

`Gathering.disabledServices` usa el enum de cinco servicios opcionales. Su valor por defecto es vacío: las juntadas nuevas y existentes comienzan con todos los servicios habilitados. `archivedExpenseSettlement` conserva el cierre de Cuentas.

`PUT /api/gatherings/:gatheringId/participants/:participantId/services/:service`, con `x-participant-token` y cuerpo `{ "enabled": false }`, actualiza una sola herramienta. Responde con `disabledServices` y emite `gathering:changed` con acción `services`. La invitación pública no expone configuración ni liquidaciones.

La migración `20261003170000_gathering_services` se aplicó únicamente a PostgreSQL local aislado (`salejuntada_codex_20261003`). Para publicar estos cambios hay que aplicar las migraciones pendientes antes de arrancar la API actualizada. No se desplegó a producción.

### Verificación de esta entrega

- Backend: 207 pruebas aprobadas, incluidos permisos, cancelación, idempotencia de configuración, bloqueo de escrituras y archivo/reactivación de Cuentas.
- Frontend: 44 pruebas aprobadas, incluidos fallo/reintento de guardado y bloqueo de Cuentas sin cierre.
- Regresión: los 16 escenarios anteriores aprobaron separados por dispositivo (8 móvil, 8 escritorio). Los lanzamientos conjuntos agotaron el tiempo del runner; las ejecuciones por dispositivo terminaron correctamente. Se sigue excluyendo el smoke dependiente del slug sembrado.
- E2E de servicios: cuatro escenarios aprobados en Chrome móvil y escritorio contra API y PostgreSQL reales. Comprueban dos sesiones, sincronización, reconexión, recarga, conservación de responsables, permisos, contratos inválidos, archivo de liquidación y carrera entre gasto y desactivación.
- Build de ambos proyectos, lint estricto del frontend y lint de los archivos backend modificados aprobados. Se mantiene el aviso previo del bundle de mapas.

## Trabajo posterior

Queda continuar la extracción del controlador de horarios y cuentas a módulos de datos más pequeños, y diseñar la relación entre necesidades y aportes para no duplicar compromisos. La navegación actual ya permite avanzar en esas partes sin volver al formato de página única.

## Preparación de publicación — 10 de octubre de 2026

Se volvió a validar backend (207 tests), frontend (44 tests), lint y builds.
La migración `20261010190000_checklist_access` habilita RLS para la nueva
lista de pendientes y revoca acceso directo de clientes; la API conserva
la autorización mediante token de participante.

El despliegue debe comprobar la conexión y el historial de la base de destino:
no marcar `0_init` como aplicada en una base antigua sin verificar primero
que su esquema coincide con ese baseline. Nunca usar un reset sobre datos existentes.
