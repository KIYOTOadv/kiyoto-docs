const $ = id => document.getElementById(id);
const fa = value => Number(value).toLocaleString('fa-IR');
const normalize = text => text.toLowerCase().replaceAll('ي','ی').replaceAll('ك','ک').replaceAll('\u200c',' ');
const size = bytes => `${(bytes / 1048576).toFixed(1)} MB`;
let catalog = [], category = 'all', activeDoc, pdf, loadingTask, renderingTask, textTask;
let pageNumber = 1, zoom = 1, renderVersion = 0, documentVersion = 0, fitMode = true, previousFocus;
let pdfLibrary;
const reader = $('reader');
function savePosition() { if(activeDoc && pdf) { try { localStorage.setItem(`kiyoto:${activeDoc.id}`,String(pageNumber)); } catch {} } }
function lastPosition(doc) { try { return Math.max(1,Math.min(doc.pages,Number(localStorage.getItem(`kiyoto:${doc.id}`))||1)); } catch { return 1; } }
function createBook(doc) {
  const button = document.createElement('button'); button.className = 'book';
  button.setAttribute('aria-label',`باز کردن ${doc.title}، ${fa(doc.pages)} صفحه`);
  button.innerHTML = `<span class="cover-well"><img src="${doc.cover}" alt="" loading="lazy" width="220" height="311"><span class="open-bubble" aria-hidden="true">مطالعه <span>↗</span></span></span><span class="book-info"><span class="book-number">${doc.number}</span><span class="book-titles"><h3>${doc.title}</h3><span class="book-en" lang="en">${doc.en}</span></span><span class="book-pages">${fa(doc.pages)}<span> صفحه</span></span></span>`;
  button.addEventListener('click',()=>openDocument(doc)); return button;
}
function renderCatalog() {
  const term = normalize($('search').value.trim());
  const matches = doc => normalize(`${doc.title} ${doc.en} ${doc.file} ${doc.category}`).includes(term);
  const featured = catalog.filter(doc=>doc.primary && (category==='all'||doc.category===category) && matches(doc));
  $('book-grid').replaceChildren(...featured.map(createBook));
  $('empty').hidden = featured.length > 0;
  $('results-status').textContent = `${fa(featured.length)} فایل پیدا شد.`;
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches && $('book-grid').childElementCount) {
    $('book-grid').animate([{opacity:.55},{opacity:1}],{duration:240,easing:'ease-out'});
  }
}
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{
  category=button.dataset.category;
  document.querySelectorAll('.filter').forEach(el=>{const active=el===button;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
  renderCatalog();
}));
$('search').addEventListener('input',renderCatalog);
$('clear-search').addEventListener('click',()=>{$('search').value='';category='all';document.querySelector('.filter[data-category="all"]').click();$('search').focus();});
function showMessage(text,error=false) { $('reader-message').textContent=text;$('reader-message').classList.toggle('error',error); }
function updateHash() {
  if(!activeDoc)return;
  const url=new URL(location.href);url.hash=`doc=${encodeURIComponent(activeDoc.id)}&page=${pageNumber}`;
  history.replaceState(null,'',url);
}
async function openDocument(doc,requestedPage) {
  previousFocus=document.activeElement;
  const version=++documentVersion;
  renderVersion++;renderingTask?.cancel();textTask?.cancel();
  if(loadingTask) await loadingTask.destroy().catch(()=>{});
  if(version!==documentVersion)return;
  pdf=undefined;activeDoc=doc;pageNumber=requestedPage||lastPosition(doc);zoom=1;fitMode=true;
  $('reader-title').textContent=doc.title;$('reader-subtitle').textContent=`${doc.number} / ${doc.en} / ${size(doc.bytes)}`;
  $('download').href=doc.file;$('download').download=doc.file.split('/').pop();$('original-pdf').href=doc.file;
  $('page-paper').hidden=true;$('total-pages').textContent=doc.pages;$('page-number').value=pageNumber;
  $('page-number').max=doc.pages;$('prev-page').disabled=true;$('next-page').disabled=true;
  $('thumbnails').replaceChildren();$('thumbnails').hidden=true;$('toggle-thumbs').setAttribute('aria-expanded','false');
  showMessage('در حال آماده‌سازی فایل…');
  if(!reader.open)reader.showModal();document.body.style.overflow='hidden';$('close-reader').focus();
  updateHash();
  try {
    pdfLibrary ||= import('./vendor/pdf.min.mjs');
    const lib=await pdfLibrary;
    if(version!==documentVersion)return;
    lib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.min.mjs',import.meta.url).href;
    loadingTask=lib.getDocument({url:new URL(doc.file,location.href).href,isEvalSupported:false});
    loadingTask.onProgress=({loaded,total})=>{if(version===documentVersion && total)showMessage(`در حال دریافت فایل… ${fa(Math.min(100,Math.round(loaded/total*100)))}٪`);};
    const loaded=await loadingTask.promise;
    if(version!==documentVersion)return;
    pdf=loaded;pageNumber=Math.min(Math.max(1,pageNumber),pdf.numPages);
    $('total-pages').textContent=pdf.numPages;$('page-number').max=pdf.numPages;
    await renderPage();
  } catch(error) {
    if(version!==documentVersion)return;
    showMessage('فایل باز نشد. اتصال را بررسی کنید و دوباره از کتابخانه باز کنید، یا از «باز کردن فایل اصلی» استفاده کنید.',true);
    console.error('Document load failed',error);
  }
}
async function renderPage() {
  if(!pdf || !reader.open)return;
  const version=++renderVersion,docVersion=documentVersion;
  renderingTask?.cancel();textTask?.cancel();
  try {
    const page=await pdf.getPage(pageNumber);
    if(version!==renderVersion || docVersion!==documentVersion)return;
    const base=page.getViewport({scale:1});
    const available=$('page-workspace').clientWidth-(innerWidth<721?24:70);
    const availableHeight=$('page-workspace').clientHeight-(innerWidth<721?40:60);
    const scale=Math.max(.15,Math.min(2,available/base.width,availableHeight/base.height))*zoom;
    const viewport=page.getViewport({scale});
    // Render into a fresh canvas so cancelled tasks cannot modify the current page.
    const canvas=document.createElement('canvas');canvas.id='pdf-canvas';canvas.setAttribute('aria-label',`${activeDoc.title}، صفحه ${fa(pageNumber)}`);
    const ratio=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.floor(viewport.width*ratio);canvas.height=Math.floor(viewport.height*ratio);
    canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
    renderingTask=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});
    await renderingTask.promise;
    if(version!==renderVersion||docVersion!==documentVersion)return;
    const changedPage=$('page-paper').dataset.page!==String(pageNumber);
    $('pdf-canvas').replaceWith(canvas);
    $('page-paper').dataset.page=String(pageNumber);
    if(changedPage && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $('page-paper').animate([{opacity:.6,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'cubic-bezier(.2,.7,.2,1)'});
    }
    const layer=document.createElement('div');layer.id='text-layer';layer.className='textLayer';layer.style.setProperty('--scale-factor',scale);layer.style.setProperty('--total-scale-factor',scale);layer.style.setProperty('--user-unit','1');
    $('text-layer').replaceWith(layer);
    const lib=await pdfLibrary;
    textTask=new lib.TextLayer({textContentSource:page.streamTextContent(),container:layer,viewport});
    textTask.render().catch(()=>{});
    $('page-paper').hidden=false;showMessage('');
    $('page-number').value=pageNumber;$('prev-page').disabled=pageNumber<=1;$('next-page').disabled=pageNumber>=pdf.numPages;
    $('zoom-fit').textContent=fitMode?'Fit':`${Math.round(zoom*100)}%`;
    $('progress-bar').style.width=`${pageNumber/pdf.numPages*100}%`;
    $('reading-progress').textContent=`${pageNumber} / ${pdf.numPages}`;
    document.querySelectorAll('#thumbnails button').forEach(b=>b.classList.toggle('active',Number(b.dataset.page)===pageNumber));
    $('page-workspace').scrollTop=0;savePosition();updateHash();
  } catch(error) {
    if(error.name==='RenderingCancelledException' || version!==renderVersion)return;
    showMessage('این صفحه نمایش داده نشد. صفحه دیگری را انتخاب کنید یا فایل اصلی را باز کنید.',true);
    console.error('Page render failed',error);
  }
}
function goToPage(value) { if(!pdf)return;pageNumber=Math.max(1,Math.min(pdf.numPages,Number(value)||1));renderPage(); }
function closeReader() { savePosition();documentVersion++;renderVersion++;renderingTask?.cancel();textTask?.cancel();loadingTask?.destroy().catch(()=>{});loadingTask=undefined;pdf=undefined;reader.close();document.body.style.overflow='';const url=new URL(location.href);url.hash='collection';history.replaceState(null,'',url);previousFocus?.focus(); }
$('close-reader').addEventListener('click',closeReader);
reader.addEventListener('cancel',event=>{event.preventDefault();closeReader();});
$('prev-page').addEventListener('click',()=>goToPage(pageNumber-1));$('next-page').addEventListener('click',()=>goToPage(pageNumber+1));
$('page-number').addEventListener('change',event=>goToPage(event.target.value));
$('zoom-in').addEventListener('click',()=>{zoom=Math.min(3,zoom+.2);fitMode=false;renderPage();});
$('zoom-out').addEventListener('click',()=>{zoom=Math.max(.4,zoom-.2);fitMode=false;renderPage();});
$('zoom-fit').addEventListener('click',()=>{zoom=1;fitMode=true;renderPage();});
$('reader-theme').addEventListener('click',()=>reader.classList.toggle('light'));
$('fullscreen').addEventListener('click',async()=>{try {if(document.fullscreenElement)await document.exitFullscreen();else await reader.requestFullscreen();}catch{showMessage('نمای تمام‌صفحه در این مرورگر در دسترس نیست.');}});
document.addEventListener('keydown',event=>{if(!reader.open||['INPUT','TEXTAREA'].includes(event.target.tagName))return;if(event.key==='ArrowRight'){event.preventDefault();goToPage(pageNumber-1);}if(event.key==='ArrowLeft'){event.preventDefault();goToPage(pageNumber+1);}});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(reader.open)renderPage();},180);});
$('toggle-thumbs').addEventListener('click',async()=>{
  const panel=$('thumbnails');panel.hidden=!panel.hidden;$('toggle-thumbs').setAttribute('aria-expanded',String(!panel.hidden));renderPage();
  if(panel.hidden||!pdf||panel.childElementCount)return;
  const docVersion=documentVersion;
  for(let index=1;index<=pdf.numPages;index++) {
    const button=document.createElement('button');button.dataset.page=index;button.setAttribute('aria-label',`صفحه ${fa(index)}`);button.textContent=fa(index);button.classList.toggle('active',index===pageNumber);button.addEventListener('click',()=>goToPage(index));panel.append(button);
  }
  // Only render thumbnail pages that enter the rail's viewport.
  const observer=new IntersectionObserver(async entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;observer.unobserve(entry.target);
      try {const page=await pdf.getPage(Number(entry.target.dataset.page));if(docVersion!==documentVersion){observer.disconnect();return;}const viewport=page.getViewport({scale:110/page.getViewport({scale:1}).width});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;if(docVersion===documentVersion)entry.target.prepend(canvas);}catch{}
    }
  },{root:panel,rootMargin:'180px'});
  panel.querySelectorAll('button').forEach(button=>observer.observe(button));
});
async function init(){
  try {const response=await fetch('./catalog.json',{cache:'no-store'});if(!response.ok)throw new Error(response.status);catalog=await response.json();$('collection-count').textContent=`${fa(catalog.length)} فایل نهایی`;renderCatalog();
    const params=new URLSearchParams(location.hash.slice(1));const id=params.get('doc');const match=catalog.find(doc=>doc.id===id);if(match)openDocument(match,Number(params.get('page'))||1);
  }catch(error){$('catalog-error').hidden=false;console.error('Catalog load failed',error);}
}
init();

