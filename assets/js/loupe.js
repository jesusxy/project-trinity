const root = document.querySelector("[data-loupe]");
const input = root.querySelector("input");
const drop = root.querySelector(".drop-zone");
const status = root.querySelector("[role=status]");
const output = root.querySelector("#inspection");
const clear = root.querySelector("[data-clear]");
const labHeader = document.querySelector(".lab-header");
let worker, timer, disposeInspection, generation = 0;
const stop = () => { worker?.terminate(); worker = null; clearTimeout(timer); };
const reset = () => { ++generation; stop(); disposeInspection?.(); disposeInspection=null; status.parentElement.append(clear); document.body.classList.remove("loupe-inspecting"); output.replaceChildren(); output.hidden = true; input.value = ""; clear.hidden = true; clear.textContent = "Clear / cancel"; root.removeAttribute("aria-busy"); };
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if(cls) n.className=cls; return n; };
const hex = value => `0x${value.toString(16).toUpperCase()}`;
const address = value => `0x${value.toString(16).toUpperCase().padStart(8,"0")}`;
const field = (list, label, value, cls) => { const pair=node("div",undefined,cls); pair.append(node("dt", label),node("dd",String(value))); list.append(pair); };
// Section names only guide presentation; unknown names stay with the image sections.
const isToolchainSection = section => /^(?:\.(?:z?debug)(?:[._$]|$)|\.gnu_debug(?:link|altlink)$|\.gnu\.lto_|\.(?:stab|stabstr|comment|drectve|llvm_addrsig)$)/i.test(section.name);
// Coordinate-space adapter: the renderer consumes extents, never PE bytes or RVAs.
// Section-table indexes are identities; names and physical order need not be unique.
function fileLayout(result) {
  const sections=result.sections.map((section,index)=>({
    id:`section-${index}`, sectionIndex:index, kind:"section", name:section.name || "(unnamed)",
    start:section.offset, size:section.rawSize, backed:section.offset>0 && section.rawSize>0
  }));
  const regions=[{id:"headers",kind:"headers",name:"HEADERS",start:0,size:result.headerSize,backed:true},...sections.filter(region=>region.backed)]
    .sort((a,b)=>a.start-b.start);
  // Complement of the union, including trailing bytes. These bytes are not
  // classified by this view; a gap does not mean zero-filled or unused data.
  const gaps=[];let end=0;
  for (const region of regions) {
    if(region.start>end) gaps.push({id:`gap-${end}`,kind:"gap",name:"Outside headers / sections",start:end,size:region.start-end,backed:true});
    end=Math.max(end,region.start+region.size);
  }
  if(end<result.size) gaps.push({id:`gap-${end}`,kind:"gap",name:"Outside headers / sections",start:end,size:result.size-end,backed:true});
  // Unusual overlapping declarations retain their coordinates on separate tracks.
  const tracks=[];
  for(const region of regions) {
    let track=tracks.findIndex(end=>end<=region.start);
    if(track<0) track=tracks.length;
    region.track=track;tracks[track]=region.start+region.size;
  }
  return {size:result.size,regions,gaps,unbacked:sections.filter(region=>!region.backed),tracks:tracks.length};
}
function binaryFileMap(layout, result, onSelect, onExplore) {
  const figure=node("figure",undefined,"binary-map");
  figure.setAttribute("aria-label","Binary file map");
  const caption=node("figcaption",undefined,"file-map-caption");
  caption.append(node("span","01 / FILE","file-map-mode"),node("span","RAW FILE COORDINATES","file-map-mode"));figure.append(caption);
  const scroll=node("div",undefined,"file-map-scroll");
  scroll.tabIndex=0;scroll.setAttribute("aria-label","File map. Drag the ruler to pan on narrow screens; Tab to regions, arrow keys to explore bytes, Enter to select.");
  const plot=node("div",undefined,"file-map-plot");
  const scale=node("div",undefined,"file-map-scale");scale.setAttribute("aria-hidden","true");
  for(const ratio of [0,.25,.5,.75,1]) {
    const offset=Math.floor(layout.size*ratio), tick=node("span",`${address(offset)}${ratio===1 ? " / EOF" : ""}`);
    tick.style.left=`${offset/layout.size*100}%`;scale.append(tick);
  }
  const strip=node("div",undefined,"file-map-strip");strip.style.height=`${layout.tracks*52}px`;
  const cursor=node("span",undefined,"file-map-cursor");cursor.hidden=true;cursor.setAttribute("aria-hidden","true");
  plot.append(scale,strip,cursor);scroll.append(plot);figure.append(scroll);
  const readout=node("dl",undefined,"file-map-readout");
  const measurements={};
  for(const [key,label] of [["offset","File offset"],["region","Region / section"],["rva","RVA"]]) {
    const pair=node("div"), value=node("dd");value.dataset.measurement=key;measurements[key]=value;
    pair.append(node("dt",label),value);readout.append(pair);
  }
  figure.append(readout);
  const hint=node("p",undefined,"file-map-hint"), mode=node("span",undefined,"file-map-state");
  const instruction=(label,text)=>{const line=node("span");line.append(node("strong",`${label} / `),text);return line;};
  const pointerHint=node("span",undefined,"map-help-pointer"), touchHint=node("span",undefined,"map-help-touch");
  pointerHint.append(instruction("EXPLORE","move pointer across file"),instruction("LOCK","click a region"));
  touchHint.append(instruction("EXPLORE","drag across file"),instruction("LOCK","tap a region or release drag"),node("span","Scroll ruler to pan.","map-help-pan"));
  hint.append(mode,pointerHint,touchHint);figure.append(hint);
  figure.append(node("p",`Unassigned = outside declared headers / sections.${layout.tracks>1 ? " Overlapping ranges use separate tracks." : ""}`,"file-map-footnote"));
  const regions=[...layout.regions,...layout.gaps].sort((a,b)=>a.start-b.start);
  const entries=new Map();let locked=null, explored=null, keyboard=null, dragPointer=null;
  const regionFor=id=>[...regions,...layout.unbacked].find(region=>region.id===id);
  const sampleFor=id=>{const region=regionFor(id);return region ? {region,offset:region.backed?region.start:null} : null;};
  function rvaAt(sample) {
    const section=result.sections[sample.region.sectionIndex];
    if(!section || sample.offset===null)return "—";
    const delta=sample.offset-section.offset;
    // File-alignment padding has no coordinate inside the declared virtual extent.
    if(delta>=section.virtualSize)return "— · outside virtual size";
    const value=Number(section.rva)+delta;
    return value<=0xFFFFFFFF ? address(value) : "— · outside RVA range";
  }
  function draw() {
    const sample=explored || keyboard || locked;
    for(const [id,mark] of entries) {
      mark.classList.toggle("is-active",id===(explored || keyboard)?.region.id);
      mark.classList.toggle("is-selected",id===locked?.region.id);
      mark.setAttribute("aria-pressed",String(id===locked?.region.id));
    }
    cursor.hidden=sample?.offset==null;
    if(!cursor.hidden)cursor.style.left=`${sample.offset/layout.size*100}%`;
    cursor.classList.toggle("is-locked",!explored && !keyboard);
    measurements.offset.textContent=sample?.offset!=null ? address(sample.offset) : "—";
    measurements.region.textContent=sample?.region.name || "Explore the file";
    measurements.rva.textContent=sample ? rvaAt(sample) : "—";
    mode.textContent=explored || keyboard ? "EXPLORING" : "LOCKED";
    readout.dataset.offset=sample?.offset ?? "";
    readout.dataset.region=sample?.region.id || "";
    onExplore((explored || keyboard)?.region.id || null);
  }
  function atPointer(event) {
    const bounds=strip.getBoundingClientRect();
    const offset=Math.max(0,Math.min(layout.size-1,Math.floor((event.clientX-bounds.left)/bounds.width*layout.size)));
    const track=Math.max(0,Math.floor((event.clientY-bounds.top)/52));
    const matches=regions.filter(region=>offset>=region.start && offset<region.start+region.size);
    // Track identifies an overlapping declaration; do not silently alias its neighbor.
    const region=matches.find(region=>(region.track || 0)===track) || matches[0];
    return region ? {region,offset} : null;
  }
  function commit(sample) {
    if(!sample)return;
    locked=sample;explored=null;keyboard=null;draw();onSelect(sample.region.id);
  }
  for(const region of regions) {
    const mark=node("button",undefined,`file-map-region file-map-${region.kind}`);
    mark.type="button";mark.dataset.region=region.id;
    mark.setAttribute("aria-label",`${region.name}: file offset ${address(region.start)}, ${region.size.toLocaleString()} bytes. Arrow keys explore; Enter locks selection.`);
    mark.setAttribute("aria-controls","loupe-selection loupe-hex");
    mark.style.left=`${region.start/layout.size*100}%`;mark.style.width=`${region.size/layout.size*100}%`;
    mark.style.top=`${(region.track || 0)*52}px`;
    mark.append(node("span",region.kind==="gap" ? "UNASSIGNED" : region.name,"file-map-region-name"));
    entries.set(region.id,mark);strip.append(mark);
    mark.addEventListener("focus",()=>{explored=null;keyboard=sampleFor(region.id);draw();reveal(region.id);});
    mark.addEventListener("blur",()=>{keyboard=null;draw();});
    mark.addEventListener("keydown",event=>{
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      event.preventDefault();readout.setAttribute("aria-live","polite");
      const previous=keyboard?.region.id===region.id ? keyboard.offset : region.start;
      const offset=event.key==="Home" ? region.start : event.key==="End" ? region.start+region.size-1 : Math.max(region.start,Math.min(region.start+region.size-1,previous+(event.key==="ArrowRight"?1:-1)*(event.shiftKey?16:1)));
      explored=null;keyboard={region,offset};draw();
    });
    mark.addEventListener("click",event=>{
      if(event.detail===0)commit(keyboard || sampleFor(region.id));
      // Pointer activation commits on pointerup, which preserves fractional coordinates.
    });
  }
  strip.addEventListener("pointermove",event=>{
    readout.removeAttribute("aria-live");
    if(event.pointerType==="touch" && dragPointer!==event.pointerId)return;
    explored=atPointer(event);draw();
  });
  strip.addEventListener("pointerleave",()=>{if(dragPointer===null){explored=null;draw();}});
  strip.addEventListener("pointerdown",event=>{
    if(event.button!==0)return;
    dragPointer=event.pointerId;strip.setPointerCapture(event.pointerId);explored=atPointer(event);draw();
  });
  strip.addEventListener("pointerup",event=>{
    if(event.pointerId!==dragPointer)return;
    dragPointer=null;strip.releasePointerCapture(event.pointerId);commit(atPointer(event));
  });
  const cancel=()=>{dragPointer=null;explored=null;keyboard=null;draw();};
  strip.addEventListener("pointercancel",cancel);
  strip.addEventListener("lostpointercapture",()=>{if(dragPointer!==null)cancel();});
  function reveal(id) {
    const target=entries.get(id);if(!target)return;
    const bounds=target.getBoundingClientRect(), viewport=scroll.getBoundingClientRect();
    if(bounds.left<viewport.left || bounds.right>viewport.right)scroll.scrollLeft+=bounds.left-viewport.left-(scroll.clientWidth-bounds.width)/2;
  }
  let previousWidth=0;
  const resize=new ResizeObserver(([entry])=>{
    const width=entry.contentRect.width;
    if(width && width!==previousWidth){previousWidth=width;if(locked)reveal(locked.region.id);}
  });resize.observe(scroll);
  return {
    element:figure,reveal,
    select:id=>{locked=sampleFor(id);explored=null;keyboard=null;draw();reveal(id);},
    explore:id=>{explored=id?sampleFor(id):null;draw();},
    dispose:()=>resize.disconnect()
  };
}
function hexPreview(section) {
  const preview=node("pre",undefined,"hex-preview");
  preview.tabIndex=0;
  preview.setAttribute("aria-label",`${section.name || "Unnamed section"} file bytes: absolute file offset, hexadecimal, and ASCII`);
  if (!section.preview) {
    preview.textContent="No file-backed bytes.";
    return preview;
  }
  // Loupe returns the actual preview bytes as space-separated hexadecimal pairs.
  const bytes=section.preview.split(" ");
  preview.append(node("span","OFFSET    00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f  ASCII\n","hex-header"));
  for (let i=0;i<bytes.length;i+=16) {
    const row=bytes.slice(i,i+16);
    const offset=(section.offset+i).toString(16).padStart(8,"0");
    const ascii=row.map(byte=>{
      const value=parseInt(byte,16);
      return value>=0x20 && value<=0x7e ? String.fromCharCode(value) : ".";
    }).join("");
    preview.append(node("span",offset,"hex-offset"),`  ${row.join(" ").padEnd(47," ")}  ${ascii}${i+16<bytes.length ? "\n" : ""}`);
  }
  return preview;
}
function render(result, name) {
  const identity=node("header",undefined,"workspace-identity");
  const specimen=node("div",undefined,"workspace-specimen");
  const heading=node("h2",name);heading.tabIndex=-1;heading.title=name;
  specimen.append(node("p","LOUPE / STATIC INSPECTION","eyebrow"),heading);
  const actions=node("div",undefined,"workspace-actions");
  const change=node("button","Change file");change.type="button";
  change.addEventListener("click",()=>{input.value="";input.click();});actions.append(change,clear);
  const meta=node("dl",undefined,"inspection-meta workspace-facts");
  for(const [label,value] of [["Format / machine",`${result.format} / ${result.machine}`],["File size",`${result.size.toLocaleString()} B`],["Entry RVA",result.entryRVA],["Image base",result.imageBase],["Sections",result.sections.length]])field(meta,label,value);
  const more=node("details",undefined,"workspace-global");
  more.append(node("summary","IMAGE DETAILS"));
  const global=node("dl",undefined,"inspection-meta");
  for(const [label,value] of [["Preferred entry VA",result.entryVA],["Image size",`${result.imageSize.toLocaleString()} B`],["Headers",`${result.headerSize.toLocaleString()} B`],["Section alignment",hex(result.alignment)]])field(global,label,value);
  more.append(global,node("p","Addresses describe the preferred image layout; nothing has been mapped or executed.","workspace-address-note"));identity.append(specimen,actions,meta,more);output.append(identity);

  const body=node("div",undefined,"workspace-body");
  const index=node("details",undefined,"section-index");
  const indexHeading=node("summary");indexHeading.append(node("span","SECTIONS","eyebrow"),node("span",String(result.sections.length).padStart(2,"0"),"index-count"));index.append(indexHeading);
  const indexContent=node("div",undefined,"section-index-content");
  indexContent.append(node("p","Raw size / largest section","index-scale"));
  const list=node("div",undefined,"section-index-list");list.setAttribute("role","group");list.setAttribute("aria-label","Section index. Arrow keys move between sections; Enter selects.");indexContent.append(list);index.append(indexContent);
  const selectedPanel=node("section",undefined,"selected-panel");selectedPanel.id="loupe-selection";selectedPanel.setAttribute("aria-label","Selected region measurements");
  const selectionHeading=node("div",undefined,"selection-heading"), selectionName=node("h3"), selectionLabel=node("p",undefined,"eyebrow");selectionName.tabIndex=-1;
  selectionHeading.append(selectionLabel,selectionName);
  const fields=node("dl",undefined,"inspection-meta selected-measurements");
  selectedPanel.append(selectionHeading,fields);
  const bytesPanel=node("section",undefined,"workspace-hex");bytesPanel.id="loupe-hex";bytesPanel.setAttribute("aria-label","Selected section hex and ASCII");
  const bytesHeading=node("div",undefined,"hex-caption"), byteCount=node("span");
  bytesHeading.append(node("h3","03 / HEX + ASCII","eyebrow"),byteCount);
  const bytesContent=node("div",undefined,"hex-content");bytesPanel.append(bytesHeading,bytesContent);
  const announcement=node("p",undefined,"inspection-announcement");announcement.setAttribute("role","status");announcement.setAttribute("aria-live","polite");

  const layout=fileLayout(result), regions=new Map([...layout.regions,...layout.gaps,...layout.unbacked].map(region=>[region.id,region]));
  const rows=new Map();let selected=null;
  const syncExploration=id=>{for(const [key,row] of rows)row.classList.toggle("is-active",key===id);};
  function select(id, fromIndex=false) {
    const region=regions.get(id);if(!region)return;
    if(fromIndex)map.select(id);
    if(selected===id)return;
    selected=id;output.dataset.selected=id;
    for(const [key,row] of rows) {
      row.classList.toggle("is-selected",key===id);row.setAttribute("aria-pressed",String(key===id));
    }
    const section=result.sections[region.sectionIndex];
    selectionLabel.textContent=section ? `02 / SELECTED SECTION ${String(region.sectionIndex+1).padStart(2,"0")}` : "02 / SELECTED FILE REGION";
    selectionName.textContent=region.name;
    fields.replaceChildren();
    if(section) {
      for(const [label,value] of [["File offset",hex(section.offset)],["Virtual address (RVA)",section.rva],["Raw size",`${section.rawSize.toLocaleString()} B`],["Virtual size",`${section.virtualSize.toLocaleString()} B`],["Declared permissions",section.permissions],[region.backed ? "Raw end (exclusive)" : "File range",region.backed ? address(region.start+region.size) : "No file-backed range"]])field(fields,label,value);
      const count=section.preview ? section.preview.split(" ").length : 0;
      byteCount.textContent=`${count} / ${section.rawSize.toLocaleString()} B · section start`;
      bytesContent.replaceChildren(hexPreview(section));
    } else {
      for(const [label,value] of [["File offset",hex(region.start)],["Raw size",`${region.size.toLocaleString()} B`],["End (exclusive)",hex(region.start+region.size)],["RVA","—"]])field(fields,label,value);
      byteCount.textContent="No section selected";
      bytesContent.replaceChildren(node("p","Byte previews are available for PE sections. Select a section in the map or index to inspect its first 128 bytes.","hex-empty"));
    }
    announcement.textContent=`Selected ${region.name}. ${section ? "Section measurements and hex preview updated." : "File region measurements updated."}`;
  }
  const map=binaryFileMap(layout,result,id=>select(id),syncExploration);
  const largest=Math.max(1,...result.sections.map(section=>section.rawSize));
  const imageSections=[],toolchainSections=[];
  result.sections.forEach((section,i)=>(isToolchainSection(section)?toolchainSections:imageSections).push({section,i}));
  const groups=toolchainSections.length ? [["Image / Runtime",imageSections],["Debug / Toolchain",toolchainSections]] : [[null,imageSections]];
  for(const [label,sections] of groups) {
    if(!sections.length)continue;
    const group=label ? node("section",undefined,"section-group") : list;
    if(label){group.setAttribute("aria-label",label);group.append(node("h4",label,"eyebrow"));list.append(group);}
    for(const {section,i} of sections) {
      const id=`section-${i}`, row=node("button",undefined,"section-row");row.type="button";row.dataset.region=id;row.id=`loupe-${id}`;rows.set(id,row);
      row.setAttribute("aria-controls","loupe-selection loupe-hex");
      row.setAttribute("aria-label",`${section.name || "Unnamed section"}, section ${i+1}, ${section.rawSize.toLocaleString()} bytes, permissions ${section.permissions}${section.offset && section.rawSize ? "" : ", no file-backed range"}`);
      row.append(node("span",String(i+1).padStart(2,"0"),"section-number"),node("span",section.name || "(unnamed)","section-name"),node("span",section.permissions,"permissions"),node("span",`${section.rawSize.toLocaleString()} B`,"section-size"));
      const bar=node("span",undefined,"section-bar");bar.style.width=`${section.rawSize/largest*100}%`;bar.setAttribute("aria-hidden","true");row.append(bar);group.append(row);
      row.addEventListener("pointerenter",event=>{if(event.pointerType!=="touch")map.explore(id);});
      row.addEventListener("pointerleave",()=>map.explore(null));
      row.addEventListener("focus",()=>{map.explore(id);map.reveal(id);});
      row.addEventListener("blur",()=>map.explore(null));
      row.addEventListener("click",()=>{
        select(id,true);
        if(!desktop.matches){index.open=false;selectionName.focus({preventScroll:true});selectedPanel.scrollIntoView({block:"nearest",behavior:"instant"});}
      });
    }
  }
  list.addEventListener("keydown",event=>{
    const keys=[...list.querySelectorAll("button")], i=keys.indexOf(document.activeElement);
    const next={ArrowDown:Math.min(i+1,keys.length-1),ArrowUp:Math.max(i-1,0),Home:0,End:keys.length-1}[event.key];
    if(next===undefined || i<0)return;event.preventDefault();keys[next].focus();
  });
  body.append(index,map.element,selectedPanel,bytesPanel);output.append(body,announcement);
  const footer=node("div",undefined,"workspace-footer");
  footer.append(node("span","GO · WASM / LOCAL · NO EXECUTION · NO UPLOAD"));
  const reference=node("a","File offsets & RVAs ↗");reference.href=root.dataset.research;footer.append(reference);output.append(footer);
  const desktop=matchMedia("(min-width: 1001px)");
  const adaptIndex=()=>{index.open=desktop.matches;};adaptIndex();desktop.addEventListener("change",adaptIndex);
  disposeInspection=()=>{map.dispose();desktop.removeEventListener("change",adaptIndex);};
  const initial=[...imageSections,...toolchainSections].find(({section})=>section.offset && section.rawSize) || imageSections[0] || toolchainSections[0];
  select(initial ? `section-${initial.i}` : "headers",true);
  clear.textContent="Clear file";
  document.body.classList.add("loupe-inspecting");output.hidden=false;
  heading.focus({preventScroll:true});
  // Anchor the transformation to Loupe's project identity, above the specimen.
  labHeader.scrollIntoView({block:"start",behavior:"instant"});
}
async function inspect(file) {
  reset(); if(!file) return;
  clear.hidden=false;
  if(file.size>16*1024*1024) {status.textContent="File exceeds the 16 MiB limit. Choose a smaller PE file.";return;}
  if(!file.size) {status.textContent="This file is empty. Choose a PE file.";return;}
  const current=generation;
  root.setAttribute("aria-busy","true");status.textContent="Reading file locally…";
  const fail=message=>{if(current!==generation)return;++generation;stop();root.removeAttribute("aria-busy");status.textContent=message;};
  timer=setTimeout(()=>{fail("Inspection timed out. The worker has been stopped. Try a smaller file.");},15000);
  try {
    const bytes=await file.arrayBuffer(); if(current!==generation) return;
    status.textContent="Loupe / loading engine and inspecting structure…";
    worker=new Worker(root.dataset.worker);
    worker.onerror=()=>fail("Loupe could not start. Reload and try again.");
    worker.onmessage=({data})=>{if(current!==generation)return;stop();root.removeAttribute("aria-busy");if(data.error){status.textContent=data.error;return;}render(data,file.name);status.textContent="Inspection complete. Binary bytes remained in this browser.";};
    worker.postMessage({bytes, runtime:root.dataset.runtime,wasm:root.dataset.wasm},[bytes]);
  } catch {fail("This file could not be read. Please select it again.");}
}
input.addEventListener("change",()=>inspect(input.files[0]));
clear.addEventListener("click",()=>{reset();status.textContent="Cleared. Select another PE file.";input.focus();});
for(const event of ["dragenter","dragover"]) drop.addEventListener(event,e=>{e.preventDefault();drop.classList.add("dragging");});
for(const event of ["dragleave","drop"]) drop.addEventListener(event,e=>{e.preventDefault();drop.classList.remove("dragging");});
drop.addEventListener("drop",e=>{if(e.dataTransfer.files.length!==1){reset();status.textContent="Choose one PE file at a time.";return;}inspect(e.dataTransfer.files[0]);});
window.addEventListener("pagehide",reset);
