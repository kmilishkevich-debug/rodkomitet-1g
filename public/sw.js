/* Сервис-воркер «Наш 1 «Г»».
   Стратегия: network-first — всегда пробуем свежую версию из сети,
   кэш используется только как запасной вариант без интернета. */

const CACHE = "rk1g-v1";
const OFFLINE_URLS = ["/", "/manifest.json", "/mascot.jpg", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(OFFLINE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // шрифты Google и пр. — мимо кэша

  e.respondWith(
    fetch(req)
      .then((res) => {
        // свежий ответ кладём в кэш (для страниц кэшируем по пути без query)
        const copy = res.clone();
        const key = req.mode === "navigate" ? "/" : req;
        caches.open(CACHE).then((c) => c.put(key, copy));
        return res;
      })
      .catch(() =>
        caches.match(req.mode === "navigate" ? "/" : req).then(
          (cached) =>
            cached ||
            new Response("Нет подключения к интернету", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
        )
      )
  );
});

/* --- Основа для пуш-уведомлений (подключим позже, когда появится сервер) --- */
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { body: e.data && e.data.text() };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || "Наш 1 «Г»", {
      body: data.body || "Есть новости в классе",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
