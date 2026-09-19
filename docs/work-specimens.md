# Work preview specimens

These source-backed specimens belong only to the Work index. The homepage and
project-page architecture figures are unchanged. The preview controller is also
unchanged; Hugo renders the specimen data into static HTML.

## Loupe: a section descriptor

`data/work/loupe.json` is a snapshot returned by the existing shared
`loupe/inspect.Parse` package after reading Loupe's `testdata/test.exe`. The
fixture was inspected, never executed. It is the same existing fixture used in
Trinity's earlier Lab verification.

The snapshot records the fixture's source commit and SHA-256, plus the shared
parser's commit and SHA-256. The binary itself is not copied into Trinity or
downloaded by the Work page.

The preview selects `.text`, the first of the fixture's 18 sections:

- File offset: `0x0600`; image RVA: `0x1000`.
- Raw size: 6,656 bytes; virtual size: 6,224 bytes.
- Preferred image base: `0x140000000`.

The bars use the two actual section sizes on one common linear scale. They
describe header-declared sizes, not execution or observed memory activity.
The RVA is relative to the image base; the file offset locates bytes
on disk. This specimen deliberately focuses on one section, rather than repeating
the project page's architecture or entry-address figure.

To refresh the snapshot, inspect the source fixture with the shared Go parser,
replace the recorded image fields and source hashes together, and verify the
chosen section and architecture labels. A routine site build does not mutate
this pinned specimen.

## Nox: a rule consumed by the engine

`data/work/nox.yaml` contains the exact first rule from
`nox/detections/rules.yaml` at commit
`21253c44f7f000078517def21c42bf123fd250f4`, with separate source metadata.

`Engine.EvaluateEvent` checks the `Process_Executed` event type and calls
`EvaluateYAMLRule`. This rule requires `metadata.process_name` to equal `nmap`.
On a match, the engine copies its configured `T1046` technique ID and `MEDIUM`
severity into the alert. The preview represents that rule definition and
conditional output, not a captured event or a running detector.

Refresh this specimen from the pinned rule and its evaluation code together;
keep the source link, predicate, and alert fields consistent.
