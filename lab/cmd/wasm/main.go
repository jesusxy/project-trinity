//go:build js && wasm

package main

import (
	"encoding/json"
	"fmt"
	"loupe/inspect"
	"syscall/js"
)

func hex(n uint64) string { return fmt.Sprintf("0x%X", n) }
func main() {
	handler := js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) != 1 || args[0].Get("byteLength").Int() > inspect.MaxFileSize {
			return `{"error":"file exceeds 16 MiB limit"}`
		}
		raw := make([]byte, args[0].Get("byteLength").Int())
		js.CopyBytesToGo(raw, args[0])
		info, err := inspect.Parse(raw)
		if err != nil {
			b, _ := json.Marshal(map[string]string{"error": err.Error()})
			return string(b)
		}
		sections := make([]map[string]any, 0, len(info.Sections))
		for _, s := range info.Sections {
			permissions := ""
			for _, p := range []struct {
				flag  uint32
				label string
			}{{0x40000000, "R"}, {0x80000000, "W"}, {0x20000000, "X"}} {
				if s.Characteristics&p.flag != 0 {
					permissions += p.label
				} else {
					permissions += "—"
				}
			}
			preview := []byte{}
			if s.Offset != 0 && s.Size != 0 {
				n := min(s.Size, 128)
				preview = raw[s.Offset : s.Offset+n]
			}
			sections = append(sections, map[string]any{"name": s.Name, "rva": hex(uint64(s.VirtualAddress)), "virtualSize": s.VirtualSize, "offset": s.Offset, "rawSize": s.Size, "permissions": permissions, "preview": fmt.Sprintf("% x", preview)})
		}
		format, machine := "PE32", "I386"
		if info.Magic == 0x20b {
			format, machine = "PE32+", "AMD64"
		}
		out := map[string]any{"format": format, "machine": machine, "size": len(raw), "imageBase": hex(info.ImageBase), "entryRVA": hex(uint64(info.EntryPointRVA)), "entryVA": hex(info.EntryPointVA), "imageSize": info.SizeOfImage, "headerSize": info.SizeOfHeaders, "alignment": info.SectionAlignment, "sections": sections}
		b, _ := json.Marshal(out)
		return string(b)
	})
	js.Global().Set("loupeInspect", handler)
	select {}
}
