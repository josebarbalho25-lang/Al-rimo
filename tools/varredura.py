"""Varredura de erros: N cenários aleatórios de entrada, recalcula no LibreOffice e procura #DIV/0!, #VALOR! etc.
Uso: python tools/varredura.py [N=20] [semente=1]"""
import os, random, subprocess, sys, tempfile
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from cenarios import aplicar, sortear
from recalc_lo import recalc
import openpyxl
n = int(sys.argv[1]) if len(sys.argv) > 1 else 20
random.seed(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
tmp = tempfile.mkdtemp(prefix='varredura_')
base = os.path.join(tmp, 'base.xlsx'); subprocess.run([sys.executable, os.path.join(AQUI, 'build_new.py'), base], check=True)
ruins = {}
for k in range(n):
    sc = sortear(random)   # só valores aceitos pelas listas da planilha (cenarios.OPCOES + listas dependentes)
    arq = os.path.join(tmp, f'c{k}.xlsx'); aplicar(base, arq, sc)
    calc = recalc(arq, os.path.join(tmp, f'r{k}'))
    wb = openpyxl.load_workbook(calc, data_only=True); errs = []
    for ws in wb:
        for row in ws.iter_rows():
            for c in row:
                v = c.value
                if isinstance(v, str) and ((v.startswith('#') and any(e in v for e in ('DIV', 'VALUE', 'N/A', 'NUM', 'REF', 'NAME', 'NULL'))) or v.startswith('Err')):
                    errs.append((ws.title, c.coordinate, v))
    print(k, 'ok' if not errs else f'{len(errs)} erros {errs[:5]}')
    if errs: print('   ', sc)
    for e in errs: ruins[(e[0], e[1])] = ruins.get((e[0], e[1]), 0) + 1
print('células com erro:', sorted(ruins.items(), key=lambda x: -x[1])[:30] or 'nenhuma')
