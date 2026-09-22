# Trinity evolution — implementation notes

## Original architecture and retained identity

Trinity was a small custom Hugo theme deployed to GitHub Pages. Content consisted of two projects (Loupe and Nox), Canon, a current-work note, and an empty Labs section. It had no frontend toolchain or test suite. Its visual identity used warm paper, cobalt blue, ink, large serif titles, technical numbering, and a personal footer.

Hugo, the custom theme, existing content URLs, project IDs, Nox's work, all seven Canon references, and every word in the footer remain. Old tag/category entry points redirect to the work index instead of becoming dead links. Stale generated pages are removed by the clean production build. Existing animation assets remain in source but no longer load on the homepage.

## Design decisions

- **Teenage Engineering:** confident object scale, a restrained palette, precise small labels, and an approachable instrument. No copied product styling or graphics.
- **Oxide:** actual software architecture becomes the central figure. The diagram reflects the shared parser and its native/browser consumers; there is no synthetic telemetry.
- **Palantir editorial/merch:** asymmetric type composition, large quiet spaces, compact identifiers, and deliberate changes in density. No borrowed branding or military framing.
- **Low-Tech Magazine:** the implementation follows the philosophy. Static HTML, system fonts, one small stylesheet, no site-wide JS, no analytics, and deferred local computation.

Removed the operator profile framing, generic active-status light, wallpaper grids, framing corners, dense administrative tables, and repeated visibility/classification labels. Monospace now chiefly labels technical values. Loupe's previous recovery claims were corrected to distinguish working static inspection from experimental native emulation and future unpacking goals.

## Content and navigation

Work → Research → Lab → Canon forms a small navigable system. Research records support IDs, created/revised dates, revision numbers, status, sources, revision history, related pages, and backlinks. Two initial records document the inspected code and the extraction performed here; their revision histories contain only the actual initial record. Canon remains a personal permanent reference set.

`/projects/loupe/` is PRJ-001's editorial surface: purpose, architecture, implementation and development limits. `/labs/` is LAB-001, a live interface **to PRJ-001**, not another project. The project links into the instrument; the instrument links back into the explanation and address-model research. A single complete instrument replaces the empty Labs directory. No placeholder experiments were introduced.

## Loupe integration

`ImageInfo` and the PE field extraction/architecture checks were extracted from the real adjacent Loupe checkout (`9439f51f`) into Loupe's `inspect` package. The native CLI now opens a bounded reader and calls `inspect.Parse`. Both consumers import `github.com/jesusxy/loupe/inspect`. A thin Go adapter compiles that same package for `GOOS=js GOARCH=wasm`; it only serializes the resulting image model and bounded byte previews. The inspection package and WASM dependency graph have no Unicorn dependency.

The initial shared package and native CLI refactor were committed in Loupe as `e129f1551b1e54178957d027b08d892bcd2da2ad`. Trinity initially checked in a source snapshot, but now consumes the upstream module at the immutable version pinned in `lab/go.mod`, with checksums in `lab/go.sum`. Builds resolve that dependency through Go's module cache without a sibling checkout. The copied parser, synchronization script, and companion patch have been removed. This changes dependency distribution only; the parser's code and behavior are unchanged. There is no separate JavaScript PE parser. Browser-specific code handles files, worker lifecycle, and rendering. During the initial extraction, native package tests and compilation passed locally with the installed Unicorn library; native emulation was not executed.

PE diagnostics remain in the native CLI. File-size budgets are interface policy: 256 MiB by default for the CLI, configurable with `-max-file-size-mib`, and 16 MiB for the browser. The CLI checks file size before reading and enforces the budget during reading. The core accepts already allocated bytes and keeps its structural checks. This does not change the native emulator's memory requirements or guarantee that it can emulate every larger file.

Supported: x86 PE32 and AMD64 PE32+, preferred base/entry addresses, image/header sizes, section alignment, section descriptors, declared permissions, and up to 128 preview bytes per section. Hexadecimal strings preserve 64-bit addresses across the Go/JavaScript boundary. Bars describe relative raw section sizes, not memory activity. Imports remain omitted because Loupe currently walks them through emulated memory.

### Hostile input boundary

