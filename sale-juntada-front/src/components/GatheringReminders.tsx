import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reminderPreferences } from "../services/gatheringService";

function deviceId() {
  const key = "sale-juntada:reminder-device";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function GatheringReminders({
  gatheringId,
  participantId,
  token,
}: {
  gatheringId: string;
  participantId: string;
  token: string;
}) {
  const supported =
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
  const [device] = useState(() => (supported ? deviceId() : ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const settings = useQuery({
    queryKey: ["reminders", gatheringId, participantId, device],
    enabled: supported,
    queryFn: () =>
      reminderPreferences(gatheringId, participantId, device, token, "GET"),
  });
  useEffect(() => {
    let active = true;
    if (supported)
      void navigator.serviceWorker
        .getRegistration()
        .then((r) => r?.pushManager.getSubscription())
        .then((s) => {
          if (active) setSubscribed(Boolean(s));
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [supported]);

  const enabled = Boolean(
    settings.data?.enabled &&
    subscribed &&
    Notification.permission === "granted",
  );
  const toggle = async () => {
    setBusy(true);
    setError("");
    try {
      if (enabled) {
        await reminderPreferences(
          gatheringId,
          participantId,
          device,
          token,
          "DELETE",
        );
      } else {
        if ((await Notification.requestPermission()) !== "granted") {
          throw new Error(
            "Para recibir avisos, habilitá las notificaciones en los permisos del navegador.",
          );
        }
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration?.active)
          throw new Error("Volvé a abrir la app cuando termine de instalarse.");
        const publicKey = settings
          .data!.publicKey.replace(/-/g, "+")
          .replace(/_/g, "/");
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: Uint8Array.from(atob(publicKey), (c) =>
              c.charCodeAt(0),
            ),
          }));
        const keys = subscription.toJSON().keys;
        if (!keys?.auth || !keys.p256dh)
          throw new Error("El navegador no pudo registrar este dispositivo.");
        await reminderPreferences(
          gatheringId,
          participantId,
          device,
          token,
          "PUT",
          {
            endpoint: subscription.endpoint,
            auth: keys.auth,
            p256dh: keys.p256dh,
          },
        );
        setSubscribed(true);
      }
      await settings.refetch();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo actualizar el aviso.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="gathering-personal">
      <h2>Recordatorios de esta juntada</h2>
      <p>
        Cada 30 minutos te avisamos si te falta responder si vas, cargar tus
        gastos o confirmar una transferencia.
      </p>
      {supported ? (
        <button
          type="button"
          className="primary-button"
          onClick={() => void toggle()}
          disabled={busy || !settings.data}
        >
          {busy
            ? "Guardando…"
            : enabled
              ? "Desactivar en este dispositivo"
              : "Activar en este dispositivo"}
        </button>
      ) : (
        <p>
          Para recibir avisos en iPhone, agregá la app a la pantalla de inicio y
          abrila desde ahí. En otros dispositivos, usá un navegador compatible
          con notificaciones.
        </p>
      )}
      {settings.isError && (
        <button type="button" onClick={() => void settings.refetch()}>
          Reintentar la carga de preferencias
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      <p>
        Con la app abierta suenan dos notas cortas. Con la app cerrada se usa el
        sonido de tu dispositivo.
      </p>
      <audio
        controls
        preload="none"
        aria-label="Escuchar el sonido del recordatorio"
        src="/aviso-mate.wav"
        style={{ maxWidth: "100%" }}
      />
    </section>
  );
}
