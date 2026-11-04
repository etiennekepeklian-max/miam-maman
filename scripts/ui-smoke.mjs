import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import assert from 'node:assert/strict';
const server=http.createServer(async(req,res)=>{try{const file=req.url==='/'?'index.html':req.url.slice(1);res.end(await fs.readFile('dist/'+file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/');
  await page.locator('[data-profile="EK"]').click();
  await page.locator('#releaseTitle').waitFor();
  await page.locator('#acknowledgeRelease').click();
  assert.equal(await page.locator('[data-intent]').count(),3);
  await page.locator('#homeHelp').click();
  assert.equal(await page.locator('[data-play-guide]').count(),9);
  for(const details of await page.locator('details').all())await details.evaluate(el=>el.open=true);
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('img[id^="help-"]')).every(i=>i.complete&&i.naturalWidth>0));
  await page.locator('[data-page="menu"]').click();
  await page.locator('[data-go="shopping"]').click();
  assert.match(await page.locator('#app').innerText(),/courses/i);
  await page.locator('[data-page="home"]').click();
  assert.equal(await page.locator('#releaseTitle').count(),0);
  await page.locator('#reviewRelease').click();
  await page.locator('#releaseTitle').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('Mobile and desktop navigation, 9 guides, release notice and image loading passed.');
}finally{await browser.close();server.close();}
