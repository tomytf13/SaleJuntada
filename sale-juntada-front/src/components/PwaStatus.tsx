import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const dismissalKey = "sale-juntada:pwa-install-dismissed:v1";

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function PwaStatus() {
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(dismissalKey) === "true",
  );
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const canOfferInstall =
    !dismissed && !isStandalone() && (Boolean(installPrompt) || isIosDevice());
  if (!needRefresh && !offlineReady && online && !canOfferInstall) return null;

  const dismissInstall = () => {
    localStorage.setItem(dismissalKey, "true");
    setDismissed(true);
    setShowIosHelp(false);
  };

  return (
    <aside className="pwa-status" aria-live="polite">
      {!online ? (
        <div>
          <strong>Estás sin conexión</strong>
          <span>Podés revisar la app; para guardar cambios necesitás internet.</span>
        </div>
      ) : needRefresh ? (
        <div>
          <strong>Hay una versión nueva</strong>
          <span>Actualizá para usar las últimas mejoras.</span>
          <div className="pwa-status-actions">
            <button type="button" onClick={() => void updateServiceWorker(true)}>
              Actualizar
            </button>
            <button type="button" onClick={() => setNeedRefresh(false)}>
              Más tarde
            </button>
          </div>
        </div>
      ) : offlineReady ? (
        <div>
          <strong>Sale Juntada quedó lista</strong>
          <span>La interfaz básica ya puede abrirse sin conexión.</span>
          <button type="button" onClick={() => setOfflineReady(false)}>
            Entendido
          </button>
        </div>
      ) : (
        <div>
          <strong>Instalá Sale Juntada</strong>
          <span>
            {showIosHelp
              ? "En Safari tocá Compartir y después ‘Agregar a inicio’."
              : "Abrila desde tu pantalla de inicio como una app."}
          </span>
          <div className="pwa-status-actions">
            <button
              type="button"
              onClick={async () => {
                if (!installPrompt) {
                  setShowIosHelp(true);
                  return;
                }
                await installPrompt.prompt();
                const choice = await installPrompt.userChoice;
                if (choice.outcome === "accepted") setInstallPrompt(null);
              }}
            >
              {isIosDevice() ? "Cómo instalar" : "Instalar"}
            </button>
            <button type="button" onClick={dismissInstall}>
              Ahora no
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