// One slow kinetic composition; pause it when the visitor cannot see it.
const motion=$('geometry'), motionButton=$('motion-toggle');
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let manuallyPaused=reducedMotion.matches,heroVisible=true;
function updateMotion(){
  const paused=manuallyPaused||reducedMotion.matches||!heroVisible||document.hidden;
  motion.classList.toggle('paused',paused);
  motionButton.setAttribute('aria-pressed',String(manuallyPaused));
  motionButton.setAttribute('aria-label',manuallyPaused?'پخش حرکت گرافیک':'توقف حرکت گرافیک');
  $('motion-label').textContent=manuallyPaused?'پخش حرکت':'توقف حرکت';
  motionButton.querySelector('.motion-icon').textContent=manuallyPaused?'▷':'Ⅱ';
}
motionButton.addEventListener('click',()=>{manuallyPaused=!manuallyPaused;updateMotion();});
new IntersectionObserver(([entry])=>{heroVisible=entry.isIntersecting;updateMotion();},{threshold:.05}).observe(motion);
document.addEventListener('visibilitychange',updateMotion);
reducedMotion.addEventListener('change',()=>{manuallyPaused=reducedMotion.matches;updateMotion();});
if(matchMedia('(hover:hover) and (pointer:fine)').matches){
  let frame;
  motion.addEventListener('pointermove',event=>{
    if(reducedMotion.matches||manuallyPaused)return;
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      const bounds=motion.getBoundingClientRect();
      motion.style.setProperty('--tilt-x',`${-(event.clientY-bounds.top-bounds.height/2)/70}deg`);
      motion.style.setProperty('--tilt-y',`${(event.clientX-bounds.left-bounds.width/2)/70}deg`);
    });
  });
  motion.addEventListener('pointerleave',()=>{cancelAnimationFrame(frame);motion.style.setProperty('--tilt-x','0deg');motion.style.setProperty('--tilt-y','0deg');});
}
updateMotion();
