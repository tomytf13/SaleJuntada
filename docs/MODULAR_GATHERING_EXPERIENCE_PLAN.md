# Propuesta: juntada con servicios modulares

Estado: análisis y propuesta, 3 de octubre de 2026. El usuario confirmó que calculadora significa dividir gastos/calcular transferencias, y que cada juntada elige sus servicios. Este documento no implementa cambios de producto. Parte del código local de P1.3/P1.4 y de la solicitud de organizar las herramientas en módulos.

## Objetivo

Que el invitado pueda abrir una juntada, entender lo importante y entrar directamente a la herramienta que necesita. Cada juntada conserva una identidad, participantes, permisos y sincronización comunes. Los servicios tienen pantallas propias y se pueden incorporar progresivamente.

## Diagnóstico del estado actual

- `GatheringPage.tsx` reúne contexto, ingreso, asistencia, disponibilidad, gastos, transferencias, juegos y varios diálogos. Después de agregar RSVP y checklist tiene aproximadamente 2.400 líneas.
- `PurchasePlanner` está dentro de `MobileExperience.tsx` y mezcla aportes por categoría, necesidades alimentarias y opciones de compra. Alimentación sólo aparece cuando se renderiza la compra de una juntada confirmada.
- `MobileBottomNav` y `useActiveSection` navegan mediante scroll y anclas. No representan pantallas independientes.
- La explicación de marketing «Así de simple» todavía aparece dentro de una juntada activa, ocupando espacio destinado a coordinación.
- RSVP y checklist ya usan React Query. Compra y gastos mantienen estado local y handlers coordinados desde la página.
- El socket autenticado ya notifica cambios del grupo. Debe permanecer conectado al navegar entre servicios.
- Juegos hoy funciona en un teléfono, con estado local. Separarlo visualmente no lo convierte en una partida multijugador sincronizada.
- El código actual de sugerencias de compra devuelve cantidades base de una unidad/aporte por categoría. No existe un estimador completo de comida y bebida por asistente. El usuario aclaró que «calculadora» significa dividir gastos/calcular transferencias; un estimador de cantidades queda fuera de esta mejora.

## Estructura recomendada

### Inicio de la juntada

Una pantalla breve con:

1. Nombre, fecha/estado, lugar y compartir.
2. Mi respuesta de asistencia; si no hay fecha, acceso a mi disponibilidad.
3. Mis pendientes concretos: responder, llevar un elemento, completar una comida especial o revisar una transferencia.
4. Accesos a servicios activos, cada uno con título y una línea útil de estado. Ejemplos ilustrativos: «Invitados · 3 van, 1 sin responder», «Pendientes · 2 sin responsable», «Cuentas · 3 transferencias pendientes».

La home muestra resúmenes y acciones prioritarias. Las listas, formularios completos y detalles viven en las pantallas correspondientes. Los resúmenes se derivan de datos reales; «cargando» o «sin datos» no se representa como cero.

### Servicios y límites

| Servicio | Contenido | Acceso prioritario |
|---|---|---|
| Invitados | Participantes, confirmaciones, acompañantes y mi respuesta | Siempre disponible para participantes |
| Fecha y lugar | Disponibilidad y coincidencias cuando está OPEN; fecha/lugar definidos cuando está CONFIRMED | Destacado mientras falta fecha |
| Compra y aportes | Comida/bebida, productos, cantidades y quién aporta | Según servicios activos |
| Pendientes y útiles | Necesidades, equipo y tareas: parrilla, parlante, carbón, reservar/limpiar; responsables y estado | Según servicios activos |
| Alimentación | Preferencias existentes y cómo se resolverá cada menú | Acceso propio, enlazado desde compra; no depende de tener fecha |
| Gastos y cuentas | Gastos cargados, reparto, cierre y transferencias | Una entrada, con vistas internas «Gastos» y «Transferencias» |
| Juegos | Mazos y ronda actual en un teléfono | Según servicios activos |

