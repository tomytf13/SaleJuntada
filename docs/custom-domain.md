# Dominio propio: salejuntada.com.ar

Proyecto Vercel: `sale-juntada-front` (`prj_ReJNAwEf5ujBMoNduUMTO2J7AjmX`).

## Estado al 12 de octubre de 2026

- Delegación NIC propagada: `ns1.vercel-dns.com`, `ns2.vercel-dns.com`.
- DNS autoritativo y resolvedor público confirman la delegación; Vercel informa `misconfigured: false`.
- `https://salejuntada.com.ar/` responde HTTP 200 con certificado válido.
- CORS de la API acepta `https://salejuntada.com.ar`.
- Google Search Console: propiedad de dominio verificada mediante TXT. Conservar el registro de verificación en Vercel DNS.

## Indexación

- Dirección canónica del inicio: `https://salejuntada.com.ar/`.
- Sitemap público: `/sitemap.xml`, únicamente con la landing. No enumerar invitaciones ni datos de participantes.
- `/robots.txt` permite rastreo para que los buscadores puedan leer las instrucciones `noindex`.
- `/j/*` envía `X-Robots-Tag: noindex, nofollow`; el router también aplica meta robots a páginas distintas del inicio y elimina su canonical.
- Metadatos Open Graph y WebSite usan el dominio propio.
- La verificación y el envío de un sitemap no garantizan indexación ni posiciones; consultar Search Console para comprobar el resultado.

## Ingreso con Google

Supabase: `reetfwqhhupuohtcpbsv`. Las URL de retorno del dominio raíz y `/j/**` están permitidas, junto al dominio Vercel anterior. La aplicación usa el origen y ruta actuales como retorno OAuth; el callback del proveedor Google sigue siendo el de Supabase.

Las sesiones son por origen: puede ser necesario volver a ingresar en el dominio nuevo, usando la misma cuenta para recuperar juntadas. Mantener el dominio Vercel operativo durante la transición para no romper sesiones o invitaciones anteriores.
