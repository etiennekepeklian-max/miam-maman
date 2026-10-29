/* Only the application shell is cached. Never cache authenticated API data. */
const CACHE='miam-shell-v3';
const ROOT=new URL('./',self.location.href).href;
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll([ROOT,new URL('manifest.webmanifest',ROOT).href,new URL('icon-192.png',ROOT).href,new URL('icon-512.png',ROOT).href])).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('miam-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==self.location.origin||u.search||!['','index.html','manifest.webmanifest','icon-192.png','icon-512.png'].some(p=>u.href===new URL(p,ROOT).href))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok&&r.type==='basic'&&new URL(r.url).pathname===u.pathname){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match(ROOT))));
});
