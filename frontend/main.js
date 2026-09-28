import './styles.css';
import './auth.css';
import {requireAccount, sessionFetch, logout} from './auth.js';
import {createIcons, icons} from 'lucide';
import {designFor, spineMarkup, coverMarkup} from './components/bookDesign.js';
import {moveBook, cancelBookMotion} from './components/bookMotion.js';
const account = await requireAccount();
const themeKey = 'bookshelf-theme-user-' + account.id;
const state={books:[],query:'',category:'全部藏书',theme:localStorage.getItem(themeKey)||'modern',selected:null};
const themes=[['modern','Modern Minimal','现代原木'],['classic','Classic Wood','经典书房'],['dark','Dark Study','午夜书斋'],['cozy','Cute Cozy','奶油时光']];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=n=>'<i data-lucide="'+n+'"></i>';
const categories=['全部藏书','文学','小说','技术','学习','历史','其他'];
function iconsNow(){createIcons({icons,attrs:{'stroke-width':1.6}})}
document.documentElement.dataset.theme=state.theme;
document.querySelector('#app').innerHTML=`
<header class="room-header"><a class="brand" href="/"><span class="brand-icon">${icon('library-big')}</span><span>藏间<small>DIGITAL BOOKSHELF</small></span></a><div class="nav-note">留一方安静，给阅读。</div><button class="theme-trigger subtle" aria-expanded="false" aria-controls="theme-menu"><span class="theme-dot" aria-hidden="true"></span><span class="theme-label">书房风格</span>${icon('chevron-down')}</button><div class="account-area"><span class="account-avatar" aria-hidden="true">${esc(account.display_name.slice(0,1))}</span><span class="account-name" title="${esc(account.username)}">${esc(account.display_name)}</span><button class="subtle logout-button">退出</button></div></header>
<main class="room-main"><section class="intro"><div class="intro-copy"><div class="eyebrow">YOUR OWN LITTLE READING ROOM</div><div class="intro-line"><h1>给好故事，一个家<span>。</span></h1><p>让喧嚣留在门外，慢慢读。</p></div></div><button class="primary add-book">${icon('plus')} 添加书籍</button></section>
<section class="toolbar"><nav class="categories" aria-label="书籍分类"></nav><label class="search">${icon('search')}<input id="search" placeholder="搜索书名、作者…" aria-label="搜索书名或作者"><kbd>/</kbd></label></section>
<section class="library"><div class="shelf-heading"><span>${icon('library')} <b id="collection-label">我的藏书</b><span id="count"></span></span><span class="shelf-hint">把光阴，藏进书页里</span></div><div id="shelves"></div><div class="library-bottom"><span>${icon('mouse-pointer-2')} 轻点一本书，开始一段旅程</span><span class="local-note">${icon('lock-keyhole')} 私人藏书 · 仅你可见</span></div></section>
<footer class="room-footer"><span>藏间 <em> / </em> 留一方空间，给阅读。</span><span id="recent">YOUR PERSONAL READING SANCTUARY</span></footer></main>
<div id="toast" role="status"></div><div id="overlay-root"></div><div id="theme-menu" role="menu" aria-label="选择书房风格" hidden></div>`;
function renderCategories(){document.querySelector('.categories').innerHTML=categories.map(c=>`<button class="category ${state.category===c?'active':''}" data-category="${c}" aria-pressed="${state.category===c}">${c}${c==='全部藏书'?'<span>'+state.books.length+'</span>':''}</button>`).join('');document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{state.category=b.dataset.category;renderCategories();renderShelf()})}
// Pack by actual spine widths instead of a fixed count, so every book stays reachable.
let pendingResize = false;
function packShelf(list) {
  const library = document.querySelector('.library');
  const css = getComputedStyle(library);
  const innerWidth = library.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight)
    - Number(css.getPropertyValue('--shelf-gutter').trim().replace('px','')) * 2;
  const decor = Number(css.getPropertyValue('--decor-width').trim().replace('px',''));
  const gap = Number(css.getPropertyValue('--room-gap').trim().replace('px',''));
  const rows = [];
  let row = [], used = 0;
  const capacity = () => Math.max(125,innerWidth - (rows.length < 2 && decor ? decor+gap : 0));
  list.forEach((book,index) => {
    const featured = index===0 && list.length>=5 && window.innerWidth>=850;
    const width = (featured ? 163 : designFor(book).width) + 5;
    if(row.length && (used+width>capacity() || row.length>=10)) { rows.push(row);row=[];used=0; }
    row.push({book,featured});used+=width;
  });
  rows.push(row);
  while(rows.length<2) rows.push([]);
  // The last shelf always has room for the add-book invitation.
  const last=rows.at(-1);
  const lastUsed=last.reduce((sum,item)=>sum+(item.featured?163:designFor(item.book).width)+5,0);
  const lastCapacity=innerWidth-(rows.length<=2&&decor?decor+gap:0);
  if(lastUsed+85>lastCapacity && last.length) rows.push([]);
  return rows;
}
function decoration(row) {
  if(row===0) return '<div class="shelf-decoration" aria-hidden="true"><div class="shelf-art"><div class="art-print"><svg viewBox="0 0 90 100" fill="none"><circle cx="58" cy="28" r="17" fill="#bb9363" opacity=".85"/><path d="M8 85V48a32 32 0 0 1 64 0v37z" stroke="currentColor" stroke-width=".8"/><path d="M8 80 35 50l18 17 19-25v43H8z" fill="#849079"/><path d="M8 88h68M14 93h58" stroke="currentColor" stroke-width=".5"/></svg><small>THE QUIET BETWEEN PAGES</small></div></div></div>';
  if(row===1) return '<div class="shelf-decoration" aria-hidden="true"><div class="still-life"><div class="vase"><span></span><span></span><span></span></div><div class="horizontal-book">THE ART OF SLOW LIVING</div><div class="horizontal-book second">a quiet moment</div></div></div>';
  return '';
}
function renderShelf() {
  const list=state.books.filter(book=>(state.category==='全部藏书'||book.category===state.category)&&(book.title+' '+book.author).toLowerCase().includes(state.query.toLowerCase()));
  document.querySelector('#count').textContent=list.length+' 本';
  document.querySelector('#collection-label').textContent=state.category==='全部藏书'?'我的藏书':state.category;
  const rows=packShelf(list);
  document.querySelector('#shelves').innerHTML=rows.map((row,index)=>`<div class="shelf-row"><div class="shelf-interior"><div class="books">${row.map(({book,featured},i)=>spineMarkup(book,i,featured)).join('')}${index===rows.length-1?'<button class="add-spine" aria-label="添加 PDF 书籍">'+icon('plus')+'<span>下一段故事</span></button>':''}</div>${decoration(index)}</div><div class="shelf-plank"><span>${String(index+1).padStart(2,'0')}</span></div></div>`).join('');
  if(!list.length) document.querySelector('.books').insertAdjacentHTML('afterbegin',`<div class="empty"><h3>${state.query||state.category!=='全部藏书'?'这段故事，还没找到':'书房已备好，故事等你带来'}</h3><p>${state.query||state.category!=='全部藏书'?'换一个书名、作者或分类试试。':'导入第一本 PDF，让喜欢的文字在这里安家。'}</p></div>`);
  document.querySelectorAll('.book').forEach(element=>element.onclick=()=>pick(Number(element.dataset.id),element));
  document.querySelector('.add-spine').onclick=()=>openForm();
  iconsNow();
  const recent=[...state.books].filter(book=>book.last_read_at).sort((a,b)=>b.last_read_at.localeCompare(a.last_read_at))[0];
  document.querySelector('#recent').textContent=recent?'最近阅读 · '+recent.title+' / 第 '+recent.current_page+' 页':'A QUIET PLACE FOR YOUR NEXT CHAPTER';
}
function toast(msg){const el=document.querySelector('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.remove('show'),3500)}
async function api(path='',options={}){const r=await sessionFetch('/api/books'+path,options);if(!r.ok){let d;try{d=await r.json()}catch{}throw Error(typeof d?.detail==='string'?d.detail:'操作失败，请检查后端连接')}return r.status===204?null:r.json()}
async function load(){try{state.books=await api();renderCategories();renderShelf()}catch(e){toast(e.message);renderCategories();renderShelf()}}
let focusBefore;
function modal(html,cls='') {
  cancelBookMotion();
  focusBefore=document.activeElement;
  document.querySelector('#overlay-root').innerHTML=`<div class="overlay"><section class="dialog ${cls}" role="dialog" aria-modal="true"><button class="close subtle" aria-label="关闭">${icon('x')}</button>${html}</section></div>`;
  const dialog=document.querySelector('.dialog');
  dialog.setAttribute('aria-label',dialog.querySelector('h2')?.textContent||'书籍信息');
  document.querySelector('.close').onclick=()=>closeModal();
  document.querySelector('.overlay').onclick=event=>{if(event.target.classList.contains('overlay'))closeModal()};
  document.body.classList.add('locked');
  document.querySelector('.room-main').inert=true;
  document.querySelector('.room-header').inert=true;
  iconsNow();dialog.querySelector('button,input')?.focus();
}
async function closeModal(animate=true) {
  const overlay=document.querySelector('.overlay');
  if(!overlay||overlay.dataset.closing)return;
  overlay.dataset.closing='true';
  const selected=state.selected?.id, before=focusBefore;
  const source=selected?document.querySelector('.book[data-id="'+selected+'"]'):null;
  const cover=overlay.querySelector('.cover-stage .cover');
  cancelBookMotion();
  if(animate&&source&&cover) {
    overlay.querySelector('.book-detail')?.classList.add('is-returning');
    await moveBook(source,cover,true);
  }
  state.selected=null;
  if(animate){overlay.classList.add('closing');await new Promise(resolve=>setTimeout(resolve,160))}
  overlay.remove();
  if(!document.querySelector('.reader,.overlay'))document.body.classList.remove('locked');
  document.querySelector('.room-main').inert=false;
  document.querySelector('.room-header').inert=false;
  if(pendingResize){pendingResize=false;renderShelf()}
  const returned=selected?document.querySelector('.book[data-id="'+selected+'"]'):null;
  if(returned)returned.focus({preventScroll:true});else if(before?.isConnected)before.focus({preventScroll:true});
}
function pick(id,element) {
  if(document.querySelector('.overlay'))return;
  details(id,element);
}
function details(id,source=null) {
  const book=state.books.find(item=>item.id===id);
  if(!book)return;
  state.selected=book;
  modal(`<div class="cover-stage">${coverMarkup(book)}</div><div class="detail-copy">
    <div class="eyebrow"><span class="category-badge">${esc(book.category)}</span> PERSONAL COLLECTION</div>
    <h2>${esc(book.title)}</h2><p class="author">${esc(book.author||'佚名')}</p>
    <p class="description">${esc(book.description||'一本好书，是通往另一个世界的门。给自己一点时间，翻开它吧。')}</p>
    <div class="progress-label"><span>${book.current_page>1?'上次阅读到第 '+book.current_page+' 页':'等待翻开的故事'}</span><span>${book.total_pages} 页</span></div>
    <div class="progress"><span style="width:${book.last_read_at?book.current_page/book.total_pages*100:0}%"></span></div>
    <button class="primary read-book">${icon('book-open')} ${book.last_read_at?'继续阅读':'开始阅读'} ${icon('arrow-up-right')}</button>
    <div class="detail-actions"><button class="subtle edit-book">${icon('pencil')} 编辑信息</button><button class="subtle delete-book">${icon('trash-2')} 删除书籍</button></div>
    </div>`,'book-detail');
  const dialog=document.querySelector('.book-detail');
  if(source) {
    dialog.classList.add('is-picking');
    moveBook(source,dialog.querySelector('.cover')).finally(()=>dialog.classList.remove('is-picking'));
  }
  document.querySelector('.read-book').onclick=()=>readBook(book);
  document.querySelector('.edit-book').onclick=()=>openForm(book);
  document.querySelector('.delete-book').onclick=()=>deleteBook(book);
}
function openForm(b){modal(`<div class="eyebrow">${b?'CURATE YOUR COLLECTION':'A NEW STORY BEGINS'}</div><h2>${b?'编辑书籍':'给书架添一本新书'}</h2><p class="form-subtitle">把喜欢的文字，收藏在触手可及的地方。</p><form id="book-form">${!b?'<label class="file-drop">'+icon('file-up')+'<strong id="file-label">选择一本 PDF 书籍</strong><span>仅支持 PDF · 最大 100 MB</span><input type="file" name="file" accept=".pdf,application/pdf" required aria-label="选择 PDF 文件"></label>':''}<label>书名<input name="title" maxlength="300" placeholder="留空时读取元数据或使用文件名" value="${esc(b?.title||'')}"></label><div class="form-grid"><label>作者<input name="author" maxlength="200" placeholder="作者姓名" value="${esc(b?.author||'')}"></label><label>分类<select name="category">${categories.slice(1).map(c=>`<option ${c===(b?.category||'其他')?'selected':''}>${c}</option>`).join('')}</select></label></div><label>简介<textarea name="description" maxlength="5000" rows="3" placeholder="关于这本书，写下几句话…">${esc(b?.description||'')}</textarea></label><p class="form-error" role="alert"></p><button class="primary submit-book" type="submit">${icon(b?'check':'plus')} ${b?'保存修改':'放入书架'}</button></form>`,'form-dialog');
const file=document.querySelector('[name=file]');if(file)file.onchange=()=>{document.querySelector('#file-label').textContent=file.files[0]?.name||'选择一本 PDF 书籍'};
document.querySelector('#book-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,btn=form.querySelector('button[type=submit]'),data=new FormData(form);try{if(!b){const f=data.get('file');if(!f.size)throw Error('文件为空，请选择有效 PDF');if(f.size>100*1024*1024)throw Error('文件过大，最大支持 100 MB');if(!f.name.toLowerCase().endsWith('.pdf'))throw Error('请选择 PDF 文件')}btn.disabled=true;btn.textContent='正在保存…';await api(b?'/'+b.id:'',b?{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(data))}:{method:'POST',body:data});closeModal();await load();toast(b?'书籍信息已更新':'新故事已放入书架')}catch(err){form.querySelector('.form-error').textContent=err.message;btn.disabled=false;btn.textContent=b?'保存修改':'放入书架'}}}
function deleteBook(b){modal(`<div class="eyebrow">YOUR COLLECTION</div><h2>与这本书暂时告别？</h2><p>确定要从书架中删除《${esc(b.title)}》吗？</p><p class="form-subtitle">该 PDF 文件和你的阅读记录也会一并删除。</p><div class="confirm-actions"><button class="subtle cancel-delete">留在书架</button><button class="danger confirm-delete">确定删除</button></div>`,'confirm-dialog');document.querySelector('.cancel-delete').onclick=()=>details(b.id);document.querySelector('.confirm-delete').onclick=async()=>{try{await api('/'+b.id,{method:'DELETE'});closeModal();await load();toast('书籍已移出书架')}catch(e){toast(e.message)}}}
async function readBook(b){closeModal(false);const {openReader}=await import('./reader.js');openReader(b,{api,toast,onClose:load,iconsNow,icon,esc})}
document.querySelector('.logout-button').onclick=async()=>{try{await logout()}catch(e){toast(e.message)}};
document.querySelector('.add-book').onclick=()=>openForm();
document.querySelector('#search').oninput=e=>{state.query=e.target.value;renderShelf()};
let themeTransition;
function closeThemeMenu(restoreFocus=false) {
  document.querySelector('#theme-menu').hidden=true;
  document.querySelector('.theme-trigger').setAttribute('aria-expanded','false');
  if(restoreFocus)document.querySelector('.theme-trigger').focus();
}
document.querySelector('.theme-trigger').onclick=()=>{
  const menu=document.querySelector('#theme-menu'),trigger=document.querySelector('.theme-trigger');
  if(!menu.hidden){closeThemeMenu();return}
  menu.hidden=false;trigger.setAttribute('aria-expanded','true');
  const rect=trigger.getBoundingClientRect();
  menu.style.right=Math.max(16,window.innerWidth-rect.right)+'px';menu.style.top=(rect.bottom+10)+'px';
  menu.innerHTML='<div class="menu-heading"><span class="menu-label">选择书房的气息</span><small>YOUR ROOM, YOUR MOOD</small></div>'+themes.map(([id,name,zh])=>`<button role="menuitemradio" aria-checked="${state.theme===id}" data-theme-id="${id}" class="${state.theme===id?'chosen':''}"><span class="theme-preview" data-theme="${id}" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="theme-names">${zh}<small>${name}</small></span>${state.theme===id?icon('check'):''}</button>`).join('');
  menu.querySelectorAll('button').forEach(button=>button.onclick=()=>{
    const update=()=>{state.theme=button.dataset.themeId;document.documentElement.dataset.theme=state.theme;localStorage.setItem(themeKey,state.theme)};
    closeThemeMenu(true);
    themeTransition?.skipTransition();
    if(document.startViewTransition&&!matchMedia('(prefers-reduced-motion: reduce)').matches)themeTransition=document.startViewTransition(update);
    else update();
  });
  iconsNow();menu.querySelector('.chosen')?.focus();
};
document.querySelector('#theme-menu').onkeydown=event=>{
  const buttons=[...document.querySelectorAll('#theme-menu button')],index=buttons.indexOf(document.activeElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
    buttons[next].focus();
  }
};
document.addEventListener('click',event=>{if(!event.target.closest('#theme-menu,.theme-trigger'))closeThemeMenu()});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){closeModal();if(!document.querySelector('#theme-menu').hidden)closeThemeMenu(true)}
  if(event.key==='/'&&!event.target.matches('input,textarea')&&!document.querySelector('.overlay,.reader')){event.preventDefault();document.querySelector('#search').focus()}
  if(event.key==='Tab'&&document.querySelector('.dialog')){
    const elements=[...document.querySelectorAll('.dialog button,.dialog input,.dialog select,.dialog textarea')].filter(item=>!item.disabled);
    if(event.shiftKey&&document.activeElement===elements[0]){event.preventDefault();elements.at(-1).focus()}
    else if(!event.shiftKey&&document.activeElement===elements.at(-1)){event.preventDefault();elements[0].focus()}
  }
});
let lastWidth=0,resizeTimer;
new ResizeObserver(entries=>{
  const width=Math.round(entries[0].contentRect.width);if(width===lastWidth)return;lastWidth=width;
  clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(document.querySelector('.overlay'))pendingResize=true;else renderShelf()},120);
}).observe(document.querySelector('.library'));
load();
