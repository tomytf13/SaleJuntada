# Integración con Google Calendar

## Objetivo

Reducir al mínimo la carga manual de disponibilidad. Cada participante puede
conectar Google Calendar y Sale Juntada usa sus bloques ocupados para descartar
horarios incompatibles dentro del rango de la juntada.

La integración es opcional. El link público y la carga manual deben seguir
funcionando sin una cuenta de Google.

## Experiencia esperada

1. El participante abre el link de una juntada e ingresa su nombre.
2. Puede marcar horarios manualmente o elegir **Conectar Google Calendar**.
3. Google solicita consentimiento individual.
4. Sale Juntada importa únicamente intervalos de ocupado/libre para el rango de
   fechas de esa juntada.
5. El participante revisa el resultado, agrega excepciones y confirma.
6. El algoritmo combina disponibilidades manuales e importadas.
7. Cuando la juntada se cierra, cada persona puede agregar el evento confirmado
   a su calendario mediante una acción separada y explícita.

## Privacidad y seguridad

- Solicitar el alcance mínimo
  `https://www.googleapis.com/auth/calendar.freebusy`.
- No leer ni guardar títulos, invitados, descripciones, ubicaciones o enlaces
  de los eventos personales.
- Mostrar al resto del grupo sólo la disponibilidad resultante, nunca el
  contenido del calendario.
- Cifrar los refresh tokens en la base de datos y mantener las credenciales de
  Google fuera del repositorio.
- Permitir desconectar la cuenta y eliminar los tokens guardados.
- Usar `state` en OAuth para vincular de forma segura el retorno con el
  participante y prevenir solicitudes falsificadas.
- No sobrescribir ajustes manuales sin confirmación.

## Alcance técnico

### Backend

- OAuth 2.0 de aplicación web ejecutado por NestJS.
- Endpoint para iniciar la autorización por participante.
- Callback OAuth con validación de `state`.
- Tokens cifrados asociados al participante, no a toda la juntada.
- Consulta `freeBusy.query` limitada a `windowStart` y `windowEnd`.
- Sincronización bajo demanda y registro de la fecha de última actualización.
- Revocación y borrado de la conexión.
- Renovación del access token mediante refresh token.

Variables previstas:

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3001/api/integrations/google-calendar/callback
GOOGLE_TOKEN_ENCRYPTION_KEY=
GOOGLE_CALENDAR_TIME_ZONE=America/Argentina/Tucuman
```

### Frontend

- Botón **Conectar Google Calendar** junto a la disponibilidad manual.
- Explicación previa: “Sólo veremos cuándo estás ocupado”.
- Estados conectado, sincronizando, actualizado, error y desconectado.
- Vista previa de los horarios inferidos antes de guardarlos.
- Opción para volver a sincronizar y para desconectar.

### Matching

- Los bloques ocupados descartan candidatos que se superpongan.
- Los ajustes manuales tienen prioridad sobre la importación automática.
- Una sincronización no debe cambiar una juntada ya confirmada.
- Diferenciar “sin respuesta” de “calendario libre” para no elevar
  artificialmente el puntaje.

## Criterios de aceptación

- Cada integrante autoriza solamente su propio calendario.
- El sistema puede obtener ocupado/libre sin leer detalles de eventos.
- Un integrante sin Google Calendar completa el flujo manual normalmente.
- El usuario revisa y confirma la disponibilidad importada.
- Desconectar elimina los tokens y detiene futuras sincronizaciones.
- Fallos o revocaciones de Google no eliminan la disponibilidad manual.
- El matching explica cuántas personas están disponibles y cuántas aún no
  respondieron.

## Fases

1. Conexión OAuth y consulta manual de ocupado/libre.
2. Conversión de bloques ocupados en propuestas revisables.
3. Sincronización periódica antes de confirmar.
4. Creación opcional del evento final en Google Calendar.

## Referencias oficiales

- [OAuth 2.0 para aplicaciones web de servidor](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Calendar FreeBusy](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
- [Scopes de Google Calendar](https://developers.google.com/workspace/calendar/api/auth)
