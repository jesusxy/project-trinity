const root = document.querySelector("[data-loupe]");
const input = root.querySelector("input");
const drop = root.querySelector(".drop-zone");
const status = root.querySelector("[role=status]");
const output = root.querySelector("#inspection");
const clear = root.querySelector("[data-clear]");
let worker, timer, generation = 0;
const stop = () => { worker?.terminate(); worker = null; clearTimeout(timer); };
const reset = () => { ++generation; stop(); output.replaceChildren(); output.hidden = true; input.value = ""; clear.hidden = true; clear.textContent = "Clear / cancel"; root.removeAttribute("aria-busy"); };
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if(cls) n.className=cls; return n; };
const hex = value => `0x${value.toString(16).toUpperCase()}`;
const field = (list, label, value, cls) => { const pair=node("div",undefined,cls); pair.append(node("dt", label),node("dd",String(value))); list.append(pair); };
// Section names only guide presentation; unknown names stay with the image sections.
const isToolchainSection = section => /^(?:\.(?:z?debug)(?:[._$]|$)|\.gnu_debug(?:link|altlink)$|\.gnu\.lto_|\.(?:stab|stabstr|comment|drectve|llvm_addrsig)$)/i.test(section.name);
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
  const heading=node("h2",name); heading.tabIndex=-1;
  output.append(node("p","INSPECTION / COMPLETE","eyebrow"),heading);
  const meta=node("dl",undefined,"inspection-meta inspection-summary");
  for (const [key,value] of [["Format",result.format],["Machine",result.machine],["Entry RVA",result.entryRVA],["Image base",result.imageBase],["Sections",result.sections.length]]) field(meta,key,value,"inspection-primary");
  for (const [key,value] of [["File size",`${result.size.toLocaleString()} B`],["Preferred entry VA",result.entryVA],["Image size",`${result.imageSize.toLocaleString()} B`],["Headers",`${result.headerSize} B`],["Section alignment",hex(result.alignment)]]) field(meta,key,value);
  output.append(meta);
  const note=node("p","Addresses describe the file’s preferred layout; nothing has been mapped or executed. ");
  const reference=node("a","How file offsets and RVAs relate →");reference.href=root.dataset.research;note.append(reference);output.append(note);
  output.append(node("h3","Sections"),node("p","Select a section to inspect its declared layout and first 128 file bytes. Bar length shows raw size relative to the largest section.","muted"));
  const largest=Math.max(1,...result.sections.map(s=>s.rawSize));
  const imageSections=[], toolchainSections=[];
  for (const section of result.sections) (isToolchainSection(section) ? toolchainSections : imageSections).push(section);
  const groups=toolchainSections.length ? [["Image / Runtime",imageSections],["Debug / Toolchain",toolchainSections]] : [[null,imageSections]];
  for (const [label,sections] of groups) {
    if (!sections.length) continue;
    const group=label ? node("section",undefined,"section-group") : output;
    if (label) {
      group.setAttribute("aria-label",label);
      group.append(node("h4",label,"eyebrow"));
      output.append(group);
    }
    for (const section of sections) {
      const details=node("details",undefined,"section-detail");
      const summary=node("summary");
      summary.append(node("span",section.name || "(unnamed)","section-name"),node("span",section.permissions,"permissions"),node("span",`${section.rawSize.toLocaleString()} B`,"section-size"));
      const bar=node("span",undefined,"section-bar");bar.style.width=`${section.rawSize/largest*100}%`;bar.setAttribute("aria-hidden","true");summary.append(bar);
      const fields=node("dl",undefined,"inspection-meta");
      for(const [label,value] of [["Virtual address (RVA)",section.rva],["Virtual size",`${section.virtualSize.toLocaleString()} B`],["File offset",hex(section.offset)],["Raw size",`${section.rawSize.toLocaleString()} B`],["Declared permissions",section.permissions]]) field(fields,label,value);
      details.append(summary,fields,node("p","File bytes / hexadecimal · ASCII","eyebrow"),hexPreview(section));group.append(details);
    }
  }
  clear.textContent="Clear file";
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
