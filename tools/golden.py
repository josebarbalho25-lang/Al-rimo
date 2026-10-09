"""Gabarito do motor do app: roda a planilha (Excel) em vários cenários e guarda, para cada um, as entradas,
o valor de TODO nome definido e de TODA célula com fórmula. O motor TypeScript do app é conferido contra isto
(app/src/motor/*.test.ts) — a planilha é a referência auditada; o app tem de bater com ela número a número.

Cenários: 'aula122' (padrão do gerador), 'aula123' (VAL123: contrafortes em concreto com a geometria da aula
12.3 — o nome do arquivo ficou) e N sorteados com o mesmo sorteio da varredura (cenarios.sortear).
Uso: python tools/golden.py [N=40] [semente=7]   →  dados/golden/<cenario>.json"""
import json, os, random, subprocess, sys, tempfile
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
from cenarios import VAL123, aplicar, sortear
from recalc_lo import recalc
import openpyxl

N = int(sys.argv[1]) if len(sys.argv) > 1 else 40
random.seed(int(sys.argv[2]) if len(sys.argv) > 2 else 7)
SAIDA = os.path.join(RAIZ, 'dados', 'golden'); os.makedirs(SAIDA, exist_ok=True)

# mesmo sorteio da varredura.py (lá ele procura erro; aqui vira gabarito): cenarios.sortear, só valores das listas

tmp = tempfile.mkdtemp(prefix='golden_')
base = os.path.join(tmp, 'base.xlsx')
subprocess.run([sys.executable, os.path.join(AQUI, 'build_new.py'), base], check=True, capture_output=True)
wbf = openpyxl.load_workbook(base)
formulas = [(ws.title, c.coordinate) for ws in wbf for row in ws.iter_rows() for c in row
            if isinstance(c.value, str) and c.value.startswith('=')]
nomes = {nm: list(dn.destinations)[0] for nm, dn in wbf.defined_names.items()}
entradas = {nm for nm, (sh, ref) in nomes.items()
            if sh == 'Entradas' and ':' not in ref and (wbf[sh][ref.replace('$', '')].fill.fgColor.rgb or '').endswith('FFF2CC')}


def ler_ref(ws, ref):
    # nome que aponta para INTERVALO (listas de validação, tabelas) vira lista de valores
    alvo = ws[ref.replace('$', '')]
    if isinstance(alvo, tuple):
        return [[c.value for c in linha] if isinstance(linha, tuple) else linha.value for linha in alvo]
    return alvo.value


def limpo(v):
    if isinstance(v, float) and v == int(v) and abs(v) < 1e15:
        return v   # mantém float: o teste compara com tolerância
    return v


cenarios = [('aula122', {}), ('aula123', dict(VAL123))]
for k in range(N):
    sc = sortear(random)
    cenarios.append((f'sorteio{k:02d}', sc))

for nome, sc in cenarios:
    arq = os.path.join(tmp, f'{nome}.xlsx')
    aplicar(base, arq, sc) if sc else __import__('shutil').copyfile(base, arq)
    calc = recalc(arq, os.path.join(tmp, 'rc_' + nome))
    wb = openpyxl.load_workbook(calc, data_only=True)
    val_nomes = {nm: limpo(ler_ref(wb[sh], ref)) for nm, (sh, ref) in nomes.items()}
    val_cel = {f'{sh}!{ref}': limpo(wb[sh][ref].value) for sh, ref in formulas}
    ent = {nm: val_nomes[nm] for nm in sorted(entradas)}
    json.dump({'cenario': nome, 'alterado': sc, 'entradas': ent, 'nomes': val_nomes, 'celulas': val_cel},
              open(os.path.join(SAIDA, f'{nome}.json'), 'w', encoding='utf8'), ensure_ascii=False, default=str)
    print('ok', nome, flush=True)
print('gabarito em', SAIDA)
