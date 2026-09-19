#!/usr/bin/env python3
"""Loopback-only immutable CDN preview. Existing public assets retain exact SHA.

Only paths allowlisted by the assembled manifest can be read or proxied. Cached
upstream files are validated against SHA and byte count before serving.
"""
import argparse,hashlib,json,subprocess,threading
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
from statistics_artifacts import read_verified

def main():
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);p.add_argument('--port',type=int,default=5373);a=p.parse_args()
 ptr=json.load(open(a.root/'current.json'));manifest=read_verified(a.root/ptr['manifest']['path'],ptr['manifest']); assets={s['artifact']['path']:s['artifact'] for s in manifest['selectors']};assets[ptr['manifest']['path']]=ptr['manifest']
 assets.update({g['resource']:{'sha256':g['sha256'],'bytes':g['bytes']} for g in manifest['geometries']})
 locks={path:threading.Lock() for path in assets}
 manifest_lock=threading.Lock()
 class Handler(BaseHTTPRequestHandler):
  def end_headers(self):
   self.send_header('Access-Control-Allow-Origin','http://127.0.0.1:3761')
   super().end_headers()
  def do_GET(self):
   with manifest_lock:
    fresh_pointer=json.load(open(a.root/'current.json'))
    if fresh_pointer['manifest']['path'] not in assets:
     fresh=read_verified(a.root/fresh_pointer['manifest']['path'],fresh_pointer['manifest'])
     extra={s['artifact']['path']:s['artifact'] for s in fresh['selectors']}
     extra[fresh_pointer['manifest']['path']]=fresh_pointer['manifest']
     extra.update({g['resource']:{'sha256':g['sha256'],'bytes':g['bytes']} for g in fresh['geometries']})
     for key,value in extra.items():
      if key in assets and assets[key]!=value: raise ValueError('Immutable path collision')
      assets[key]=value
      locks.setdefault(key,threading.Lock())
   path=urlsplit(self.path).path.lstrip('/')
   if path=='current.json': data=(a.root/path).read_bytes()
   elif path not in assets: self.send_error(404);return
   else:
    try:
     with locks[path]:
      file=a.root/path
      if not file.exists():
       file=a.cache/path;file.parent.mkdir(parents=True,exist_ok=True)
       if not file.exists():
        tmp=file.with_suffix(file.suffix+'.download')
        subprocess.run(['curl','-fsSL','--retry','2','https://data.itsmigu.com/statistics/v1/'+path,'-o',str(tmp)],check=True)
        raw=tmp.read_bytes()
        if len(raw)!=assets[path]['bytes'] or hashlib.sha256(raw).hexdigest()!=assets[path]['sha256']:raise ValueError('upstream integrity mismatch')
        tmp.replace(file)
      data=file.read_bytes()
      if len(data)!=assets[path]['bytes'] or hashlib.sha256(data).hexdigest()!=assets[path]['sha256']: raise ValueError('artifact integrity mismatch')
    except Exception as e: print(type(e).__name__,str(e),flush=True);self.send_error(502);return
   self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-cache' if path=='current.json' else 'public, max-age=31536000, immutable');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
 ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
if __name__=='__main__':main()
