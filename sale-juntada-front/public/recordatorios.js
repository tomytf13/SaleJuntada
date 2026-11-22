// Imported into the generated Workbox service worker.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const { title, body, url, tag } = event.data.json();
  if (typeof url !== "string" || !url.startsWith("/j/")) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window" });
      const foreground = windows.find(
        (client) => client.focused && client.visibilityState === "visible",
      );
      let played = false;
      if (foreground) {
        played = await new Promise((resolve) => {
          const channel = new MessageChannel();
          const finish = (result) => {
            clearTimeout(timeout);
            channel.port1.close();
            resolve(result);
          };
          const timeout = setTimeout(() => finish(false), 900);
          channel.port1.onmessage = (event) => finish(event.data === true);
          foreground.postMessage({ type: "sale-juntada-reminder" }, [
            channel.port2,
          ]);
        });
      }
      await self.registration.showNotification(title, {
        body,
        tag,
        icon: "/pwa-icon-192.png",
        silent: played,
        renotify: !played,
        data: { url },
      });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  const path = event.notification.data?.url;
  if (typeof path !== "string" || !path.startsWith("/j/")) return;
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = new URL(path, self.location.origin);
      if (url.origin !== self.location.origin) return;
      const windows = await self.clients.matchAll({ type: "window" });
      const target = windows.find((w) => w.url === url.href);
      if (target) await target.focus();
      else await self.clients.openWindow(url.href);
    })(),
  );
});
