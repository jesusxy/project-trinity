const root = document.querySelector("[data-loupe]");
const input = root.querySelector("input");
const drop = root.querySelector(".drop-zone");
const status = root.querySelector("[role=status]");
const output = root.querySelector("#inspection");
const clear = root.querySelector("[data-clear]");
let worker, timer, generation = 0;
const stop = () => { worker?.terminate(); worker = null; clearTimeout(timer); };
const reset = () => { ++generation; stop(); output.replaceChildren(); output.hidden = true; input.value = ""; clear.hidden = true; root.removeAttribute("aria-busy"); };
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if(cls) n.className=cls; return n; };
const hex = value => `0x${value.toString(16).toUpperCase()}`;
const field = (list, label, value) => { const pair=node("div"); pair.append(node("dt", label),node("dd",String(value))); list.append(pair); };
function render(result, name) {
  const heading=node("h2",name); heading.tabIndex=-1;
  output.append(node("p","INSPECTION / COMPLETE","eyebrow"),heading);
  const meta=node("dl",undefined,"inspection-meta");
  for (const [key,value] of [["Format",result.format],["Machine",result.machine],["File size",`${result.size.toLocaleString()} B`],["Image base",result.imageBase],["Entry RVA",result.entryRVA],["Preferred entry VA",result.entryVA],["Sections",result.sections.length],["Image size",`${result.imageSize.toLocaleString()} B`],["Headers",`${result.headerSize} B`],["Section alignment",hex(result.alignment)]]) field(meta,key,value);
  output.append(meta);
  const note=node("p","Addresses describe the file’s preferred layout; nothing has been mapped or executed. ");
  const reference=node("a","How file offsets and RVAs relate →");reference.href=root.dataset.research;note.append(reference);output.append(note);
  output.append(node("h3","Sections"),node("p","Select a section to inspect its declared layout and first 128 file bytes. Bar length shows raw size relative to the largest section.","muted"));
  const largest=Math.max(1,...result.sections.map(s=>s.rawSize));
  for (const section of result.sections) {
    const details=node("details",undefined,"section-detail");
    const summary=node("summary");
    summary.append(node("span",section.name || "(unnamed)","section-name"),node("span",section.permissions,"permissions"),node("span",`${section.rawSize.toLocaleString()} B`,"section-size"));
    const bar=node("span",undefined,"section-bar");bar.style.width=`${section.rawSize/largest*100}%`;bar.setAttribute("aria-hidden","true");summary.append(bar);
    const fields=node("dl",undefined,"inspection-meta");
    for(const [label,value] of [["Virtual address (RVA)",section.rva],["Virtual size",`${section.virtualSize.toLocaleString()} B`],["File offset",hex(section.offset)],["Raw size",`${section.rawSize.toLocaleString()} B`],["Declared permissions",section.permissions]]) field(fields,label,value);
    const preview=node("pre",section.preview ? section.preview.match(/(?:[0-9a-f]{2} ?){1,16}/g).join("\n") : "No file-backed bytes.","hex-preview");
    preview.tabIndex=0; preview.setAttribute("aria-label",`${section.name} hex preview`);
    details.append(summary,fields,node("p","File bytes / hexadecimal","eyebrow"),preview);output.append(details);
  }
  output.hidden=false; heading.focus();
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
