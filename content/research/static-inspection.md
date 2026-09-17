---
title: "The static inspection boundary"
date: 2026-09-17
lastmod: 2026-09-17
record_id: "REC-002"
record_class: "research"
status: "active notes"
revision: 1
description: "Separating a PE image model from the machinery that executes it."
related: ["/projects/loupe", "/research/pe-address-spaces", "/canon"]
revisions:
  - revision: 1
    date: "2026-09-17"
    note: "Recorded the shared-core extraction and browser resource limits."
---

## The boundary in the implementation

Loupe originally read a file, built an `ImageInfo`, and then used that model to configure Unicorn. The parser used Go’s `debug/pe`; the execution harness used native Unicorn bindings. Those responsibilities shared one executable but did not need to share a runtime.

The extracted `loupe/inspect` package accepts a byte slice and returns that same image model. The native CLI can pass it to its loader. Trinity compiles the package with a small WebAssembly adapter and renders the returned structure in the browser.

The browser adapter serializes addresses as hexadecimal strings. This preserves 64-bit address values without passing them through JavaScript’s floating-point number representation.

## Reading is not executing

A browser worker receives the selected file’s bytes and calls the static core. It does not contain Unicorn, import patching, or any route from those bytes to executable code. The only WebAssembly module instantiated is Trinity’s built Loupe engine.

The interface reports structure, not a safety verdict. A successfully parsed executable can still be malicious. A rejected file can simply be unsupported or unusual.

## Resource limits are part of the interface

Go explicitly documents that `debug/pe` is not hardened for adversarial input. Loupe therefore validates ranges and allocation-driving counts before calling it, catches parser panics, and runs the browser operation inside a worker that can be terminated.

The current boundary limits files to **16 MiB**, sections to **96**, COFF symbols to **65,536**, string tables to **1 MiB**, relocation records to **4,096 per section**, and section names to **256 bytes**. The browser stops an inspection after **15 seconds**, including engine loading. These are defensive product limits, not claims about what every valid PE file must contain.

The UI previews at most 128 file bytes per section. After a result or error, it terminates the worker. Clearing the result removes the displayed metadata and previews. No binary is written to persistent browser storage or included in a network request. Engine assets are downloaded when a file is selected.

## What remains outside

Import walking in the native harness reads emulated memory and patches the IAT. It is not a pure static API today. The Lab therefore does not present imported functions, runtime traces, or recovered payloads.

A future static import reader belongs in Loupe’s shared core with malformed-input tests. It should not be a second parser hidden in the website.

## References

- [Go `debug/pe` documentation and security caveat](https://pkg.go.dev/debug/pe).
- [Go’s WebAssembly documentation](https://go.dev/wiki/WebAssembly).
- [Loupe source at the extraction baseline](https://github.com/jesusxy/loupe/blob/9439f51fc84946046d6755c76cddeed58ba401e8/cmd/main.go).

The relationship to [Canon]({{< relref "/canon" >}}) is a matter of standards: making the implementation answer to the claims made about it.
