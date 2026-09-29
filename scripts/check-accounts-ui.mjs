import {createRequire} from 'node:module';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const python=process.env.PYTHON || resolve('.venv/Scripts/python.exe');
mkdirSync('.cache',{recursive:true});
mkdirSync('docs/screenshots',{recursive:true});
const data=mkdtempSync(resolve('.cache/accounts-e2e-'));
const sample=resolve(data,'sample.pdf');
execFileSync(python,['-c','from pathlib import Path; from backend.services.seed import create_sample; import sys; create_sample(Path(sys.argv[1]),"My private library","Test author",6)',sample]);
const origin='http://127.0.0.1:8001';
const server=spawn(python,['-m','uvicorn','backend.main:app','--host','127.0.0.1','--port','8001'],{env:{...process.env,BOOKSHELF_DATA_DIR:data},stdio:'pipe',windowsHide:true});
let serverLog='';
server.stderr.on('data',chunk=>serverLog+=chunk.toString());
let browser;
const errors=[];
const check=(condition,message)=>{if(!condition)throw new Error(message)};
try{
 let ready=false;
 for(let i=0;i<100;i++){try{const r=await fetch(origin+'/api/health');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,150));}
 check(ready,'Test server failed: '+serverLog);
 browser=await chromium.launch({executablePath:process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const a=await browser.newContext({viewport:{width:1440,height:1080},reducedMotion:'reduce'});
 const b=await browser.newContext({viewport:{width:1440,height:1080},reducedMotion:'reduce'});
 const pa=await a.newPage(),pb=await b.newPage();
 for(const p of [pa,pb])p.on('pageerror',e=>errors.push(e.message));
 const password='a private reading room password';
 async function register(page,name,display){
  await page.goto(origin);
  await page.locator('[data-mode=register]').click();
  await page.locator('[name=display_name]').fill(display);
  await page.locator('[name=username]').fill(name);
  await page.locator('[name=password]').fill(password);
  await page.locator('[name=confirm_password]').fill(password);
  await page.locator('.auth-submit').click();
  await page.locator('.account-name').waitFor();
  const me=await (await page.request.get(origin+'/api/auth/me')).json();
  const starters=await (await page.request.get(origin+'/api/books')).json();
  check(starters.length===17,'New accounts must have 17 starter books');
  for(const starter of starters) {
    const deleted=await page.request.delete(origin+'/api/books/'+starter.id,{headers:{'X-CSRF-Token':me.csrf_token}});
    check(deleted.status()===204,'Starter deletion failed');
  }
  await page.reload();
  await page.locator('.account-name').waitFor();
 }
 await pa.goto(origin);
 await pa.locator('.auth-card').waitFor();
 await pa.screenshot({path:'docs/screenshots/login.png',fullPage:true});
 await pa.setViewportSize({width:390,height:844});
 await pa.screenshot({path:'docs/screenshots/login-mobile.png',fullPage:true});
 await pa.setViewportSize({width:1440,height:1080});
 await register(pa,'reader_a','小林的书房');
 check(await pa.locator('.book').count()===0,'Deleted starter books must not reappear');
 await pa.locator('.add-book').click();
 await pa.locator('input[type=file]').setInputFiles(sample);
 await pa.locator('input[name=title]').fill('只属于 A 的书');
 await pa.locator('.submit-book').click();
 await pa.locator('.book').waitFor();
 await pa.locator('.overlay').waitFor({state:'detached'});
 await pa.locator('.book').click();
 await pa.locator('.read-book').click();
 await pa.locator('.reader-status').filter({hasText:'已保存'}).waitFor();
 await pa.locator('.reader-tools input').fill('3');
 await pa.locator('.reader-tools input').dispatchEvent('change');
 await pa.locator('.reader-status').filter({hasText:'第 3 页'}).waitFor();
 await pa.locator('.reader-back').click();
 await pa.locator('.reader').waitFor({state:'detached'});
 await pa.locator('.theme-trigger').click();
 await pa.locator('[data-theme-id=dark]').click();
 await pa.screenshot({path:'docs/screenshots/private-shelf.png',fullPage:true});
 const books=await (await a.request.get(origin+'/api/books')).json();
 check(books.length===1,'Owner collection missing');
 const book=books[0];
 await register(pb,'reader_b','另一位读者');
 check(await pb.locator('.book').count()===0,'B saw A books');
 check((await b.request.get(origin+'/api/books/'+book.id+'/file')).status()===404,'B accessed A PDF');
 await pb.locator('#search').fill('只属于');
 check(await pb.locator('.book').count()===0,'Search leaked');
 const bme=await (await b.request.get(origin+'/api/auth/me')).json();
 for(const [method,suffix,body] of [['patch','',{title:'stolen'}],['patch','/progress',{current_page:2}],['delete','',null]]){
  const r=await b.request[method](origin+'/api/books/'+book.id+suffix,{headers:{'X-CSRF-Token':bme.csrf_token},...(body?{data:body}:{})});
  check(r.status()===404,'Cross-account mutation allowed');
 }
 await pa.locator('.logout-button').click();
 await pa.locator('.auth-card').waitFor();
 check((await a.request.get(origin+'/api/books/'+book.id+'/file')).status()===401,'Logout left file access');
 await pa.locator('[name=username]').fill('reader_a');
 await pa.locator('[name=password]').fill('a definitely wrong password');
 await pa.locator('.auth-submit').click();
 await pa.locator('.auth-error').filter({hasText:'用户名或密码不正确'}).waitFor();
 await pa.locator('[name=password]').fill(password);
 await pa.locator('.auth-submit').click();
 await pa.locator('.book').waitFor();
 check(await pa.locator('html').getAttribute('data-theme')==='dark','A theme lost');
 await pa.locator('.book').click();
 await pa.locator('.progress-label').filter({hasText:'第 3 页'}).waitFor();
 await pa.locator('.close').click();
 await pa.locator('.overlay').waitFor({state:'detached'});
 // Same-browser switch must neither inherit the previous shelf nor the theme.
 await pa.locator('.logout-button').click();
 await pa.locator('.auth-card').waitFor();
 await pa.locator('[name=username]').fill('reader_b');
 await pa.locator('[name=password]').fill(password);
 await pa.locator('.auth-submit').click();
 await pa.locator('.account-name').waitFor();
 check(await pa.locator('.book').count()===0,'Same-browser account switch leaked books');
 check(await pa.locator('html').getAttribute('data-theme')==='modern','Theme leaked between accounts');
 await pa.reload();
 await pa.locator('.account-name').waitFor();
 check((await pa.locator('.account-name').innerText()).includes('另一位读者'),'Session did not persist');
 check(errors.length===0,'Browser errors: '+errors.join('; '));
 console.log(JSON.stringify({status:'Account browser checks passed',errors,checks:['register','login','wrong password','logout','private upload','PDF render','page persistence','cross-account isolation','account switch','theme isolation','session reload']}));
}finally{
 if(browser)await browser.close();
 server.kill();
}
