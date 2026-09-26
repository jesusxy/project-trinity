# Project Trinity

An independent experimental engineering studio, published as a static Hugo site.

## Build and preview

Requirements: Hugo **0.160.1 extended**, Go **1.24.2**, Python 3. No Node dependencies are needed to build or serve the site.

```sh
python3 scripts/build.py
python3 scripts/verify-site.py
hugo server --disableFastRender
```

Run the build script before the first Hugo preview. It resolves the pinned Loupe module, tests its inspection package, compiles the WASM adapter, copies the matching Go WASM runtime, writes real build metadata and the source excerpt, and runs Hugo. Go downloads dependencies on the first build and caches them for reuse; no sibling Loupe checkout is needed. Generated WASM, runtime, build metadata, source-excerpt data, and `public/` are ignored. After changing Go source or the pinned module version, rebuild; Hugo handles content, CSS and JavaScript edits directly. Preview build metadata describes the last scripted build.

## Structure

- `content/`: editorial pages and frontmatter. Existing `/projects/`, `/canon/`, `/now/`, and `/labs/` addresses remain.
- `themes/trinity/layouts/`: the original custom theme, refined in place.
- `layouts/research/`: revision-aware research template.
- `assets/css/style.css`: shared design tokens, layout, and responsive rules; processed by Hugo Pipes.
- `assets/js/`: page-scoped Lab and Work index controllers, plus the Lab worker. Other pages load no JavaScript.
- `lab/`: Go/WASM adapter with Loupe pinned in `go.mod` and checksums in `go.sum`.
- `scripts/`: reproducible build and generated-site checks.
- `tests/browser.cjs`: responsive and browser integration checks.

## Research records

```sh
hugo new content research/record-name.md
```

The archetype starts as a draft. Assign a unique `REC-` identifier, a substantive description and content, creation/revision dates, `revision`, `status`, and `revisions`. `related` accepts Hugo content paths such as `/projects/loupe`, `/research/pe-address-spaces`, or `/canon`. Relationships become links and backlinks at build time; unresolved targets fail the build. Increment the revision and append a real change note when the substance changes. New sections belong in navigation only when they contain complete, useful work.

## Loupe source ownership

Loupe owns `inspect/inspect.go`. It was extracted from Loupe's `cmd/main.go` at `9439f51fc84946046d6755c76cddeed58ba401e8`; the initial shared package and native CLI refactor were committed in Loupe as `e129f1551b1e54178957d027b08d892bcd2da2ad`. Both the native CLI and Trinity's WASM adapter import `github.com/jesusxy/loupe/inspect`.

Trinity consumes the upstream Go module at the immutable version recorded in `lab/go.mod`, with downloaded module contents verified against `lab/go.sum`. There is no checked-in copy of the parser, synchronization script, or companion patch. `scripts/build.py` tests the pinned inspection package and extracts the exact `EntryPointVA` assignment from that downloaded source into ignored `data/loupe_core.json`, alongside its module path and version. Hugo uses this generated data for the Loupe project's source excerpt. The native CLI's Unicorn dependency is outside the inspection package and WASM dependency graph.

File-size policy belongs to each interface. The browser UI and WASM adapter retain a 16 MiB limit. Loupe's native CLI preserves PE diagnostics, defaults to a 256 MiB input limit, and accepts `-max-file-size-mib N` followed by an optional PE file path. The shared parser retains structural validation without a universal file-size cap. The CLI still reads the bounded file into memory and proceeds into its existing emulator; a larger input budget is not an emulation-memory guarantee.

Change and publish the shared core in Loupe, then update Trinity's dependency to the desired commit or version:

```sh
(cd lab && go get github.com/jesusxy/loupe@'<commit-or-version>' && go mod tidy)
python3 scripts/build.py
```

Replace `<commit-or-version>` with a published commit hash or tag, review the `go.mod`/`go.sum` changes, and commit both files. This dependency arrangement changes source distribution only; parsing behavior and browser-local processing are unchanged.

## Tests

```sh
(cd lab && go test github.com/jesusxy/loupe/inspect && go vet github.com/jesusxy/loupe/inspect)
python3 scripts/verify-site.py
```

Optional fuzzing runs from a Loupe checkout, where the parser is owned. Go does not support fuzzing a dependency outside the main module. From that checkout, run:

```sh
go test ./inspect -fuzz=FuzzParse -fuzztime=15s
```

For browser checks, install `playwright@1.62.1` in a temporary directory and its Chromium runtime, serve `public/` on port 1415, and run:

```sh
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node tests/browser.cjs
```

Optional settings: `TRINITY_URL`, `CHROMIUM_PATH`, `TRINITY_QA`, and `LOUPE_FIXTURE` (a PE fixture to **statically inspect**, never execute). Synthetic test fixtures remain in test memory and are not published. Screenshots are ignored under `tests/results/`.

The browser suite also runs `tests/file-map.cjs`: it checks raw-offset geometry, headers, gaps, overlapping ranges, tiny and zero-byte sections, precise cursor offsets/RVAs, locked selection, visible measurements/bytes, keyboard exploration, and touch dragging. Set `LOUPE_RELEASE_FIXTURE`, `LOUPE_DEBUG_FIXTURE`, and `LOUPE_GO_FIXTURE` to the existing development binaries to repeat geometry checks and capture workspaces at 1440, 390, and 320 px. These files are read locally, never launched or committed.

## Deployment

GitHub Actions verifies pull requests and pushes to `master`. A push to `master` deploys the tested artifact with the existing GitHub Pages action and `project-trinity.io` CNAME. Hugo, Go, and browser test versions are pinned. No backend or upload endpoint exists.

See [implementation notes](docs/implementation.md) for the design rationale, security boundary, measured weight, and next steps.

## Visual authorship

The [design-system notes](docs/design-system.md) define the three typographic voices and the page-specific compositions. Preserve the common system while letting real work and references determine each page’s character.
