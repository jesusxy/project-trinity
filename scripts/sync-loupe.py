#!/usr/bin/env python3
"""Vendor the shared static package from an explicitly supplied Loupe checkout."""
import hashlib,json,pathlib,shutil,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[1]
source=pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)==2 else None
if not source or not (source/'inspect/inspect.go').exists():raise SystemExit('Usage: python3 scripts/sync-loupe.py /path/to/loupe (with extracted inspect package)')
if 'inspect.Parse(raw)' not in (source/'cmd/main.go').read_text():raise SystemExit('Loupe CLI must consume inspect.Parse before syncing.')
dest=root/'lab/third_party/loupe'
for name in ['inspect.go','inspect_test.go']:shutil.copyfile(source/'inspect'/name,dest/'inspect'/name)
commit=subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()
provenance={'repository':'https://github.com/jesusxy/loupe','base_commit':commit,'source':'cmd/main.go: ImageInfo and parsePE','core_sha256':hashlib.sha256((dest/'inspect/inspect.go').read_bytes()).hexdigest(),'note':'Shared-core extraction plus hostile-input preflight. Local Loupe CLI updated in the companion patch; not an upstream release.'}
(dest/'PROVENANCE.json').write_text(json.dumps(provenance,indent=2)+'\n')
# Save the CLI refactor and new package as a reviewable, portable companion patch.
patch=subprocess.check_output(['git','-C',str(source),'diff','--','cmd/main.go'],text=True)
for name in ['inspect.go','inspect_test.go']:
 lines=(source/'inspect'/name).read_text().splitlines()
 patch+=f'diff --git a/inspect/{name} b/inspect/{name}\nnew file mode 100644\n--- /dev/null\n+++ b/inspect/{name}\n@@ -0,0 +1,{len(lines)} @@\n'+''.join('+'+line+'\n' for line in lines)
(root/'lab/loupe-core.patch').write_text(patch)
print(f'Synced Loupe core based on {commit[:8]}; companion patch saved.')
