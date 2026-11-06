"""
Servidor local para probar el curso con videos.

Uso (desde la carpeta del proyecto):
    python tools/servidor.py          # http://127.0.0.1:8765/probar-lms.html
    python tools/servidor.py 9000     # otro puerto

A diferencia de `python -m http.server`, responde a las peticiones por rangos
(Range: bytes=…), que el navegador necesita para adelantar, retroceder o
continuar un video desde un punto. Moodle ya lo hace; este servidor solo
reproduce ese comportamiento para las pruebas locales.
"""
import os
import re
import sys
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class RangeHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def send_head(self):
        rng = self.headers.get('Range')
        path = self.translate_path(self.path)
        m = re.match(r'bytes=(\d*)-(\d*)$', rng or '')
        if not m or os.path.isdir(path) or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        start = int(m.group(1)) if m.group(1) else max(0, size - int(m.group(2) or 0))
        end = int(m.group(2)) if m.group(1) and m.group(2) else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
            return None
        f = open(path, 'rb')
        f.seek(start)
        self.send_response(HTTPStatus.PARTIAL_CONTENT)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        self._remaining = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, '_remaining', None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        try:
            while remaining > 0:
                chunk = source.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass  # el navegador canceló la descarga al saltar a otro punto del video
        finally:
            self._remaining = None


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = partial(RangeHandler, directory=ROOT)
    server = ThreadingHTTPServer(('127.0.0.1', port), handler)
    print('Curso en http://127.0.0.1:%d/probar-lms.html  (Ctrl+C para detener)' % port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
