/* Geometry oracles read fixture declarations only. Every fixture is inspected,
 * never executed; production PE parsing remains exclusively in Loupe. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function extents(bytes) {
  const coff=bytes.readUInt32LE(0x3c)+4, optional=coff+20;
  const table=optional+bytes.readUInt16LE(coff+16);
  return {
    size:bytes.length, headers:bytes.readUInt32LE(optional+60),
    sections:Array.from({length:bytes.readUInt16LE(coff+2)},(_,index)=>({
      index, size:bytes.readUInt32LE(table+index*40+16), start:bytes.readUInt32LE(table+index*40+20)
    }))
  };
}
function layoutFixture(fixture, overlap=false) {
  const bytes=Buffer.alloc(8192);fixture().copy(bytes);bytes.fill(0,0x188,0x400);
  bytes.writeUInt16LE(5,0x86);bytes.writeUInt32LE(0x400,0x98+60);bytes.writeUInt32LE(0x9000,0x98+56);
  // Physical order differs from table order; duplicate names have distinct IDs.
  const sections=[['.tiny',0x1800,1],['.text',0x600,0x800],['.bss',0,0],['.text',overlap?0x800:0x1000,0x400],['.debug',0x1801,0x1ff]];
  sections.forEach(([name,start,size],index)=>{
    const entry=0x188+index*40;bytes.write(name,entry,8);
    bytes.writeUInt32LE(0x900,entry+8);bytes.writeUInt32LE((index+1)*0x1000,entry+12);
    bytes.writeUInt32LE(size,entry+16);bytes.writeUInt32LE(start,entry+20);bytes.writeUInt32LE(0x40000040,entry+36);
    if(start)bytes.fill(0x41+index,start,start+size);
  });
  return bytes;
}
async function geometry(page, bytes) {
  const expected=extents(bytes);
  // Sample the coordinate surface and its regions in one frame: focus/resize
  // can legitimately scroll the instrument between separate browser calls.
  const actual=await page.locator('.file-map-strip').evaluate(strip=>({
    strip:{x:strip.getBoundingClientRect().x,width:strip.getBoundingClientRect().width},
    regions:Object.fromEntries([...strip.children].map(region=>{
      const bounds=region.getBoundingClientRect();return [region.dataset.region,{x:bounds.x,width:bounds.width}];
    }))
  }));
  const strip=actual.strip;
  const backed=expected.sections.filter(s=>s.start>0&&s.size>0);
  assert.equal(await page.locator('.file-map-section').count(),backed.length);
  const check=(id,start,size)=>{
    const box=actual.regions[id];
    assert.ok(Math.abs((box.x-strip.x)-start/expected.size*strip.width)<0.1,`physical offset ${start}`);
    assert.ok(Math.abs(box.width-size/expected.size*strip.width)<0.1,`raw size ${size}`);
  };
  check('headers',0,expected.headers);
  for(const s of backed)check(`section-${s.index}`,s.start,s.size);
  assert.equal(await page.locator('.section-row[data-region^="section-"]').count(),expected.sections.length,'zero-byte sections retain an accessible target');
  const order=await page.locator('.file-map-section').evaluateAll(nodes=>nodes.map(n=>n.dataset.region));
  assert.deepEqual(order,backed.sort((a,b)=>a.start-b.start).map(s=>`section-${s.index}`),'map uses physical order');
  // A byte occupancy oracle independently checks all gaps, including trailing data.
  const covered=new Uint8Array(bytes.length);covered.fill(1,0,expected.headers);
  for(const s of backed)covered.fill(1,s.start,s.start+s.size);
  const gaps=[];
  for(let start=0;start<covered.length;start++)if(!covered[start]){
    let end=start+1;while(end<covered.length&&!covered[end])end++;
    gaps.push({start,size:end-start});start=end-1;
  }
  assert.equal(await page.locator('.file-map-gap').count(),gaps.length);
  for(const gap of gaps)check(`gap-${gap.start}`,gap.start,gap.size);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no page overflow');
}

module.exports=async function fileMapChecks({browser,page,base,out,fixture}) {
  const input=page.locator('#pe-file');
  const load=async (bytes,name='layout.exe')=>{
    await input.setInputFiles({name,mimeType:'application/octet-stream',buffer:bytes});
    await page.locator('.binary-map').waitFor();
    await page.waitForFunction(()=>document.querySelector('#inspection').getAnimations().length===0);
    const heading=await page.locator('.lab-header h1').boundingBox();
    assert.ok(heading.y>=0&&heading.y<80,'successful inspection keeps Loupe near the top of the viewport');
  };
  const bytes=layoutFixture(fixture);
  await page.setViewportSize({width:1440,height:900});await load(bytes);await geometry(page,bytes);
  const key=index=>page.locator(`.section-row[data-region="section-${index}"]`);
  const mark=index=>page.locator(`.file-map-region[data-region="section-${index}"]`);
  const readout=page.locator('.file-map-readout');
  const quantitative=()=>page.locator('.section-bar').evaluateAll(nodes=>nodes.map(n=>({width:n.style.width,color:getComputedStyle(n).backgroundColor,height:getComputedStyle(n).height})));
  const bars=await quantitative();
  const selected=()=>page.locator('#inspection').getAttribute('data-selected');
  const cursor=async(offset,track=0)=>{
    const box=await page.locator('.file-map-strip').boundingBox();
    await page.mouse.move(box.x+(offset+.25)/bytes.length*box.width,box.y+track*52+24);
    assert.equal(Number(await readout.getAttribute('data-offset')),offset,'cursor uses absolute file coordinates');
  };
  // The default is useful immediately; hover can never silently replace it.
  const first=await selected(), firstBytes=await page.locator('.hex-preview').textContent();
  await cursor(0x710);
  assert.equal(await readout.getAttribute('data-region'),'section-1');
  assert.equal(await page.locator('[data-measurement=rva]').textContent(),'0x00002110');
  assert.equal(await selected(),first);
  assert.equal(await page.locator('.hex-preview').textContent(),firstBytes,'exploration does not replace locked bytes');
  const y=await page.evaluate(()=>scrollY);
  await page.mouse.down();await page.mouse.up();
  assert.equal(await selected(),'section-1');
  assert.equal(await page.locator('.selection-heading h3').textContent(),'.text');
  assert.match(await page.locator('.hex-preview').textContent(),/00000600\s+42/);
  assert.equal(await page.evaluate(()=>scrollY),y,'map selection does not scroll the page');
  const measurements=await page.locator('.selected-panel').boundingBox();
  assert.ok(measurements.y>=0&&measurements.y+measurements.height<=900,'selected measurements remain visible below Loupe');
  const preview=await page.locator('.hex-preview').boundingBox();
  assert.ok(preview.y>=0&&preview.y+60<=900,'hex header and first byte row are visible with the project heading retained');
  await cursor(0x1100);assert.equal(await readout.getAttribute('data-region'),'section-3');
  assert.equal(await page.locator('[data-measurement=rva]').textContent(),'0x00004100');
  await page.mouse.move(0,0);
  assert.equal(Number(await readout.getAttribute('data-offset')),0x710,'leaving restores the locked byte');
  assert.equal(await readout.getAttribute('data-region'),'section-1');
  await cursor(0x450);assert.equal(await readout.getAttribute('data-region'),'gap-1024');
  assert.equal(await page.locator('[data-measurement=rva]').textContent(),'—');
  await page.mouse.down();await page.mouse.up();
  assert.match(await page.locator('.hex-empty').textContent(),/Byte previews are available for PE sections/);
  await cursor(0x10);assert.equal(await readout.getAttribute('data-region'),'headers');
  await cursor(bytes.length-1);assert.equal(Number(await readout.getAttribute('data-offset')),bytes.length-1,'last file byte, not EOF');
  // Tiny sections keep exact geometry and full-sized controls in the index.
  await key(0).focus();assert.equal(await readout.getAttribute('data-region'),'section-0');
  await page.keyboard.press('Enter');assert.equal(await selected(),'section-0');
  assert.equal(await key(0).getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('.hex-preview').textContent(),/00001800\s+41/);
  assert.ok((await mark(0).boundingBox()).width<1,'tiny visual width is not inflated');
  const target=await key(0).boundingBox();assert.ok(target.width>=44&&target.height>=44);
  await page.keyboard.press('Space');assert.equal(await selected(),'section-0','repeat selection stays locked');
  await key(3).click();assert.equal(await mark(3).getAttribute('aria-pressed'),'true');
  assert.equal(await mark(1).getAttribute('aria-pressed'),'false','duplicate names do not alias');
  assert.deepEqual(await quantitative(),bars,'interaction never changes size bars');
  await key(2).click();assert.equal(await page.locator('.hex-preview').textContent(),'No file-backed bytes.');
  assert.equal(await mark(2).count(),0,'zero raw bytes do not occupy file space');
  assert.equal(await page.locator('.file-map-cursor').isVisible(),false,'unbacked section cannot claim an offset cursor');
  await key(1).focus();await page.keyboard.press('ArrowDown');assert.equal(await page.locator(':focus').getAttribute('data-region'),'section-2');
  await page.keyboard.press('Home');assert.equal(await page.locator(':focus').getAttribute('data-region'),'section-0');
  await page.keyboard.press('End');assert.equal(await page.locator(':focus').getAttribute('data-region'),'section-4');
  await mark(1).focus();await page.keyboard.press('ArrowRight');
  assert.equal(Number(await readout.getAttribute('data-offset')),0x601);
  await page.keyboard.press('Shift+ArrowRight');assert.equal(Number(await readout.getAttribute('data-offset')),0x611);
  await page.keyboard.press('Enter');await page.mouse.move(0,0);
  assert.equal(Number(await readout.getAttribute('data-offset')),0x611,'keyboard can lock an exact byte');
  await mark(1).blur();
  await page.screenshot({path:path.join(out,'workspace-desktop.png')});
  for(const [width,height] of [[1440,768],[1280,800],[1024,768]]) {
    await page.setViewportSize({width,height});
    await page.locator('#inspection').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
    const preview=await page.locator('.hex-preview').boundingBox();
    assert.ok(preview.y+preview.height<=height,`hex fits short desktop ${width} × ${height}`);
    await page.screenshot({path:path.join(out,`workspace-${width}-${height}.png`)});
  }
  for(const width of [1024,768,390,320]){
    await page.setViewportSize({width,height:900});await geometry(page,bytes);
    assert.ok(await page.locator('.file-map-scroll').evaluate(e=>e.scrollWidth>e.clientWidth),'proportional strip scrolls locally');
    if(width<=1000)await page.locator('.section-index').evaluate(e=>{e.open=true;});
    await key(4).focus();
    const visible=await page.locator('.file-map-scroll').boundingBox(), focused=await mark(4).boundingBox();
    assert.ok(focused.x>=visible.x&&focused.x+focused.width<=visible.x+visible.width,'focus reveals the corresponding extent');
    await page.keyboard.press('Enter');
    if(width<=1000){
      assert.equal(await page.locator('.section-index').getAttribute('open'),null,'mobile selection collapses the index');
      // Native scrolling can round fractional layout coordinates to a CSS pixel.
      const panel=await page.locator('.selected-panel').boundingBox();assert.ok(panel.y>=0&&panel.y+panel.height<=901,`mobile index selection reveals measurements at ${width}px: ${JSON.stringify(panel)}`);
    }
    await page.screenshot({path:path.join(out,`workspace-${width}.png`),fullPage:true});
  }
  const overlapping=layoutFixture(fixture,true);await page.setViewportSize({width:1440,height:1000});await load(overlapping);await geometry(page,overlapping);
  assert.notEqual((await mark(1).boundingBox()).y,(await mark(3).boundingBox()).y,'overlaps retain their coordinates on distinct tracks');
  await cursor(0x900,1);assert.equal(await readout.getAttribute('data-region'),'section-3');
  await cursor(0x900,0);assert.equal(await readout.getAttribute('data-region'),'section-1');
  assert.match(await page.locator('.file-map-footnote').textContent(),/Overlapping ranges/);
  // File padding must not claim an RVA inside a smaller declared virtual extent.
  const padded=Buffer.from(bytes);padded.writeUInt32LE(16,0x188+40+8);await load(padded);
  await cursor(0x60f);assert.equal(await page.locator('[data-measurement=rva]').textContent(),'0x0000200F');
  await cursor(0x610);assert.match(await page.locator('[data-measurement=rva]').textContent(),/outside virtual size/);
  // Real development specimens remain local and are inspected, never launched.
  for(const [label,env] of [['release','LOUPE_RELEASE_FIXTURE'],['debug','LOUPE_DEBUG_FIXTURE'],['go','LOUPE_GO_FIXTURE']]){
    if(!process.env[env])continue;
    const real=fs.readFileSync(process.env[env]);await load(real,path.basename(process.env[env]));
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:900});
      // Let the responsive index disclosure finish adapting before opening it.
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await geometry(page,real);
      await page.locator('.section-index').evaluate(e=>{e.open=true;});
      await page.locator('.section-row').last().click();
      await page.screenshot({path:path.join(out,`workspace-${label}-${width}.png`)});
    }
    console.log(`PASS: ${label} file map / ${real.length} bytes / ${extents(real).sections.length} sections`);
  }
  // Real touch dispatch verifies dragging, pointer capture and committing on release.
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const phone=await touch.newPage();await phone.goto(base+'/labs/');
  await phone.locator('#pe-file').setInputFiles({name:'touch.exe',mimeType:'application/octet-stream',buffer:bytes});
  await phone.locator('.binary-map').waitFor();
  await phone.waitForFunction(()=>document.querySelector('#inspection').getAnimations().length===0);
  const phoneHeading=await phone.locator('.lab-header h1').boundingBox();
  assert.ok(phoneHeading.y>=0&&phoneHeading.y<80,'Loupe stays visible after parsing on touch devices');
  await phone.locator('.file-map-strip').scrollIntoViewIfNeeded();
  const box=await phone.locator('.file-map-strip').boundingBox(), scrollX=await phone.locator('.file-map-scroll').evaluate(e=>e.scrollLeft);
  const session=await touch.newCDPSession(phone);
  const position=offset=>({x:box.x+(offset+.25)/bytes.length*box.width,y:box.y+24});
  // Start at the initial visible selection; drag across the visible strip.
  const startOffset=Math.ceil(scrollX/box.width*bytes.length)+100;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[position(startOffset)]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[position(startOffset+400)]});
  const explored=await phone.locator('.file-map-readout').getAttribute('data-offset');
  assert.ok(Math.abs(Number(explored)-(startOffset+400))<=1,'touch dragging reports the actual byte');
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await phone.locator('.file-map-state').textContent(),'LOCKED');
  assert.equal(await phone.locator('#inspection').getAttribute('data-selected'),await phone.locator('.file-map-readout').getAttribute('data-region'));
  const locked=await phone.locator('#inspection').getAttribute('data-selected');
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[position(startOffset+700)]});
  await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.equal(await phone.locator('#inspection').getAttribute('data-selected'),locked,'cancelled gesture preserves selection');
  assert.equal(await phone.locator('.file-map-state').textContent(),'LOCKED');
  await phone.locator('.file-map-scroll').evaluate(e=>{e.scrollLeft=0;});
  const surface=await phone.locator('.file-map-scroll').boundingBox();
  const ruler=await phone.locator('.file-map-scale').boundingBox();
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:surface.x+surface.width-20,y:ruler.y+12}]});
  for(const distance of [40,80,160]) {
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:surface.x+surface.width-20-distance,y:ruler.y+12}]});
    await phone.waitForTimeout(30);
  }
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await phone.waitForFunction(()=>document.querySelector('.file-map-scroll').scrollLeft>0);
  assert.equal(await phone.locator('#inspection').getAttribute('data-selected'),locked,'panning the ruler preserves selection');
  await phone.locator('.section-index>summary').tap();await phone.locator('.section-row[data-region="section-0"]').tap();
  assert.equal(await phone.locator('#inspection').getAttribute('data-selected'),'section-0');
  assert.match(await phone.locator('.hex-preview').textContent(),/00001800\s+41/);
  await geometry(phone,bytes);await phone.screenshot({path:path.join(out,'workspace-touch.png'),fullPage:true});
  await touch.close();
  await page.getByRole('button',{name:'Clear file',exact:true}).click();
  assert.equal(await page.locator('.binary-map').count(),0,'reset disposes all workspace state');
  assert.equal(await page.locator('.drop-zone').isVisible(),true,'clear restores the original uploader');
  console.log('PASS: file geometry, cursor offsets/RVAs, gaps, padding, overlaps, zero-byte/subpixel sections, locked selection, visible metadata/bytes, keyboard scrub, touch drag, mobile selection and quantitative bars.');
};
