"""Gera a planilha em planilha/ (exemplo da aula 12.2, bloco de concreto 19×39).
A planilha da validação da aula 12.3 (bloco cerâmico) saiu em 09/10 com o modo validação; a última versão está em
_trabalho/validacao_aula123/.
Uso: python tools/gerar.py   (Excel recalcula ao abrir: fullCalcOnLoad)"""
import os, subprocess, sys, tempfile
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
tmp = tempfile.mkdtemp(prefix='arrimo_')
base = os.path.join(tmp, 'base.xlsx')
subprocess.run([sys.executable, os.path.join(AQUI, 'build_new.py'), base], check=True)
out = os.path.join(RAIZ, 'planilha'); os.makedirs(out, exist_ok=True)
nome = 'Arrimo Alvenaria - base Carini.xlsx'
subprocess.run([sys.executable, os.path.join(AQUI, 'finalize.py'), base, os.path.join(out, nome)], check=True)
print('ok', nome)
