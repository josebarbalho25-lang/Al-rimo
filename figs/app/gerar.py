# Gera as figuras do app (app/public/figuras/figNN.svg) a partir dos fNN_*.py desta pasta.
#
#   cd figs/app && python gerar.py            → todas
#   python gerar.py 1 12 16                   → só essas
#
# Não precisa de navegador: o recorte do viewBox sai da caixa acumulada pela applib. As figuras da planilha
# (figs/figNN_*.py, render.py, make_pdf.py) não são tocadas — o app tem a sua variante, a planilha a dela.
import importlib
import json
import os
import sys

sys.dont_write_bytecode = True      # não deixar __pycache__ na pasta das figuras
AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.normpath(os.path.join(AQUI, '..', '..', 'app', 'public', 'figuras'))
# A caixa do desenho de cada figura (o data-desenho do SVG), para a memória de cálculo mostrar a figura recortada
# sem abrir o arquivo: um JSON que o app importa. Gerar só algumas figuras atualiza só as caixas delas.
RECORTES = os.path.normpath(os.path.join(AQUI, '..', '..', 'app', 'src', 'figuras', 'recortes.gerado.json'))
sys.path.insert(0, AQUI)


def modulos():
    for nome in sorted(os.listdir(AQUI)):
        if nome.startswith('f') and nome[1:3].isdigit() and nome.endswith('.py'):
            yield int(nome[1:3]), nome[:-3]


def main(pedidas):
    os.makedirs(SAIDA, exist_ok=True)
    resumo = {}
    recortes = {}
    if os.path.exists(RECORTES):
        with open(RECORTES, encoding='utf8') as f:
            recortes = json.load(f)
    for num, mod in modulos():
        if pedidas and num not in pedidas:
            continue
        m = importlib.import_module(mod)
        fig = m.desenhar()
        assert fig.pid == 'fig%02d' % num, f'{mod}: número da figura não bate com o arquivo'
        txt = fig.svg()
        with open(os.path.join(SAIDA, fig.pid + '.svg'), 'w', encoding='utf8', newline='\n') as f:
            f.write(txt)
        recortes[fig.pid] = list(fig.recorte())
        resumo[fig.pid] = fig.campos()
        print(f'{fig.pid}  {len(txt) / 1024:5.1f} KB  campos: {", ".join(fig.campos()) or "—"}')
    with open(RECORTES, 'w', encoding='utf8', newline='\n') as f:
        f.write('{\n' + ',\n'.join(f'  "{k}": {json.dumps(v)}' for k, v in sorted(recortes.items())) + '\n}\n')
    return resumo


if __name__ == '__main__':
    r = main({int(a) for a in sys.argv[1:] if a.isdigit()})
    if '--json' in sys.argv:
        print(json.dumps(r, ensure_ascii=False))
