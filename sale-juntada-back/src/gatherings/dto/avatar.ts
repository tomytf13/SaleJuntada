/**
 * Reglas para los campos `avatarUrl` que puede setear alguien sin sesión
 * verificada (unirse a una juntada sin login, o crearla sin login).
 *
 * Antes se aceptaba cualquier string. Como el front lo renderiza directo en
 * un `<img src>`, alguien podía sumarse a una juntada con una URL apuntando a
 * su propio servidor y quedarse con la IP y el user-agent de cada persona que
 * abriera el link.
 *
 * Se permiten tres formas:
 * - un emoji de la lista (`emoji:🦆`)
 * - una imagen que el propio navegador comprimió a data URI
 * - la foto de perfil de Google, cuando quien crea o se suma ya tiene sesión
 *   iniciada con Supabase (Google es el único proveedor OAuth configurado;
 *   ver `auth/AuthContext.tsx`). Esas fotos siempre están en
 *   `*.googleusercontent.com`.
 *
 * El flujo autenticado (`AuthParticipantDto`, participantes vinculados con
 * `authUserId`) no pasa por esta validación: ahí la identidad ya está
 * verificada por el JWT de Supabase, así que el origen del avatar es un
 * riesgo menor y requiere una cuenta real, no sólo conocer el link.
 */

/**
 * ~60 KB: alcanza de sobra para el recorte de 192×192 en JPEG q=0.68 que hace
 * el front (`makeAvatarThumbnail`), con margen para fotos con mucho detalle.
 */
export const AVATAR_MAX_LENGTH = 60_000;

export const AVATAR_PATTERN =
  /^(emoji:.{1,8}|data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}|https:\/\/[a-zA-Z0-9-]+\.googleusercontent\.com\/.*)$/;
