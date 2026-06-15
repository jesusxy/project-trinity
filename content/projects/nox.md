---
title: "nox"
date: 2025-01-01
record_id: "PRJ-002"
record_class: "software"
status: "complete"
description: "Go-based IDS with MITRE ATT&CK mapping"
tags: ["go", "ids", "detection", "mitre"]
specifications:
  - label: "language"
    value: "Go"
  - label: "system"
    value: "Network IDS"
  - label: "mapping"
    value: "MITRE ATT&CK"
  - label: "telemetry"
    value: "Prometheus / gRPC"
system_flow:
  - "network event"
  - "stateful rules"
  - "ATT&CK mapping"
  - "structured log"
  - "metrics output"
capabilities:
  - title: "detect"
    detail: "Evaluate network events against a stateful rules engine."
  - title: "contextualize"
    detail: "Map detections to MITRE ATT&CK techniques for a clearer operational picture."
  - title: "observe"
    detail: "Expose structured logs, Prometheus metrics, and gRPC interfaces."
current_phase: "Core implementation complete and retained as an archived proof of work."
next_step: "Revisit only when a new detection experiment requires the existing foundation."
links:
  - label: "source repository"
    url: "https://github.com/jesusxy/bit-by-bit/tree/master/nox"
---

Nox is an intrusion detection system built around a stateful rules engine and explicit MITRE ATT&CK mapping. It turns raw network activity into structured detection records that can be inspected, measured, and integrated with other systems.

The project explored how a focused security tool can remain understandable while still exposing useful operational telemetry.
