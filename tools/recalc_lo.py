"""Recalcula uma planilha com o LibreOffice (headless) e devolve o caminho da cópia recalculada.
Uso: python tools/recalc_lo.py entrada.xlsx [pasta_saida]
Precisa do LibreOffice instalado (Windows: C:\\Program Files\\LibreOffice\\program\\soffice.exe)."""
import os, shutil, subprocess, sys, tempfile

def soffice():
    for c in (shutil.which('soffice'), shutil.which('libreoffice'),
              r'C:\Program Files\LibreOffice\program\soffice.exe',
              r'C:\Program Files (x86)\LibreOffice\program\soffice.exe'):
        if c and os.path.exists(c):
            return c
    raise SystemExit('LibreOffice não encontrado. Instale (libreoffice.org) ou ajuste o caminho em tools/recalc_lo.py.')

def recalc(src, outdir=None):
    try:
        soffice()
    except SystemExit:
        # Sem LibreOffice: usa o Excel instalado (é o que o Jose usa para abrir a planilha).
        from recalc_excel import recalc as recalc_xl
        return recalc_xl(src, outdir)
    outdir = outdir or tempfile.mkdtemp(prefix='recalc_')
    prof = tempfile.mkdtemp(prefix='lo_prof_')
    url = 'file:///' + prof.replace('\\', '/').lstrip('/')
    subprocess.run([soffice(), f'-env:UserInstallation={url}', '--headless', '--convert-to', 'xlsx', '--outdir', outdir, src],
                   check=True, capture_output=True, timeout=300)
    return os.path.join(outdir, os.path.basename(src))

if __name__ == '__main__':
    print(recalc(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None))
