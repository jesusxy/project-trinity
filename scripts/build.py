#!/usr/bin/env python3
"""Build the pinned Loupe module for WASM, then build the static Hugo site."""
import datetime, json, os, pathlib, re, shutil, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
os.chdir(ROOT)
def run(*args, **kwargs):
    return subprocess.check_output(args, text=True, **kwargs).strip()
lab=ROOT/'lab'
module='github.com/jesusxy/loupe'
package=f'{module}/inspect'
env=dict(os.environ, GOCACHE=os.environ.get('GOCACHE','/tmp/trinity-go-cache'), GOWORK='off', CGO_ENABLED='0')
dependency=json.loads(run('go','list','-m','-mod=readonly','-json',module,cwd=lab,env=env))
if dependency.get('Replace') or not dependency.get('Version'):
    raise SystemExit('Pin a published Loupe module version in lab/go.mod; production builds do not use local replacements.')
download=json.loads(run('go','mod','download','-json',f'{module}@{dependency["Version"]}',cwd=lab,env=env))
core=pathlib.Path(download['Dir'])/'inspect/inspect.go'
subprocess.run(['go','test','-mod=readonly',package],cwd=lab,env=env,check=True)
subprocess.run(['go','vet','-mod=readonly',package],cwd=lab,env=env,check=True)
# Keep the displayed source excerpt tied to the same dependency as the WASM.
lines=re.findall(r'^\s*(imageInfo\.EntryPointVA = [^\n]+)$',core.read_text(),re.MULTILINE)
if len(lines)!=1:
    raise SystemExit('Loupe address artifact no longer matches the shared core; review the figure.')
excerpt={'module':module,'version':dependency['Version'],'entry_point_assignment':lines[0]}
(ROOT/'data/loupe_core.json').write_text(json.dumps(excerpt,indent=2)+'\n')
generated=ROOT/'assets/generated'; generated.mkdir(exist_ok=True)
subprocess.run(['go','build','-mod=readonly','-trimpath','-ldflags=-s -w','-o',str(generated/'loupe.wasm'),'./cmd/wasm'],cwd=lab,env=dict(env,GOOS='js',GOARCH='wasm'),check=True)
goroot=pathlib.Path(run('go','env','GOROOT',cwd=lab,env=env))
shutil.copyfile(goroot/'lib/wasm/wasm_exec.js',generated/'wasm_exec.js')
commit=os.environ.get('GITHUB_SHA') or run('git','rev-parse','HEAD')
dirty=bool(run('git','status','--porcelain','--untracked-files=normal'))
metadata={'commit':commit,'dirty':dirty,'built_at':datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
if os.environ.get('GITHUB_RUN_ID'):
    metadata.update(run_id=os.environ['GITHUB_RUN_ID']+'.'+os.environ.get('GITHUB_RUN_ATTEMPT','1'),run_url=f"{os.environ.get('GITHUB_SERVER_URL','https://github.com')}/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}")
(ROOT/'data/build.json').write_text(json.dumps(metadata,indent=2)+'\n')
subprocess.run(['hugo','--minify','--cleanDestinationDir',*sys.argv[1:]],check=True)
