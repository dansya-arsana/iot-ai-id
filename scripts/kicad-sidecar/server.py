"""Tiny KiCad sidecar. POST /check (body: project zip, header X-Sidecar-Token) -> JSON {erc,drc,gerberZipBase64?,routed?}.
Query: ?gerber=1 adds gerber+drill zip; ?route=1 runs Freerouting if ENABLE_FREEROUTING=1 and FREEROUTING_JAR is set."""
import base64, http.server, io, json, os, shutil, subprocess, tempfile, zipfile
from urllib.parse import urlparse, parse_qs
MAX = 4_000_000
SECRET = os.environ.get('SIDECAR_TOKEN', '')
def run(cmd, cwd): return subprocess.run(cmd, cwd=cwd, capture_output=True, timeout=120)
def find(d, ext):
    for r, _, fs in os.walk(d):
        for f in fs:
            if f.endswith(ext): return os.path.join(r, f)
def report(path):
    try: return json.load(open(path))
    except Exception: return {'violations': [], 'unconnected_items': [], 'error': 'no report'}
def safe_extract(z, d):
    root = os.path.realpath(d)
    for n in z.namelist():
        t = os.path.realpath(os.path.join(d, n))
        if not t.startswith(root + os.sep) or n.startswith('/'): raise ValueError('bad path')
    z.extractall(d)
def zipdir(g):
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in sorted(os.listdir(g)): z.write(os.path.join(g, f), f)
    return b.getvalue()
class H(http.server.BaseHTTPRequestHandler):
    def reply(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header('content-type', 'application/json'); self.send_header('content-length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path == '/health': self.reply(200, {'ok': True})
        else: self.reply(404, {'error': 'not found'})
    def do_POST(self):
        u = urlparse(self.path); q = parse_qs(u.query)
        if u.path != '/check': return self.reply(404, {'error': 'not found'})
        if SECRET and self.headers.get('x-sidecar-token') != SECRET: return self.reply(401, {'error': 'unauthorized'})
        n = int(self.headers.get('content-length') or 0)
        if n <= 0 or n > MAX: return self.reply(413, {'error': 'size'})
        body = self.rfile.read(n); d = tempfile.mkdtemp()
        try:
            safe_extract(zipfile.ZipFile(io.BytesIO(body)), d)
            sch, pcb = find(d, '.kicad_sch'), find(d, '.kicad_pcb'); out = {}
            if sch: run(['kicad-cli', 'sch', 'erc', '--format', 'json', '--severity-all', '-o', d + '/erc.json', sch], d)
            out['erc'] = report(d + '/erc.json') if sch else {'violations': []}
            if pcb and q.get('route') == ['1'] and os.environ.get('ENABLE_FREEROUTING') == '1' and os.environ.get('FREEROUTING_JAR'):
                run(['kicad-cli', 'pcb', 'export', 'specctra', '-o', d + '/r.dsn', pcb], d)
                run(['java', '-jar', os.environ['FREEROUTING_JAR'], '-de', d + '/r.dsn', '-do', d + '/r.ses', '-mp', '20'], d); out['routed'] = os.path.exists(d + '/r.ses')
            if pcb: run(['kicad-cli', 'pcb', 'drc', '--format', 'json', '--severity-all', '--all-track-errors', '-o', d + '/drc.json', pcb], d)
            out['drc'] = report(d + '/drc.json') if pcb else {'violations': [], 'unconnected_items': []}
            if pcb and q.get('gerber') == ['1']:
                g = d + '/gerber'; os.makedirs(g)
                run(['kicad-cli', 'pcb', 'export', 'gerbers', '-o', g + '/', pcb], d); run(['kicad-cli', 'pcb', 'export', 'drill', '-o', g + '/', pcb], d)
                out['gerberZipBase64'] = base64.b64encode(zipdir(g)).decode()
            self.reply(200, out)
        except Exception as e: self.reply(400, {'error': str(e)[:200]})
        finally: shutil.rmtree(d, ignore_errors=True)
http.server.ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('PORT', '8787'))), H).serve_forever()
