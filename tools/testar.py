"""Teste de regressão: reconstrói a planilha, recalcula no LibreOffice (ou no Excel) e confere
(1) os valores do professor na aula 12.2 (tolerância indicada) e (2) que nada mudou em relação à última versão validada
(dados/referencia_regressao.json, tolerância 1e-6) — na base (aula 12.2) e no cenário VAL123 (contrafortes em concreto
com a geometria da aula 12.3).

A aula 12.3 não é mais conferida contra o professor: ela era em bloco cerâmico (modo validação), que saiu da planilha
em 09/10 (decisão do Jose). A conferência ficou registrada no CLAUDE.md (seção Validação) e as planilhas daquela
validação estão em _trabalho/validacao_aula123/. O VAL123 de hoje é regressão: protege contra mudança sem querer.

Uso: python tools/testar.py              confere
     python tools/testar.py --atualizar  regrava a regressão do VAL123 (só quando a mudança é de propósito — e
                                         dizer ao Jose o que mudou e por quê). A base (aula 12.2) não se regrava aqui."""
import json, os, subprocess, sys, tempfile
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
from cenarios import AULA_122_ENTRADAS, VAL123, aplicar, ler
from recalc_lo import recalc

# valores do professor: nome -> (valor da aula, tolerância relativa)
AULA_122 = {'Mr_': (42.45, 0.002), 'Ieq_': (2687, 0.002), 'heq_': (9.3, 0.01), 'III_': (2600, 0.002), 'Im_': (20163, 0.001),
            'Ma_': (248.8, 0.002), 'Em_': (8889, 0.001), 'dadm_': (12.8, 0.001), 'beta_f': (0.118, 0.001),
            'Mpar': (0.262, 0.005), 'Mnor': (0.131, 0.005)}

REF = os.path.join(RAIZ, 'dados', 'referencia_regressao.json')
ref = json.load(open(REF, encoding='utf8'))
atualizar = '--atualizar' in sys.argv
tmp = tempfile.mkdtemp(prefix='teste_')
gerada = os.path.join(tmp, 'gerada.xlsx'); subprocess.run([sys.executable, os.path.join(AQUI, 'build_new.py'), gerada], check=True)
# A aula 12.2 não soma σsg e usa peso de parede 3,0 kN/m²; o padrão da planilha passou a somar e a calcular o peso
# (Jose, 12/10). A base confere a aula com esses dois de volta ao que o professor usou.
base = os.path.join(tmp, 'base.xlsx'); aplicar(gerada, base, AULA_122_ENTRADAS)
val = os.path.join(tmp, 'val.xlsx'); aplicar(gerada, val, VAL123)
falhas = 0
for nome_caso, arq, aula, refc in (('12.2', base, AULA_122, ref['base']), ('VAL123', val, {}, ref['val123'])):
    calc = recalc(arq, os.path.join(tmp, 'rc_' + nome_caso))
    got = ler(calc, sorted(set(aula) | set(refc)))
    for n, (v, tol) in aula.items():
        ok = isinstance(got[n], (int, float)) and abs(got[n] - v) <= tol * max(1, abs(v)) + 1e-9
        if not ok: falhas += 1
        print(f'[{nome_caso}] aula   {n:10s} {got[n]!s:>22} x {v:<10} {"ok" if ok else "FALHOU"}')
    if atualizar and nome_caso == 'VAL123':
        ref['val123'] = {n: got[n] for n in sorted(refc)}
        json.dump(ref, open(REF, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
        print(f'[{nome_caso}] regressão regravada: {len(refc)} valores em {REF}')
        refc = {}
    for n, v in refc.items():
        ok = got[n] == v if not isinstance(v, (int, float)) else isinstance(got[n], (int, float)) and abs(got[n] - v) <= 1e-6 * max(1, abs(v))
        if not ok:
            falhas += 1; print(f'[{nome_caso}] mudou  {n:10s} {got[n]!s:>22} (antes {v})')
    errs = []
    import openpyxl
    wb = openpyxl.load_workbook(calc, data_only=True)
    for ws in wb:
        for row in ws.iter_rows():
            for c in row:
                if isinstance(c.value, str) and c.value.startswith('#') and any(e in c.value for e in ('DIV', 'VALUE', 'N/A', 'NUM', 'REF', 'NAME')):
                    errs.append(f'{ws.title}!{c.coordinate}')
    if errs: falhas += len(errs); print(f'[{nome_caso}] erros de fórmula:', errs[:10])
print('\nRESULTADO:', 'TUDO OK' if falhas == 0 else f'{falhas} problema(s)')
sys.exit(1 if falhas else 0)
