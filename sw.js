const CACHE='porcia-pwa-v1.0';
const CORE=['./','./index.html','./pwa-bridge.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./favicon.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET' || new URL(req.url).origin!==self.location.origin)return;
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(response=>{
    if(response.ok&&new URL(req.url).pathname.endsWith('index.html')){const copy=response.clone();caches.open(CACHE).then(c=>c.put(req,copy));}
    return response;
  })));
});