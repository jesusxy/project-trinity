# Project Trinity

An independent experimental engineering studio, published as a static Hugo site.

## Build and preview

Requirements: Hugo **0.160.1 extended**, Go **1.24.2**, Python 3. No Node dependencies are needed to build or serve the site.

```sh
python3 scripts/build.py
python3 scripts/verify-site.py
hugo server --disableFastRender
```

Run the build script before the first Hugo preview. It tests and compiles Loupe, copies the matching Go WASM runtime, writes real build metadata, and runs Hugo. Generated WASM, runtime, build metadata, and `public/` are ignored. After changing Go source, rebuild; Hugo handles content, CSS and JavaScript edits directly. Preview build metadata describes the last scripted build.

## Structure

- `content/`: editorial pages and frontmatter. Existing `/projects/`, `/canon/`, `/now/`, and `/labs/` addresses remain.
- `themes/trinity/layouts/`: the original custom theme, refined in place.
- `layouts/research/`: revision-aware research template.
- `assets/css/style.css`: shared design tokens, layout, and responsive rules; processed by Hugo Pipes.
- `assets/js/`: Lab controller and worker only. Other pages load no JavaScript.
- `lab/`: Go/WASM adapter and a portable snapshot of Loupe's shared inspection package.
- `scripts/`: reproducible build, core synchronization, and generated-site checks.
- `tests/browser.cjs`: responsive and browser integration checks.

## Research records

```sh
hugo new content research/record-name.md
```

The archetype starts as a draft. Assign a unique `REC-` identifier, a substantive description and content, creation/revision dates, `revision`, `status`, and `revisions`. `related` accepts Hugo content paths such as `/projects/loupe`, `/research/pe-address-spaces`, or `/canon`. Relationships become links and backlinks at build time; unresolved targets fail the build. Increment the revision and append a real change note when the substance changes. New sections belong in navigation only when they contain complete, useful work.

## Loupe source ownership

Loupe owns `inspect/inspect.go`. It was extracted from Loupe's `cmd/main.go` at `9439f51fc84946046d6755c76cddeed58ba401e8`; the adjacent local Loupe CLI consumes it in local commit `e129f1551b1e54178957d027b08d892bcd2da2ad`. The package has **not** been published as an upstream release.

Trinity checks in an identical source snapshot under `lab/third_party/loupe` so its deployment does not depend on an unpublished module or a sibling checkout. `PROVENANCE.json` records the extraction baseline, source checkout commit, whether the snapshot includes local changes, and exact core SHA-256; `scripts/build.py` rejects drift from that recorded hash. `lab/loupe-core.patch` contains the companion Loupe change for review or application to the baseline checkout. Do not apply it to the already updated local checkout.

File-size policy belongs to each interface. The browser UI and WASM adapter retain a 16 MiB limit. Loupe's native CLI preserves PE diagnostics, defaults to a 256 MiB input limit, and accepts `-max-file-size-mib N` followed by an optional PE file path. The shared parser retains structural validation without a universal file-size cap. The CLI still reads the bounded file into memory and proceeds into its existing emulator; a larger input budget is not an emulation-memory guarantee.

Change the shared core in Loupe, then sync it:

```sh
python3 scripts/sync-loupe.py ../loupe
python3 scripts/build.py
```

The sync script requires the native CLI to consume the shared package and refreshes the source, tests, provenance, and companion patch. Move to a versioned upstream module after the Loupe change is published and released.

## Tests

```sh
(cd lab/third_party/loupe && go test ./... && go vet ./...)
(cd lab/third_party/loupe && go test ./inspect -fuzz=FuzzParse -fuzztime=15s)
python3 scripts/verify-site.py
```

For browser checks, install `playwright@1.62.1` in a temporary directory and its Chromium runtime, serve `public/` on port 1415, and run:

```sh
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node tests/browser.cjs
```

Optional settings: `TRINITY_URL`, `CHROMIUM_PATH`, `TRINITY_QA`, and `LOUPE_FIXTURE` (a PE fixture to **statically inspect**, never execute). Synthetic test fixtures remain in test memory and are not published. Screenshots are ignored under `tests/results/`.

## Deployment

GitHub Actions verifies pull requests and pushes to `master`. A push to `master` deploys the tested artifact with the existing GitHub Pages action and `project-trinity.io` CNAME. Hugo, Go, and browser test versions are pinned. No backend or upload endpoint exists.

See [implementation notes](docs/implementation.md) for the design rationale, security boundary, measured weight, and next steps.

## Visual authorship

The [design-system notes](docs/design-system.md) define the three typographic voices and the page-specific compositions. Preserve the common system while letting real work and references determine each page’s character.
