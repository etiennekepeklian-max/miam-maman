import fs from 'node:fs/promises';
import {Script} from 'node:vm';
const raw=await fs.readFile('recovery/google-response.html','utf8');
const literal=raw.match(/goog\.script\.init\(("(?:\\.|[^"\\])*")/)[1];
const config=JSON.parse(JSON.parse(literal.replace(/\\x([0-9a-f]{2})/gi,(_,h)=>'\\u00'+h)));
const html=config.userHtml;
if(!html.includes("family-v7")||!html.includes('MiamUpdates'))throw Error('Version Google inattendue');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
if(scripts.length!==5)throw Error('Structure inattendue');
for(const [i,file] of ['core','transport','offline','app'].entries()){
  new Script(scripts[i+1]);
  await fs.writeFile('src/'+file+'.js',scripts[i+1].trimStart());
}
await fs.writeFile('src/style.css',html.match(/<style>([\s\S]*?)<\/style>/)[1]);
let template=html.replace(/<style>[\s\S]*?<\/style>/,'<style>/*__STYLE__*/</style>').replace('</head>','<!--__PWA_HEAD__-->\n</head>');
const names=['CONFIG','CORE','TRANSPORT','OFFLINE','APP'];let i=0;
template=template.replace(/<script[^>]*>[\s\S]*?<\/script>/g,()=>'<script>/*__'+names[i++]+'__*/</script>');
await fs.writeFile('src/index.html',template);
let coreTest=await fs.readFile('tests/core.test.mjs','utf8');
coreTest=coreTest.replace("{locations:[],meals:[],events:[],suggestions:[]}","{locations:[],meals:[],events:[],suggestions:[],categories:[{id:'dish',name:'Plats préparés',emoji:'art:pot'},{id:'vegetable',name:'Légumes non cuisinés',emoji:'art:vegetables'},{id:'meat',name:'Viande, lardons et jambon',emoji:'art:meat'}],shopping:[]}");
await fs.writeFile('tests/core.test.mjs',coreTest);
let offlineTest=await fs.readFile('tests/offline.test.mjs','utf8');
offlineTest=offlineTest.replace("assert.equal((await c.snapshot()).queue.length,1);await c.sync();","assert.equal((await c.snapshot()).queue.length,1);await c.sync();assert.equal((await c.snapshot()).queue.length,1);await c.sync(true);");
await fs.writeFile('tests/offline.test.mjs',offlineTest);
let sw=await fs.readFile('src/sw.js','utf8');
sw=sw.replace(/(const CACHE\s*=\s*|var CACHE\s*=\s*)(['"])[^'"]+\2/,"$1'miam-shell-family-v7-20261104'");
await fs.writeFile('src/sw.js',sw);
console.log('Client Google v7 restauré sans appel aux données de stock.');

let backend=await fs.readFile('google-apps-script/Code.gs','utf8');
backend=backend.replace('JSON.stringify(args.payload).length>4000',"JSON.stringify(args.payload).length>(action==='stock.batch'?12000:4000)");
backend=backend.replace('"suggestion.seen"];','"suggestion.seen","category.add","category.edit","category.delete","stock.batch","meal.move","shopping.add","shopping.check","shopping.delete"];');
await fs.writeFile('google-apps-script/Code.gs',backend);

let readme=await fs.readFile('README.md','utf8');
readme=readme.replace(/## Aide\n[\s\S]*?(?=\n## Illustrations)/,'## Aide\n\nNeuf guides illustrés et animés expliquent : ranger plusieurs produits, prendre une quantité, modifier un produit, gérer les emplacements, gérer les catégories, déplacer du stock, préparer les courses, vérifier un inventaire et utiliser le mode hors connexion. Les GIF se lancent volontairement et peuvent être arrêtés. Les exemples ne créent aucun stock.\n');
readme+='\n## Version famille 7 — 4 novembre 2026\n\nAccueil propose **Je range**, **Je prends** et **Je regarde le stock**. Le **Menu** réunit les catégories, emplacements, courses, inventaire, historique et suggestions. Les ajouts groupés acceptent dix lignes maximum ; une ligne invalide annule toute la série. Le détail regroupe les lots par produit et emplacement et conserve leurs dates.\n\nLes catégories sont modifiables. Une suppression demande un reclassement si des produits y sont rattachés. Un emplacement occupé peut être supprimé après choix du rangement de destination. Un déplacement partiel conserve la quantité totale et la date du lot. La liste de courses est partagée ; la cocher ne modifie pas le stock. L’inventaire vérifie la quantité attendue pour éviter d’écraser une prise concurrente.\n\n**Les nouveautés** apparaissent à la prochaine ouverture pour chaque profil sur chaque appareil, jusqu’à confirmation. **Revoir les nouveautés** les rouvre. Le mode hors connexion conserve les actions et espace les tentatives après une erreur réseau. Le bouton de reprise permet une nouvelle tentative explicite.\n\nLe client a été récupéré depuis la version Google déjà déployée. La publication GitHub conserve la même URL Google et ne modifie aucune donnée familiale. Le contrôle automatisé utilise un stock fictif isolé.\n';
await fs.writeFile('README.md',readme);
