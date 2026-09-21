/* Browser checks use synthetic PE fixtures only; no fixture is ever executed. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TRINITY_URL || 'http://127.0.0.1:1415';
const out = process.env.TRINITY_QA || 'tests/results';
async function assertKeyboardScroll(page, element) {
  await element.focus();
  await page.keyboard.press('ArrowRight');
  // Poll from Node: page-side timers do not run with JavaScript disabled.
  for (let attempt=0;attempt<20;attempt++) {
    if (await element.evaluate(e=>e.scrollLeft>0)) return;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.fail('focused technical content did not scroll with the keyboard');
}
function fixture(wide=true, name='.text') {
  const b=Buffer.alloc(1024);b.write('MZ');b.writeUInt32LE(0x80,0x3c);b.write('PE\0\0',0x80);
  const opt=0x98, size=wide?240:224;
  b.writeUInt16LE(wide?0x8664:0x14c,0x84);b.writeUInt16LE(1,0x86);b.writeUInt16LE(size,0x94);
  b.writeUInt16LE(wide?0x20b:0x10b,opt);b.writeUInt32LE(0x1000,opt+16);
  if(wide){b.writeBigUInt64LE(0x140000000n,opt+24);b.writeUInt32LE(16,opt+108);}else{b.writeUInt32LE(0x400000,opt+28);b.writeUInt32LE(16,opt+92);}
  b.writeUInt32LE(0x1000,opt+32);b.writeUInt32LE(512,opt+36);b.writeUInt32LE(0x2000,opt+56);b.writeUInt32LE(512,opt+60);
  const s=opt+size;b.write(name,s,8);b.writeUInt32LE(8,s+8);b.writeUInt32LE(0x1000,s+12);b.writeUInt32LE(512,s+16);b.writeUInt32LE(512,s+20);b.writeUInt32LE(0x60000020,s+36);
  return b;
}
function sectionFixture(sections) {
  // Long PE section names resolve through the real COFF string table.
  const strings=[Buffer.alloc(4)];const names=[];let stringSize=4;
  for(const section of sections){
    if(Buffer.byteLength(section.name)<=8){names.push(section.name);continue;}
    names.push(`/${stringSize}`);const value=Buffer.from(section.name+'\0');strings.push(value);stringSize+=value.length;
  }
  strings[0].writeUInt32LE(stringSize);
  const stringOffset=0x400+sections.length*0x200;
  const b=Buffer.alloc(stringOffset+stringSize);fixture().copy(b);b.fill(0,0x188,0x400);
  b.writeUInt16LE(sections.length,0x86);b.writeUInt32LE(stringOffset,0x8c);
  b.writeUInt32LE((sections.length+1)*0x1000,0x98+56);b.writeUInt32LE(0x400,0x98+60);
  sections.forEach((section,i)=>{
    const s=0x188+i*40, offset=section.data.length?0x400+i*0x200:0;
    b.write(names[i],s,8);b.writeUInt32LE(section.data.length||64,s+8);b.writeUInt32LE((i+1)*0x1000,s+12);
    b.writeUInt32LE(section.data.length,s+16);b.writeUInt32LE(offset,s+20);b.writeUInt32LE(0x40000040,s+36);
    if(offset)section.data.copy(b,offset);
  });
  Buffer.concat(strings).copy(b,stringOffset);return b;
}
async function assertHexBytes(preview, bytes, offset) {
  const lines=(await preview.textContent()).split('\n');
  assert.match(lines.shift(),/^OFFSET\s+00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f\s+ASCII$/);
  const shown=bytes.subarray(0,128);
  assert.equal(lines.length,Math.ceil(shown.length/16),'preview row count');
  for(const [i,line] of lines.entries()){
    const match=line.match(/^([0-9a-f]{8})  (.{47})  (.*)$/);
    assert.ok(match,`unaligned hex row: ${line}`);
    const row=shown.subarray(i*16,(i+1)*16);
    assert.equal(parseInt(match[1],16),offset+i*16,'absolute file offset');
    assert.deepEqual(Buffer.from(match[2].replaceAll(' ',''),'hex'),row,'actual bytes, including partial rows');
    assert.equal(match[3],Array.from(row,b=>b>=0x20&&b<=0x7e?String.fromCharCode(b):'.').join(''),'printable ASCII boundaries');
  }
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const context=await browser.newContext();const page=await context.newPage();const errors=[];const requests=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>requests.push({url:r.url(),method:r.method(),data:r.postData()}));
 const routes=['/','/projects/','/projects/loupe/','/projects/nox/','/research/','/research/pe-address-spaces/','/research/static-inspection/','/labs/','/canon/','/now/'];
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const route of routes){
   const response=await page.goto(base+route);assert.equal(response.status(),200,route);
   assert.equal(await page.locator('h1').count(),1,route);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width} ${route}`);
   assert.equal(await page.locator('main').count(),1);assert.ok(await page.locator('nav[aria-label="Primary navigation"]').count());
   if(width===1440 || width===390) await page.screenshot({path:path.join(out,`${width}-${route==='/'?'home':route.replaceAll('/','_')}.png`),fullPage:true});
  }
 }
 assert.equal(requests.filter(r=>r.url.includes('.wasm')).length,0,'WASM was loaded before file selection');
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/labs/');
 await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'Skip to content');
 const input=page.locator('#pe-file');
 await input.setInputFiles({name:'fixture64.exe',mimeType:'application/octet-stream',buffer:fixture()});
 await page.locator('#inspection').waitFor({state:'visible'});
 assert.match(await page.locator('#inspection').textContent(),/PE32\+/);assert.match(await page.locator('#inspection').textContent(),/0x140001000/);
 assert.deepEqual(await page.locator('.lab-spec > span').allTextContents(),['ENGINE / LOUPE','MODE / STATIC INSPECTION','RUNTIME / GO · WASM','PROCESSING / LOCAL','EXECUTION / NONE','UPLOAD / NONE']);
 assert.equal(await page.locator('.section-group').count(),0,'ordinary image does not need section groups');
 await page.locator('summary').click();assert.equal(await page.locator('details[open]').count(),1);
 await assertHexBytes(page.locator('.hex-preview'),fixture().subarray(512),512);
 const sectionData=[
  {name:'.debug_info',data:Buffer.from(Array.from({length:129},(_,i)=>i))},
  {name:'.text',data:Buffer.concat([Buffer.from([0x00,0x1f,0x20,0x21,0x3c,0x3e,0x26,0x22,0x27,0x40,0x41,0x7e,0x7f,0x80,0xff,0x0a]),Buffer.from('<img src=x>abcde!'),Buffer.from([0xc3,0x42])])},
  {name:'.comment',data:Buffer.from('toolchain')},
  {name:'.pdata',data:Buffer.alloc(16,0x41)},
  {name:'.bss',data:Buffer.alloc(0)},
  {name:'.custom',data:Buffer.from([0x81])},
 ];
 const mixed=sectionFixture(sectionData);
 await input.setInputFiles({name:'sections.exe',mimeType:'application/octet-stream',buffer:mixed});
 await page.locator('#inspection').waitFor({state:'visible'});
 assert.equal(await page.locator('.section-detail').count(),sectionData.length,'keep every reported section');
 const groups=page.locator('.section-group');
 assert.deepEqual(await groups.locator('h4').allTextContents(),['Image / Runtime','Debug / Toolchain']);
 assert.deepEqual(await groups.nth(0).locator('.section-name').allTextContents(),['.text','.pdata','.bss','.custom']);
 assert.deepEqual(await groups.nth(1).locator('.section-name').allTextContents(),['.debug_info','.comment']);
 const textSection=page.locator('.section-detail').filter({has:page.locator('.section-name',{hasText:/^\.text$/})});
 const debugSection=page.locator('.section-detail').filter({has:page.locator('.section-name',{hasText:/^\.debug_info$/})});
 const barAppearance=()=>textSection.locator('.section-bar').evaluate(e=>{
  const css=getComputedStyle(e);return {width:css.width,height:css.height,color:css.backgroundColor};
 });
 const closedBar=await barAppearance();
 await textSection.locator('summary').click();await debugSection.locator('summary').click();
 assert.deepEqual(await barAppearance(),closedBar,'opening a section must not change its quantitative bar');
 await textSection.locator('summary').click();
 assert.deepEqual(await barAppearance(),closedBar,'closing a section must not change its quantitative bar');
 await textSection.locator('summary').click();
 assert.equal(await page.locator('details[open]').count(),2,'sections still expand independently');
 await assertHexBytes(textSection.locator('.hex-preview'),mixed.subarray(0x600,0x600+sectionData[1].data.length),0x600);
 await assertHexBytes(debugSection.locator('.hex-preview'),mixed.subarray(0x400,0x400+129),0x400);
 assert.ok(await textSection.locator('.hex-preview').evaluate(e=>e.clientWidth<e.closest('details').clientWidth),'desktop hex panel should fit its content');
 assert.ok(await textSection.locator('.hex-preview').evaluate(e=>e.scrollWidth===e.clientWidth),'all byte columns should fit on desktop');
 assert.equal(await page.locator('#inspection img').count(),0,'ASCII content rendered as text');
 const textBar=await textSection.locator('.section-bar').evaluate(e=>parseFloat(e.style.width));
 assert.ok(Math.abs(textBar-sectionData[1].data.length/129*100)<0.001,'bar scale includes the largest debug section');
 const emptySection=page.locator('.section-detail').filter({has:page.locator('.section-name',{hasText:/^\.bss$/})});
 await emptySection.locator('summary').click();assert.equal(await emptySection.locator('.hex-preview').textContent(),'No file-backed bytes.');
 await page.screenshot({path:path.join(out,'lab-result.png'),fullPage:true});
 for(const width of [390,320]){
  await page.setViewportSize({width,height:900});
  const preview=textSection.locator('.hex-preview');
  assert.equal(await preview.evaluate(e=>getComputedStyle(e).whiteSpace),'pre');
  assert.ok(await preview.evaluate(e=>e.scrollWidth>e.clientWidth),'hex rows have a local horizontal scroll area');
  await preview.evaluate(e=>{e.scrollLeft=0;});await assertKeyboardScroll(page,preview);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`result overflow at ${width}`);
  if(width===390)await page.screenshot({path:path.join(out,'lab-result-mobile.png'),fullPage:true});
 }
 await page.getByRole('button',{name:'Clear file',exact:true}).click();assert.equal(await page.locator('#inspection').isVisible(),false);
 assert.equal(await page.locator('[data-clear]').textContent(),'Clear / cancel');
 await input.setInputFiles({name:'fixture32.exe',mimeType:'application/octet-stream',buffer:fixture(false,'<img>')});
 await page.locator('#inspection').waitFor({state:'visible'});assert.match(await page.locator('#inspection').textContent(),/0x401000/);assert.equal(await page.locator('#inspection img').count(),0,'untrusted content rendered as HTML');
 await input.setInputFiles({name:'bad.exe',mimeType:'application/octet-stream',buffer:Buffer.from('not a PE')});
 await page.getByRole('status').filter({hasText:'expected a Windows PE file'}).waitFor();assert.equal(await page.locator('#inspection').isVisible(),false);
 assert.equal(await page.getByRole('button',{name:'Clear / cancel',exact:true}).isVisible(),true);
 await input.setInputFiles({name:'large.exe',mimeType:'application/octet-stream',buffer:Buffer.alloc(16*1024*1024+1)});
 await page.getByRole('status').filter({hasText:'16 MiB limit'}).waitFor();
 // Bypass the UI guard: the Go browser adapter must enforce its own budget.
 const oversizedResult=await page.evaluate(()=>new Promise((resolve,reject)=>{
  const root=document.querySelector('[data-loupe]');const worker=new Worker(root.dataset.worker);
  const timer=setTimeout(()=>{worker.terminate();reject(new Error('adapter budget check timed out'));},15000);
  worker.onmessage=({data})=>{clearTimeout(timer);worker.terminate();resolve(data);};
  worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(new Error('adapter worker failed'));};
  const bytes=new ArrayBuffer(16*1024*1024+1);
  worker.postMessage({bytes,runtime:root.dataset.runtime,wasm:root.dataset.wasm},[bytes]);
 }));
 assert.match(oversizedResult.error,/16 MiB limit/);
 await input.setInputFiles({name:'empty.exe',mimeType:'application/octet-stream',buffer:Buffer.alloc(0)});
 await page.getByRole('status').filter({hasText:'This file is empty'}).waitFor();
 // Worker asset failure, cancellation, then recovery.
 await page.route('**/*.wasm',route=>route.abort());
 await input.setInputFiles({name:'fixture.exe',mimeType:'application/octet-stream',buffer:fixture()});
 await page.getByRole('status').filter({hasText:'could not'}).waitFor();await page.unroute('**/*.wasm');
 let cancelledRequest;const cancellationPending=new Promise(resolve=>{cancelledRequest=resolve;});
 await page.route('**/*.wasm',route=>cancelledRequest(route));
 await input.setInputFiles({name:'fixture.exe',mimeType:'application/octet-stream',buffer:fixture()});
 const cancelledRoute=await cancellationPending;
 await page.getByRole('button',{name:'Clear / cancel'}).click();assert.equal(await page.locator('#inspection').isVisible(),false);
 await cancelledRoute.abort();await page.unroute('**/*.wasm');
 await input.setInputFiles({name:'fixture.exe',mimeType:'application/octet-stream',buffer:fixture()});await page.locator('#inspection').waitFor({state:'visible'});
 // Drag/drop exercises the same core; a hung engine must remain cancellable and time-bounded.
 const payload=Array.from(fixture());
 const transfer=await page.evaluateHandle(bytes=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(bytes)],"dropped.exe"));return dt;},payload);
 await page.locator('.drop-zone').dispatchEvent('drop',{dataTransfer:transfer});await page.locator('#inspection').waitFor({state:'visible'});assert.match(await page.locator('#inspection h2').textContent(),/dropped.exe/);
 await page.locator('summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('details[open]').count(),1);
 let stalled;
 await page.route('**/*.wasm',route=>{stalled=route;});
 await input.setInputFiles({name:'deadline.exe',mimeType:'application/octet-stream',buffer:fixture()});
 await page.getByRole('status').filter({hasText:'Inspection timed out'}).waitFor({timeout:20000});
 await stalled?.abort();await page.unroute('**/*.wasm');assert.equal(await page.locator('#inspection').isVisible(),false);
 // Real project fixture is optional and inspected only, never launched.
 if(process.env.LOUPE_FIXTURE){await input.setInputFiles(process.env.LOUPE_FIXTURE);await page.locator('#inspection').waitFor({state:'visible'});assert.ok((await page.locator('summary').count())>1);await page.screenshot({path:path.join(out,'loupe-real-fixture.png'),fullPage:true});}
 assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0,'persistent storage used');
 assert.equal(requests.filter(r=>r.method!=='GET'||r.data).length,0,'unexpected network mutation');
 assert.equal(requests.filter(r=>!r.url.startsWith(base)).length,0,'unexpected external requests');
 assert.deepEqual(errors,[]);
 const noJS=await browser.newContext({javaScriptEnabled:false});const staticPage=await noJS.newPage();await staticPage.goto(base+'/labs/');assert.ok(await staticPage.locator('noscript').isVisible());await staticPage.goto(base+'/');assert.equal(await staticPage.locator('h1').count(),1);
 // The mobile record index is a native disclosure and works without JavaScript.
 await staticPage.setViewportSize({width:320,height:900});
 await staticPage.goto(base+'/research/pe-address-spaces/');
 const contents=staticPage.locator('.contents-mobile');
 assert.equal(await contents.getAttribute('open'),null);
 assert.equal(await staticPage.locator('.revision-marker').isVisible(),false);
 await contents.locator('summary').focus();await staticPage.keyboard.press('Enter');
 assert.equal(await contents.locator('nav').isVisible(),true);
 for(const link of await contents.getByRole('link').all()) assert.ok((await link.boundingBox()).height>=44,'small section-navigation target');
 await contents.getByRole('link',{name:'A section has two extents'}).click();
 assert.ok(staticPage.url().endsWith('#a-section-has-two-extents'));
 const code=staticPage.locator('.article-content pre').first();
 assert.equal(await code.evaluate(e=>getComputedStyle(e).whiteSpace),'pre');
 assert.ok(await code.evaluate(e=>e.scrollWidth>e.clientWidth),'long code should scroll rather than wrap');
 await assertKeyboardScroll(staticPage,code);
 const table=staticPage.locator('.article-content table');
 assert.ok(await table.evaluate(e=>e.scrollWidth>e.clientWidth),'wide table should have its own scroll area');
 await assertKeyboardScroll(staticPage,table);
 assert.equal(await staticPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await staticPage.locator('.footer-quote').textContent(),'"The world will see the great result from my hands"');
 for(const link of await staticPage.locator('.site-header nav a').all()){
  const bounds=await link.boundingBox();assert.ok(bounds.width>=44&&bounds.height>=44,'small primary-navigation target');
 }
 await browser.close();console.log('PASS: 40 responsive route checks; PE32/PE32+; actual hex offsets/bytes/ASCII and partial rows; section grouping; runtime metadata; mobile hex scrolling; hostile text; malformed/empty/oversize; clear/cancel; drop/keyboard; 15s timeout; engine failure/recovery; local GET-only traffic; no storage; no-JS record navigation; keyboard code/table scrolling; navigation targets; unchanged footer text.');
})().catch(e=>{console.error(e);process.exitCode=1;});
