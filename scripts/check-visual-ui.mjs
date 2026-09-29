import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const python=process.env.PYTHON || resolve('.venv/Scripts/python.exe');
mkdirSync('.cache',{recursive:true});mkdirSync('docs/screenshots/upgrade',{recursive:true});
const data=mkdtempSync(resolve('.cache/visual-e2e-'));
const env={...process.env,BOOKSHELF_DATA_DIR:data};
execFileSync(python,['-c','from backend.database import initialize; initialize()'],{env});
const origin='http://127.0.0.1:8002';
const server=spawn(python,['-m','uvicorn','backend.main:app','--host','127.0.0.1','--port','8002'],{env,windowsHide:true,stdio:'pipe'});
let log='';server.stderr.on('data',chunk=>log+=chunk.toString());
let browser;const errors=[];const checks=[];
function check(ok,label){if(!ok)throw Error(label);checks.push(label)}
try {
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin);
 await page.locator('[data-mode=register]').click();
 await page.locator('[name=display_name]').fill('林间');
 await page.locator('[name=username]').fill('visual_reader');
 await page.locator('[name=password]').fill('a quiet room for visual tests');
 await page.locator('[name=confirm_password]').fill('a quiet room for visual tests');
 await page.locator('.auth-submit').click();
 await page.locator('.account-name').waitFor();
 execFileSync(python,['-c','from backend.database import connection;\nwith connection() as db:\n db.execute("UPDATE books SET title=?,author=?,category=? WHERE id=1",("山海之间","约翰 · 缪尔","文学"))\n db.execute("UPDATE books SET title=?,author=?,category=? WHERE id=3",("人类简史","尤瓦尔 · 赫拉利","历史"))\n db.execute("UPDATE books SET title=?,author=?,category=? WHERE id=4",("小王子","安托万 · 德 · 圣埃克苏佩里","文学"))'],{env});
 await page.reload();await page.locator('.book').first().waitFor();
 await page.waitForTimeout(200);
 check(await page.locator('.book').count()===17,'All 17 books rendered');
 check(await page.locator('.face-out').count()===1,'One front-facing display book');
 for(const theme of ['modern','classic','dark','cozy']){
  await page.locator('.theme-trigger').click();
  await page.locator('[data-theme-id="'+theme+'"]').click();
  await page.waitForTimeout(650);
  await page.screenshot({path:'docs/screenshots/upgrade/'+theme+'-1440.png',fullPage:true});
 }
 await page.locator('.theme-trigger').click();
 await page.screenshot({path:'docs/screenshots/upgrade/theme-menu.png'});
 await page.locator('[data-theme-id=modern]').click();
 await page.waitForTimeout(500);
 const spine=page.locator('.book:not(.face-out)').first();
 await spine.click();
 await page.locator('.book-flight').waitFor();
 await page.waitForTimeout(170);
 await page.screenshot({path:'docs/screenshots/upgrade/book-in-motion.png'});
 await page.locator('.book-flight').waitFor({state:'detached'});
 await page.waitForTimeout(300);
 await page.screenshot({path:'docs/screenshots/upgrade/book-detail.png'});
 check(await page.locator('.room-main').evaluate(el=>el.inert),'Background inert while book is open');
 await page.locator('.close').click();
 await page.locator('.overlay').waitFor({state:'detached'});
 check(await page.locator('.book-away').count()===0,'Book returned without a missing spine');
 // Closing during extraction must not leave a floating actor or an invisible book.
 await spine.click();
 await page.keyboard.press('Escape');
 await page.locator('.overlay').waitFor({state:'detached'});
 check(await page.locator('.book-flight,.book-away').count()===0,'Interrupted extraction cleans up');
 for(const [width,height,label] of [[1280,800,'laptop'],[768,1024,'tablet'],[390,844,'mobile'],[320,740,'small-mobile']]){
  await page.setViewportSize({width,height});await page.waitForTimeout(350);
  const report=await page.evaluate(()=>{
   const viewport=document.documentElement.clientWidth;
   const books=[...document.querySelectorAll('.book')];
   return {overflow:document.documentElement.scrollWidth>viewport+1,books:books.length,clipped:books.filter(book=>{const r=book.getBoundingClientRect();const row=book.closest('.shelf-interior').getBoundingClientRect();return r.left<row.left-3||r.right>row.right+3}).length};
  });
  check(!report.overflow,label+' has no page overflow');check(report.books===17&&report.clipped===0,label+' keeps every book reachable');
  await page.screenshot({path:'docs/screenshots/upgrade/'+label+'.png',fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('.book').first().click();
 await page.locator('.book-flight').waitFor({state:'detached'});
 await page.waitForTimeout(300);
 await page.screenshot({path:'docs/screenshots/upgrade/mobile-detail.png',fullPage:true});
 await page.locator('.read-book').click();
 await page.locator('.reader-status').filter({hasText:'已保存'}).waitFor();
 await page.locator('.reader-back').click();
 await page.locator('.reader').waitFor({state:'detached'});
 await page.locator('#search').fill('Pride');
 check(await page.locator('.book').count()===1,'Search preserved');
 await page.locator('#search').fill('');
 await page.locator('[data-category="技术"]').click();
 check(await page.locator('.book').count()===2,'Category filter preserved');
 await page.locator('[data-category="全部藏书"]').click();
 await page.setViewportSize({width:1440,height:1000});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('.book').first().click();
 await page.locator('.book-detail').waitFor();
 check(await page.locator('.book-flight').count()===0,'Reduced motion skips extraction flight');
 await page.locator('.edit-book').click();
 await page.locator('[name=title]').fill('山海之间 · 珍藏版');
 await page.locator('.submit-book').click();
 await page.locator('.overlay').waitFor({state:'detached'});
 await page.locator('#search').fill('珍藏版');
 check(await page.locator('.book').count()===1,'Edit preserved');
 await page.locator('.book').click();
 await page.locator('.delete-book').click();
 await page.locator('.cancel-delete').click();
 await page.locator('.delete-book').click();
 await page.locator('.confirm-delete').click();
 await page.locator('.overlay').waitFor({state:'detached'});
 await page.locator('#search').fill('');
 check(await page.locator('.book').count()===16,'Confirmed deletion preserved');
 check(errors.length===0,'No browser runtime errors');
 console.log(JSON.stringify({status:'Visual upgrade checks passed',checks,errors}));
} finally {if(browser)await browser.close();server.kill();}
