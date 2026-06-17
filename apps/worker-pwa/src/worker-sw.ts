/// <reference lib="webworker" />

export {};

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = "worker-pwa-shell-v1";
const APP_SHELL_URLS = ["/", "/manifest.webmanifest", "/worker-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/"));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request: Request, fallbackUrl: string): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? (await cache.match(fallbackUrl)) ?? Response.error();
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  cache.put(request, response.clone()).catch(() => {});
  return response;
}
