"""
Genera el paquete SCORM 1.2 listo para subir a Moodle.

Uso (desde la carpeta del proyecto):
    python tools/empaquetar.py

Crea dist/ODC_DataDrivenManager_SCORM12.zip con el contenido de scorm/
(imsmanifest.xml en la raíz del ZIP) y avisa si el manifiesto menciona
archivos que no existen o si hay archivos que el manifiesto no lista.
"""
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'scorm')
DIST = os.path.join(ROOT, 'dist')
OUT = os.path.join(DIST, 'ODC_DataDrivenManager_SCORM12.zip')


def package_files():
    files = []
    for folder, _, names in os.walk(SRC):
        for name in names:
            if name.startswith('.'):  # .gitkeep y similares no van al paquete
                continue
            full = os.path.join(folder, name)
            files.append(os.path.relpath(full, SRC).replace(os.sep, '/'))
    return sorted(files)


def check_manifest(files):
    manifest = open(os.path.join(SRC, 'imsmanifest.xml'), encoding='utf-8').read()
    listed = set(re.findall(r'<file\s+href="([^"]+)"', manifest))
    missing = sorted(listed - set(files))
    unlisted = sorted(set(files) - listed - {'imsmanifest.xml'})
    for f in missing:
        print('  ERROR: el manifiesto lista un archivo que no existe:', f)
    for f in unlisted:
        print('  Aviso: archivo no listado en imsmanifest.xml:', f)
    return not missing


def main():
    files = package_files()
    if not check_manifest(files):
        sys.exit(1)
    os.makedirs(DIST, exist_ok=True)
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in files:
            z.write(os.path.join(SRC, f), f)
    print('Paquete creado: %s (%d archivos, %.0f KB)' % (os.path.relpath(OUT, ROOT), len(files), os.path.getsize(OUT) / 1024))


if __name__ == '__main__':
    main()
