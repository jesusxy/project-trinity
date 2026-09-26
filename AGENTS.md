# Project Trinity — agent guidance

These rules apply throughout the repository. Use this file as a map; keep detailed rationale and implementation guidance in the documents below.

## Documentation map

- [README.md](README.md): repository structure, build/preview commands, dependency updates, tests, and deployment workflow.
- [docs/design-system.md](docs/design-system.md): authored visual identity, semantic typography, page compositions, and visual boundaries.
- [docs/implementation.md](docs/implementation.md): architecture, engine integration, safety boundaries, and measurements, including [Lab runtime principles](docs/implementation.md#lab-runtime-principles) and [resource efficiency](docs/implementation.md#performance-and-resource-efficiency).
- [docs/work-specimens.md](docs/work-specimens.md): provenance and refresh procedures for the Work index's source-backed specimens.

## Non-negotiable principles

- **Engineering truth:** show real data, source-backed specimens, or clearly described architecture. Never invent telemetry, scans, events, execution state, or progress. Distinguish declared structure from observed behavior.
- **Static first:** preserve Hugo and build-time rendering. Prefer semantic HTML and CSS; add page-scoped JavaScript only for interaction or computation that needs it.
- **Resource efficiency:** treat client CPU, memory, GPU, network traffic, and startup cost as design constraints. Avoid unnecessary dependencies, repeated work, and idle or hidden activity.
- **Lazy instruments:** load engines and substantial experiment assets on relevant user activation. A small page controller may load earlier; unrelated navigation must not initialize a runtime.
- **Rendering complexity:** prefer HTML/CSS → SVG → Canvas → WebGL. Move to a more demanding renderer only when the data or interaction justifies it, retaining accessible controls and responsive behavior.
- **Engine ownership:** project engines own parsing and analysis semantics. Trinity Lab owns integration, interaction, and visualization; do not duplicate an engine's parser or analysis in the interface. Preserve each instrument's validation and safety boundaries.
- **Authored design:** follow the design-system guidance. Avoid generic SaaS dashboards, product-card grids, cybersecurity-console clichés, and decorative cyber effects. Density and motion must serve real content or state.
- **Focused changes:** preserve unrelated layouts, copy, routes, and behavior. Do not turn a scoped change into a broader redesign or refactor.

## Working and verification

Read the relevant documents before changing their area. Extend the existing document that owns a topic instead of creating a parallel guide; keep this file concise and avoid copying historical measurements or version pins into it.

Use the workflows in the README and verify at the scale of the change. Review responsive layout and real interactions for UI changes; use the existing build and inspection checks for engine integration changes. Inspect PE fixtures without executing them. For documentation-only changes, check references and consistency rather than rebuilding unrelated artifacts. Historical verification summaries are not test results for the current change.
