"""Recalcula uma planilha com o Excel instalado (COM, pywin32) e devolve o caminho da cópia recalculada.
Uso: python tools/recalc_excel.py entrada.xlsx [pasta_saida]
Alternativa ao LibreOffice: nesta máquina só há o Excel, e é nele que o Jose abre a planilha — então é o oráculo
mais fiel. O recalc_lo.recalc() cai aqui sozinho quando o LibreOffice não está instalado."""
import os, shutil, sys, tempfile, threading

_trava = threading.Lock()   # um Excel por vez: o COM não gosta de duas instâncias brigando pelo mesmo perfil


def recalc(src, outdir=None):
    import pythoncom, win32com.client
    outdir = outdir or tempfile.mkdtemp(prefix='recalc_')
    os.makedirs(outdir, exist_ok=True)
    dst = os.path.abspath(os.path.join(outdir, os.path.basename(src)))
    if os.path.abspath(src) != dst:
        shutil.copyfile(src, dst)
    with _trava:
        pythoncom.CoInitialize()
        xl = win32com.client.DispatchEx('Excel.Application')   # instância própria: não mexe no Excel aberto do Jose
        xl.Visible = False; xl.DisplayAlerts = False; xl.ScreenUpdating = False
        try:
            wb = xl.Workbooks.Open(dst, UpdateLinks=0, ReadOnly=False)
            xl.CalculateFull()
            wb.Save(); wb.Close(SaveChanges=False)
        finally:
            xl.Quit(); pythoncom.CoUninitialize()
    return dst


if __name__ == '__main__':
    print(recalc(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None))
