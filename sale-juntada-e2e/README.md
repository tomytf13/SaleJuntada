# Pruebas de acceso

La suite de humo usa una cuenta ficticia en el navegador y respuestas HTTP interceptadas. Su JWT no es válido para la API real; no hay rutas ni excepciones de autenticación de prueba en la aplicación. Incluye el rechazo de participación sin sesión, incluso si queda una credencial antigua en el navegador.

Las pruebas con PostgreSQL (`E2E_REAL_DB=1`) requieren además sesiones vigentes de cuentas de prueba distintas: `E2E_AUTH_TOKEN` y `E2E_FRIEND_AUTH_TOKEN`, junto con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` del entorno de prueba. El caso de cuentas que incorpora un tercer participante usa `E2E_THIRD_AUTH_TOKEN`. Usar sólo una base y cuentas de prueba; estas pruebas crean juntadas. No guardar tokens en el repositorio.