Decisión confirmada: la calculadora vive en Gastos y cuentas, junto a las transferencias. Son vistas del mismo servicio y comparten la misma fuente de datos. Un estimador de comida/bebida queda fuera de esta mejora. Una proyección de compra nunca debe convertirse automáticamente en un gasto real ni en una deuda.

### Evitar duplicación entre compra y pendientes

El límite debe ser funcional: un aporte detalla producto/cantidad; una necesidad representa algo por resolver. Un mismo objeto puede participar de ambos procesos.

Para el primer cambio de navegación se conservan las fuentes de datos existentes y se definen etiquetas claras. No se copian registros automáticamente entre listas ni se suman sus contadores como si fueran elementos independientes.

Como evolución de producto, una necesidad podría enlazarse con un aporte («resolver mediante una compra/aporte»). El responsable y estado derivados deben tener una fuente de verdad definida; evitar la edición independiente del mismo compromiso en dos módulos. La relación y migración necesarias requieren diseño específico antes de implementar esa vinculación. La modularización por sí sola no resuelve este solapamiento preexistente.

## Navegación

- En celular: Inicio, Invitados, Servicios y Mi parte. Desde Inicio, un toque abre un servicio. «Servicios» reúne los accesos y, para quien organiza, la gestión de herramientas. Dentro de un servicio hay regreso al inicio y acceso al selector de servicios.
- En escritorio: barra lateral con Inicio y servicios activos; cabecera compacta con contexto de la juntada.
- Cada servicio tiene URL propia. Atrás del navegador vuelve al recorrido anterior; recargar mantiene la pantalla y sesión.
- Ejemplo de rutas propuestas: `/j/:slug`, `/j/:slug/invitados`, `/j/:slug/fecha`, `/j/:slug/compra`, `/j/:slug/pendientes`, `/j/:slug/alimentacion`, `/j/:slug/cuentas`, `/j/:slug/cuentas/transferencias`, `/j/:slug/juegos`. «Mi parte» puede usar `/j/:slug/mi-parte`.
- Los enlaces compartidos existentes siguen abriendo la juntada. Los accesos directos a servicios privados conservan el contexto público y solicitan sumarse; después del ingreso vuelven al destino solicitado.
- Desaparece el marketing repetido dentro de la juntada. La landing conserva su explicación del producto.

## Servicios por juntada: dirección confirmada

El usuario confirmó que el organizador elige los servicios de cada juntada. Recomendación: Invitados y contexto básico son permanentes. El organizador elige herramientas opcionales; un invitado puede usar las activadas, pero no cambiar la configuración global.

La activación se guarda en el backend por juntada, se refleja en todos los dispositivos y se verifica también en los endpoints. Ocultar un botón por sí solo no deshabilita un servicio.

Desactivar un servicio no elimina información. Propuesta para servicios con datos: archivar y permitir consulta, bloquear nuevos cambios y poder reactivar. Gastos con saldos pendientes requieren conservar acceso de lectura y resolución de pagos; una opción inicial más simple es impedir su desactivación hasta que estén resueltos. Recomendación para la primera versión: impedir desactivar Cuentas mientras existan transferencias pendientes; para otros servicios, archivar con lectura y reactivación.

Las juntadas existentes conservan acceso a sus funciones y datos. Primero se puede entregar la navegación modular con los servicios actuales disponibles; luego agregar configuración persistente. Evitar introducir esta configuración como requisito adicional para crear una juntada.

## Reglas comunes

- Vista pública: conserva privacidad de P0; nombres, asistencia detallada, alimentación, cuentas y necesidades sólo para participantes autorizados.
- OPEN: disponibilidad activa, RSVP no aplicable. Preparativos y alimentación no deben exigir confirmar fecha por una limitación de composición de la pantalla.
- CONFIRMED: RSVP y acompañantes activos; planificación y cuentas según herramientas habilitadas.
- CANCELLED: información conservada, mutaciones bloqueadas, contexto de cancelación visible en todos los módulos.
- Un error de carga de un servicio no bloquea el acceso a los demás.
- Los contadores del inicio y de los servicios se actualizan sin recargar. La reconexión recupera cambios aunque el usuario haya estado en otra pantalla.
- La base usada para repartir gastos no cambia por este rediseño. No se debe asumir que asistentes/acompañantes y participantes que pagan son el mismo número.
- «Mis pendientes» sólo muestra acciones que el usuario puede realizar; las acciones exclusivas del organizador se señalan y no aparecen para invitados.

