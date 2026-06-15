---
title: "loupe"
date: 2026-01-01
record_id: "PRJ-001"
record_class: "software"
status: "active"
description: "emulation-based malware deobfuscator and unpacker"
tags: ["go", "unicorn", "malware-analysis"]
specifications:
  - label: "language"
    value: "Go"
  - label: "engine"
    value: "Unicorn Engine"
  - label: "target"
    value: "Windows PE"
  - label: "method"
    value: "CPU emulation"
system_flow:
  - "PE input"
  - "parser"
  - "IAT patcher"
  - "emulation harness"
  - "unpacked output"
capabilities:
  - title: "inspect"
    detail: "Parse PE headers, sections, imports, and execution context before emulation."
  - title: "instrument"
    detail: "Patch imports and intercept behavior inside a controlled Unicorn Engine harness."
  - title: "recover"
    detail: "Observe execution and extract a cleaner artifact for further analysis."
current_phase: "Building the emulator scaffold and establishing reliable import-address-table patching."
next_step: "Run the first complete sample through the parse, patch, emulate, and recover pipeline."
links:
  - label: "source repository"
    url: "https://github.com/jesusxy/loupe"
---

Loupe is an emulation-based malware deobfuscator and unpacker. It is designed to let suspicious code reveal itself inside an instrumented environment without granting it control of a complete operating system.

The project is also a practical study of Portable Executable internals, low-level execution, and the boundary between static and dynamic malware analysis.
