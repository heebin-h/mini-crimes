# GitHub Pages 동작 모사: 없는 경로는 404 상태 + 404.html(=index.html) 본문. 정적 파일 서버(Node 아님).
import http.server, os, sys
root, port = sys.argv[1], int(sys.argv[2])
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=root, **k)
    def send_head(s):
        p = s.translate_path(s.path)
        if os.path.exists(p): return super().send_head()
        data = open(os.path.join(root, 'index.html'), 'rb').read()
        s.send_response(404); s.send_header('Content-Type', 'text/html; charset=utf-8'); s.send_header('Content-Length', str(len(data))); s.end_headers()
        import io; return io.BytesIO(data)
    def log_message(s, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
