---
title: "Loupe"
date: 2025-01-01
weight: 1
record_id: "PRJ-001"
record_class: "software"
status: "active development"
description: "PE inspection and an experimental emulation environment"
tags: ["Go", "Unicorn", "PE / x86–64"]
lab: "/labs/"
related: ["/research/pe-address-spaces", "/research/static-inspection"]
specifications:
  - label: "language"
    value: "Go"
  - label: "native engine"
    value: "Unicorn"
  - label: "target"
    value: "x86 / x86-64 PE"
  - label: "browser"
    value: "Static inspection / WASM"
capabilities:
  - title: "Inspect"
    detail: "Read PE headers, preferred image addresses, and section descriptors. The shared Go core powers the native loader and the browser Lab."
  - title: "Map"
    detail: "The native CLI maps headers and selected sections into Unicorn memory. This is experimental loader code, not a complete Windows environment."
  - title: "Instrument"
    detail: "The native harness contains architecture-aware IAT patching and instruction, memory, and API hooks. These are development scaffolding; the Lab does not run them."
current_phase: "Static inspection is available in the browser. Native emulation remains experimental, with incomplete Windows API and process-environment behavior."
next_step: "Test the native loader and API stubs against controlled fixtures before exposing execution results. Reliable unpacked-output recovery is a future goal."
links:
  - label: "source repository"
    url: "https://github.com/jesusxy/loupe"
---

Loupe is an investigation into how a Windows executable is structured, loaded, and eventually observed. Its long-term aim is emulation-based deobfuscation and unpacking.

The current implementation starts with a Portable Executable parser and a Unicorn-based execution harness. It is also a practical study of the boundary between file bytes, virtual memory, and program behavior.

The browser Lab exposes one complete part of that work: **static inspection**. It uses Loupe’s shared image model to read a file’s structure without running it. No emulation, malware verdicts, or recovered payloads are implied by those results.