- No execution, native loading, script evaluation, or user-supplied WebAssembly instantiation.
- 16 MiB file limit checked before browser reading and again in the Go/WASM adapter.
- Bounds checks for PE header, optional header, section table, raw extents, symbols, strings, and relocation ranges before `debug/pe` sees the bytes.
- 96 sections; 65,536 COFF symbols; 1 MiB string table; 4,096 relocation records per section; 256-byte section names. Checked address arithmetic and a parser panic boundary.
- A disposable worker per request with a 15-second deadline including startup, explicit cancel, and termination after success/error. Bytes are transferred to the worker; the retained result contains metadata and bounded previews.
- UI uses `textContent` for filenames, names, errors, and previews. No binary bytes enter a network request, persistent browser storage, or a URL. The site downloads its own engine assets only.
- Lab CSP restricts resources and connections to the same origin, disables object loading and form submission, and permits its own WASM engine. There is no upload endpoint, analytics or third-party script.

The underlying [Go PE reader is not hardened against adversarial input](https://pkg.go.dev/debug/pe). Validation and process bounds reduce exposure; successful fuzzing is not a formal proof of parser safety. This deliberately conservative reader can reject unusual valid files. Static results do not establish whether a binary is safe. Address terminology follows [Microsoft's PE specification](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format).

## Build information

`scripts/build.py` takes the source commit from `GITHUB_SHA` or local `git rev-parse HEAD`, checks the working tree for local changes, timestamps the actual build in UTC, and records GitHub run ID/attempt/link when available. Hugo renders this near the unchanged footer. No deployment time is claimed. Generated data is ignored and regenerated for every scripted build.

The build also tests and vets the pinned `github.com/jesusxy/loupe/inspect` package before compiling the WASM adapter. It writes the resolved module path, version, and exact `EntryPointVA` assignment from the downloaded `inspect/inspect.go` to ignored `data/loupe_core.json`. Hugo renders the source excerpt from that data, so the project page follows the same dependency as the Lab. The build fails if the assignment cannot be extracted as expected. Update the dependency in `lab/` with `go get github.com/jesusxy/loupe@<commit-or-version>` and `go mod tidy`, then rebuild and review both module files.

## Performance measurement

Measured from local minified production output; gzip numbers are estimates, not observed hosting transfer sizes.

| Asset | Uncompressed | gzip estimate |
| --- | ---: | ---: |
| Original homepage HTML + CSS + hero GIF | 4,829,937 B | GIF dominates |
| New homepage HTML + CSS | about 26 KB | about 7.2 KB |
| Lab controller | 4,490 B | 1,914 B |
| Worker | 537 B | 337 B |
| Go JS runtime | 8,122 B | 2,649 B |
| Loupe WASM | 3,099,193 B | 864,510 B |

There are no external fonts or frontend framework dependencies. Hugo minifies and fingerprints CSS/JS/WASM. Only the Lab loads its 4.5 KB controller. The worker, matching Go runtime, and WASM are fetched **after file selection**, not merely on Lab navigation. Browser checks verified zero WASM requests across all initial page visits. The large original GIF is no longer requested.

## Validation

- Hugo production build and generated-link/anchor/heading/footer/script-isolation checks.
- `go test github.com/jesusxy/loupe/inspect` and `go vet github.com/jesusxy/loupe/inspect` from `lab/` exercise the pinned shared core; adjacent Loupe CLI compilation/tests were also checked during extraction.
- About 1.27 million fuzz inputs over 15 seconds without a failure.
- 40 viewport/route checks: ten routes at 1440, 768, 390, and 320 px; no horizontal page overflow.
- Browser PE32 and PE32+ fixtures, actual existing Loupe fixture (read only), hostile section text, malformed/empty/oversize inputs, cancellation, engine failure/recovery, drag/drop, keyboard disclosure, the 15-second worker deadline, and no-JS fallback.
- Network inspection: same-origin GETs only, no request bodies; no local/session storage.
- Visual review of desktop/mobile home, project, Canon, research, initial Lab and result views; keyboard skip navigation, labeled file input, live status, native disclosure controls, visible focus, and reduced-motion support.

Browser verification used headless Brave/Chromium locally. CI uses Chromium. Safari/Firefox and manual screen-reader testing have not been performed.

## Strongest next steps

1. Add a bounded static import reader in Loupe, with corrupted descriptor/thunk fixtures and links into research.
2. Stabilize the native mapping/API model and define a versioned trace format before presenting real execution instrumentation.
