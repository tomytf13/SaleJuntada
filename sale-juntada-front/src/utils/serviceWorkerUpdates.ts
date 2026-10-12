export function watchServiceWorkerUpdates(registration: Pick<ServiceWorkerRegistration, "update">) {
  let checking = false;
  const checkForUpdate = () => {
    if (!checking && navigator.onLine && document.visibilityState === "visible") {
      checking = true;
      void registration.update().catch(() => { /* Reintentar con conexión. */ }).finally(() => { checking = false; });
    }
  };
  const timer = window.setInterval(checkForUpdate, 60_000);
  window.addEventListener("online", checkForUpdate);
  document.addEventListener("visibilitychange", checkForUpdate);
  checkForUpdate();
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("online", checkForUpdate);
    document.removeEventListener("visibilitychange", checkForUpdate);
  };
}
