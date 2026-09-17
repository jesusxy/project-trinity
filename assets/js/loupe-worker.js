// One worker per inspection. No binary bytes are used in network requests.
self.onmessage = async ({ data }) => {
  try {
    importScripts(data.runtime);
    const go = new Go();
    const response = await fetch(data.wasm, { credentials: "omit" });
    if (!response.ok) throw new Error("Loupe could not load. Please try again.");
    const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), go.importObject);
    go.run(instance).catch(() => self.postMessage({ error: "Loupe stopped. Please try another file." }));
    const result = JSON.parse(self.loupeInspect(new Uint8Array(data.bytes)));
    self.postMessage(result);
  } catch { self.postMessage({ error: "Loupe could not inspect this file. Reload and try again." }); }
};
