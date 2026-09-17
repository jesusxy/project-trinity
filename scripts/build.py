#!/usr/bin/env python3
"""Build Loupe from the checked-in core, then build the static Hugo site."""
import datetime, hashlib, json, os, pathlib, shutil, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
os.chdir(ROOT)
def run(*args, **kwargs):
    return subprocess.check_output(args, text=True, **kwargs).strip()
core=ROOT/'lab/third_party/loupe/inspect/inspect.go'
provenance=json.loads((ROOT/'lab/third_party/loupe/PROVENANCE.json').read_text())
if hashlib.sha256(core.read_bytes()).hexdigest()!=provenance['core_sha256']:
    raise SystemExit('Loupe snapshot differs from provenance. Sync the shared core before building.')
env=dict(os.environ, GOCACHE=os.environ.get('GOCACHE','/tmp/trinity-go-cache'))
subprocess.run(['go','test','./...'],cwd=core.parent.parent,env=env,check=True)
subprocess.run(['go','vet','./...'],cwd=core.parent.parent,env=env,check=True)
generated=ROOT/'assets/generated'; generated.mkdir(exist_ok=True)
subprocess.run(['go','build','-trimpath','-ldflags=-s -w','-o',str(generated/'loupe.wasm'),'./cmd/wasm'],cwd=ROOT/'lab',env=dict(env,GOOS='js',GOARCH='wasm',CGO_ENABLED='0'),check=True)
goroot=pathlib.Path(run('go','env','GOROOT'))
shutil.copyfile(goroot/'lib/wasm/wasm_exec.js',generated/'wasm_exec.js')
commit=os.environ.get('GITHUB_SHA') or run('git','rev-parse','HEAD')
dirty=bool(run('git','status','--porcelain','--untracked-files=normal'))
metadata={'commit':commit,'dirty':dirty,'built_at':datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
if os.environ.get('GITHUB_RUN_ID'):
    metadata.update(run_id=os.environ['GITHUB_RUN_ID']+'.'+os.environ.get('GITHUB_RUN_ATTEMPT','1'),run_url=f"{os.environ.get('GITHUB_SERVER_URL','https://github.com')}/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}")
(ROOT/'data/build.json').write_text(json.dumps(metadata,indent=2)+'\n')
subprocess.run(['hugo','--minify','--cleanDestinationDir',*sys.argv[1:]],check=True)