## Arquitectura propuesta

`GatheringLayout` mantiene el contexto de la juntada, la sesión, el socket, cabecera y navegación. Un `Outlet` presenta el servicio activo. La clave de remontaje es el slug, no el servicio: navegar dentro de la misma juntada no debe recrear sesión ni socket.

Un registro pequeño de servicios describe identificador, título, ruta, icono, permisos, estados admitidos y función para producir el resumen. Esta separación permite agregar herramientas sin seguir creciendo un único componente. No requiere microservicios, servidores nuevos ni un sistema de plugins externos.

Cada módulo carga sus datos cuando corresponde y reutiliza el caché compartido. Los eventos de socket invalidan las queries afectadas incluso si el módulo no está montado; al volver se muestran los datos vigentes. Migrar estado local de compra/gastos mediante extracciones pequeñas, sin mantener dos fuentes de verdad ni múltiples suscripciones a la misma sala.

Para los contadores del inicio, medir primero las consultas necesarias. Se pueden reutilizar queries pequeñas actuales. Si consultar todos los detalles resulta costoso, agregar una proyección de resúmenes autenticada, sin incorporarla a la representación pública.

## Secuencia de implementación propuesta

1. **Cerrar diseño funcional:** nombres, límites entre compra/pendientes y reglas de archivo. Calculadora como gastos/transferencias y servicios configurables ya están confirmados. Validar navegación con un boceto.
2. **Entregar núcleo navegable:** layout y sesión persistentes; Inicio, Invitados y Pendientes en rutas propias; conservar accesos temporales al resto durante la extracción, sin duplicar editores.
3. **Completar servicios actuales:** extraer Compra, Alimentación, Gastos/Transferencias, Fecha y Juegos. Revisar borradores al cambiar de pantalla y quitar el contenido de marketing del espacio de coordinación.
4. **Agregar elección de servicios:** configuración por juntada, permisos, reglas de archivo/desactivación, compatibilidad con juntadas anteriores y notificación de configuración en vivo. La elección de servicios ya está confirmada por el usuario; resta diseñar su contrato y migración.
5. **Refinar tareas personales y rendimiento:** completar «Mi parte», resúmenes, carga diferida por módulo y verificación integral. El estimador de comida/bebida queda fuera de esta mejora.

## Criterios de aceptación

- Desde Inicio se llega en un toque a un servicio activo; ningún servicio requiere recorrer toda la página.
- Abrir/recargar enlaces de módulos y usar Atrás conserva el contexto y la sesión.
- Cambiar de módulo no abre conexiones duplicadas ni pierde cambios confirmados. Los borradores se conservan o se advierte antes de descartarlos.
- Dos sesiones ven cambios de asistencia, compra, pendientes y gastos mientras están en módulos diferentes; los resúmenes coinciden al regresar.
- Alimentación es accesible sin atravesar la compra ni confirmar fecha.
- La app funciona con teclado, en 375/430 px y en escritorio, sin una fila de siete pestañas comprimidas.
- Se prueban invitado, organizador, acceso público, OPEN, CONFIRMED, CANCELLED, reconexión y errores parciales.
- No cambia el cálculo de gastos ni se convierten automáticamente previsiones de compra en gastos.

## Decisiones confirmadas

- Calculadora: dividir gastos y calcular transferencias, dentro de un mismo servicio.
- Cada juntada elige sus servicios; quien organiza administra la activación.

## Propuestas de detalle a validar con el boceto

1. Qué nombre entiende mejor el grupo para las necesidades: «Pendientes y útiles», «Preparativos» o «Qué falta resolver».
2. Regla de desactivación de un servicio que ya tiene datos, especialmente deudas pendientes.
