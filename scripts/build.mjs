import fs from 'node:fs/promises';
const root = new URL('../',import.meta.url);
const sharedUrl=(process.env.MIAM_GOOGLE_WEBAPP_URL||'').trim();
if(sharedUrl && !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(sharedUrl))throw new Error('MIAM_GOOGLE_WEBAPP_URL doit être une URL de déploiement Google Apps Script terminée par /exec.');
if(process.env.MIAM_REQUIRE_SHARED_BACKEND==='1'&&!sharedUrl)throw new Error('Publication arrêtée : renseigner MIAM_GOOGLE_WEBAPP_URL après activation et vérification du service Google.');
const read=p=>fs.readFile(new URL(p,root),'utf8');
const [template,css,core,app,mascot]=await Promise.all([read('src/index.html'),read('src/style.css'),read('src/core.js'),read('src/app.js'),fs.readFile(new URL('src/mascot.webp',root))]);
const html=template.replace('/*__STYLE__*/',css).replace('/*__CORE__*/',core).replace('/*__APP__*/',app).replaceAll('__MASCOT__','data:image/webp;base64,'+mascot.toString('base64'));
await fs.mkdir(new URL('dist/',root),{recursive:true});
const pwaHead='<link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icon-192.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default">';
const registration='<script>if("serviceWorker" in navigator && location.protocol==="https:"){navigator.serviceWorker.register("./sw.js").catch(()=>{});}</script>';
let pagesHtml=html.replace('<!--__PWA_HEAD__-->',pwaHead).replace('</body>',registration+'</body>');
if(sharedUrl){
  // GitHub Pages is static. The shared application executes on the owner's Google service.
  // Never present the local preview adapter as shared storage or embed a Google login in an iframe.
  const launcher=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fff8ec"><title>Miam Maman !</title>${pwaHead}<style>${css}</style></head><body><main class="welcome" style="max-width:620px;margin:4vh auto;padding:24px"><img class="welcome-mascot" src="data:image/webp;base64,${mascot.toString('base64')}" alt="Notre cocotte souriante"><p class="eyebrow">LA CUISINE DE TOUTE LA FAMILLE</p><h1>Miam Maman !</h1><p>Retrouvez les plats et les portions de la maison.</p><a class="primary" href="${sharedUrl}">Ouvrir le stock familial →</a><p class="small muted" style="margin-top:24px">Choisissez MLK, GK ou EK pour retrouver le stock de la maison. Une connexion Internet est nécessaire.</p><button class="quiet" id="install" type="button">Installer Miam Maman sur mon téléphone</button><p class="small muted" id="help" hidden>Android : menu ⋮ de Chrome → Ajouter à l’écran d’accueil. iPhone : Safari → Partager → Sur l’écran d’accueil. L’icône ouvre cette page, puis le bouton ouvre votre stock Google.</p></main><script>let pending;addEventListener('beforeinstallprompt',e=>{e.preventDefault();pending=e;});document.getElementById('install').onclick=async()=>{if(pending){await pending.prompt();pending=null;}else document.getElementById('help').hidden=false;};</script></body></html>`;
  pagesHtml=launcher.replace('</body>',registration+'</body>');
}
await fs.writeFile(new URL('dist/index.html',root),pagesHtml);
await fs.writeFile(new URL('google-apps-script/Index.html',root),html.replace('<!--__PWA_HEAD__-->',''));
await fs.writeFile(new URL('google-apps-script/Core.gs',root),core);
for(const f of ['manifest.webmanifest','sw.js','icon-192.png','icon-512.png'])await fs.copyFile(new URL('src/'+f,root),new URL('dist/'+f,root));
console.log(sharedUrl?'Built GitHub Pages launcher and Google Apps Script application.':'Built local preview and Google Apps Script application.');
