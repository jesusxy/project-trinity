#!/usr/bin/env python3
"""Vendor the shared static package from an explicitly supplied Loupe checkout."""
import difflib,hashlib,json,pathlib,shutil,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[1]
source=pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)==2 else None
if not source or not (source/'inspect/inspect.go').exists():raise SystemExit('Usage: python3 scripts/sync-loupe.py /path/to/loupe (with extracted inspect package)')
if 'inspect.Parse(raw)' not in (source/'cmd/main.go').read_text():raise SystemExit('Loupe CLI must consume inspect.Parse before syncing.')
dest=root/'lab/third_party/loupe'
previous=json.loads((dest/'PROVENANCE.json').read_text())
baseline=previous['base_commit']
subprocess.run(['git','-C',str(source),'rev-parse','--verify',f'{baseline}^{{commit}}'],check=True,stdout=subprocess.DEVNULL)
commit=subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()
paths=['cmd/main.go','cmd/main_test.go','inspect/inspect.go','inspect/inspect_test.go']
dirty=bool(subprocess.check_output(['git','-C',str(source),'status','--porcelain','--',*paths],text=True).strip())
# Compare with the recorded baseline, including new, untracked native tests.
# A diff against HEAD alone would lose already committed shared-core changes.
patch=''
for name in paths:
    current=source/name
    original=subprocess.run(['git','-C',str(source),'show',f'{baseline}:{name}'],capture_output=True,text=True)
    if original.returncode and not current.exists():continue
    before=original.stdout.splitlines(keepends=True) if original.returncode==0 else []
    after=current.read_text().splitlines(keepends=True) if current.exists() else []
    patch+=''.join(difflib.unified_diff(before,after,fromfile=f'a/{name}' if original.returncode==0 else '/dev/null',tofile=f'b/{name}' if current.exists() else '/dev/null'))
for name in ['inspect.go','inspect_test.go']:shutil.copyfile(source/'inspect'/name,dest/'inspect'/name)
provenance={'repository':'https://github.com/jesusxy/loupe','base_commit':baseline,'source':'inspect/inspect.go (extracted from cmd/main.go)','source_commit':commit,'source_dirty':dirty,'core_sha256':hashlib.sha256((dest/'inspect/inspect.go').read_bytes()).hexdigest(),'note':'Shared inspection core with client-owned file-size budgets. source_commit identifies the checkout HEAD; source_dirty records local changes. Companion patch applies to base_commit.'}
(dest/'PROVENANCE.json').write_text(json.dumps(provenance,indent=2)+'\n')
(root/'lab/loupe-core.patch').write_text(patch)
print(f'Synced Loupe core from {commit[:8]}'+(' with local changes' if dirty else '')+f'; companion patch applies to {baseline[:8]}.')
