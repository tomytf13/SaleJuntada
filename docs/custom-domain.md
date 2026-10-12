# Dominio propio: salejuntada.com.ar

Proyecto Vercel: `sale-juntada-front` (`prj_ReJNAwEf5ujBMoNduUMTO2J7AjmX`). El dominio raíz está asociado al proyecto. La asociación no implica DNS propagado ni HTTPS disponible.

## Estado al 11 de octubre de 2026

- Vercel acepta la asociación y verifica la titularidad para el proyecto.
- DNS público devuelve NXDOMAIN para NS, SOA, A, AAAA, MX y TXT. No hay delegación pública visible todavía.
- Se solicitó preparar una zona Vercel; la respuesta conserva `zone: false` y no entrega nameservers. No asumir una zona creada ni inventar nameservers.
- API: mantener los orígenes Vercel y locales existentes y agregar `https://salejuntada.com.ar` a `FRONTEND_URLS`.
- Pendiente: sesión del titular en NIC/TAD para comprobar el dominio y su delegación; acceso al proyecto Supabase SaleJuntada para ajustar las URL de retorno.

## Registros recomendados por Vercel

Consulta de configuración para este dominio y proyecto:

- A (prioridad 1): `216.198.79.1`, `64.29.17.1`.
- CNAME recomendado: `5329a9f65deee2c5.vercel-dns-017.com.`

Volver a consultar Vercel antes de configurar. No crear CNAME en el apex si el proveedor no soporta aplanamiento. Si se opta por delegar DNS a Vercel, obtener los nameservers asignados en su panel y comprobar la zona antes de modificar NIC. Preservar cualquier registro de correo u otro servicio que aparezca en el panel del titular.

## Ingreso con Google

Supabase correcto: `reetfwqhhupuohtcpbsv`.

La aplicación usa `window.location.origin + window.location.pathname` como destino de OAuth. Agregar `https://salejuntada.com.ar/` y los retornos bajo `/j/**` a las URL permitidas; mantener el dominio Vercel durante la transición. Ajustar Site URL una vez que HTTPS funcione. No usar comodines de host ni modificar las credenciales de Google. El callback de Google continúa siendo el de Supabase.

Las sesiones del navegador pertenecen a cada origen: un usuario que abre el dominio nuevo puede necesitar ingresar de nuevo con Google. Sus juntadas se recuperan por la misma cuenta.

## Verificación antes de cambiar enlaces oficiales

1. Resolver DNS desde más de un servidor y verificar HTTPS.
2. Verificar CORS HTTP y Socket.IO desde el dominio nuevo.
3. Ingresar con Google desde una invitación y regresar a esa juntada.
4. Abrir Mi cuenta y recuperar juntadas existentes.
5. Compartir invitaciones desde el dominio nuevo y comprobarlas sin sesión.
6. Recién entonces actualizar URL canónica, sitemap y redirecciones. No redirigir el dominio Vercel a un dominio todavía inaccesible.
