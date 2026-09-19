# Trinity: system and authorship

Keep the off-white / cobalt / ink palette, static Hugo architecture, current navigation, revisable research, local Loupe Lab, and personal footer. The common system makes the site legible; each page's material determines its composition.

## Three semantic voices

| Voice | CSS token | Use |
| --- | --- | --- |
| Mono / system truth | `--type-system` | IDs, dates, revisions, source hashes, state, code, addresses, sizes, technical labels |
| Sans / functional communication | `--type-interface` | Navigation, controls, explanations, ordinary prose, Lab UI |
| Serif / ideas and identity | `--type-editorial` | Trinity's identity, editorial titles, quotations, culture, faith, personal statements |

These are local system-font stacks, not additional font downloads. Choose the voice by meaning, then tune scale and spacing. An explanation next to a code fragment stays sans; it does not become monospace simply because the subject is technical. Serif should mark a human or editorial moment rather than become the default body face.

The footer is the clearest expression: compact system metadata above, religious identity and the unchanged personal quotation below. Its quotation uses an upright, larger serif with a narrower measure and stronger separation. Preserve the exact copy.

## Where the composition departs

- **Homepage:** the existing hero remains. Selected work becomes “Being built,” research begins with an address question, and Canon includes an actual reference rather than only a section label. First-person copy makes the authorship visible.
- **Work index:** the title sits off the left rail; the second project is deliberately inset. Keep IDs and states readable rather than turning the index into a set of product cards.
- **Loupe:** an oversized address expression leads into an exact source excerpt. Hugo reads `EntryPointVA` assignment from `lab/third_party/loupe/inspect/inspect.go`; the build fails if that excerpt needs review. The shared-core architecture and Lab link remain.
- **Nox:** the dominant figure follows `Engine.EvaluateEvent` in `nox/internal/rules/engine.go` at `21253c44f7f000078517def21c42bf123fd250f4`: YAML evaluation, stateful evaluation, correlation evaluation, returned alerts. The diagram describes source structure, not a captured run. Its ink panel gives the work a different character without adding another color.
- **Research:** the revision is legible in the margin beside the reading column. Long-form text, sources, metadata, and revision history retain their existing structure.
- **Canon:** an associative reference wall with unequal scale and explicitly placed references. The street quotation leads; the smaller Unix paper is offset against the da Vinci standard; the two manifestos have different weights; the Margiela film uses a sparse title and vertical metadata; the faith reference closes the wall. The original seven references, links, sources, and titles remain unchanged. DOM order remains the original reference order; small screens use a single reading sequence with modest indents.
- **Lab:** preserve the instrument. Its file interaction, parsing, worker, and result behavior are unchanged. Shared typography and footer refinements apply; new density should come from real data.

## Boundaries

No synthetic artifacts, decorative telemetry, screenshots made to resemble real output, terminal framing, glitch effects, random ornament, added motion, or additional colors. Do not add image-shaped placeholders when a reference has no image. A quotation, title, code fragment, or actual architecture can carry the composition.

New references should receive an intentional treatment that fits their nature. Canon's neutral `.reference` typography is the fallback, while the current `REF-*` placements are deliberately authored for the existing set. Retain meaningful source order and make additions usable at narrow widths.

## Verification for this pass

The production build, internal link checks, 40 route/viewport combinations (1440, 768, 390, 320 px), and existing Loupe functional suite passed. Desktop and mobile screenshots were reviewed for the homepage, Canon, Work, Nox, Loupe, and research. Canon source content, the footer template, routing configuration, and Lab JavaScript were compared byte-for-byte with the preceding commit and remain unchanged.

No JavaScript or font assets were added. Minified CSS grew from 20,466 to 32,211 bytes; estimated gzip size grew from 4,844 to 6,936 bytes. These are local asset measurements, not hosting transfer measurements.
