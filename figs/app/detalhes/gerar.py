# Gera os detalhes típicos da prancha (app/public/detalhes/detNN_<variante>.svg) a partir dos dNN_*.py desta pasta.
#
#   cd figs/app/detalhes && python gerar.py          → todos
#   python gerar.py 1                                 → só o detalhe 1 (todas as variantes)
#
# Cada dNN_*.py tem VARIANTES (uma por família de bloco / contraforte) e desenhar(variante). Uma variante por
# arquivo porque a prancha mostra só a do muro do usuário (bloco 19 ou 14, contraforte de 59, 34 ou 54).
# Como nas figuras do app, não precisa de navegador: o recorte do viewBox sai da caixa acumulada pela applib.
import importlib
import os
import sys

sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.normpath(os.path.join(AQUI, '..', '..', '..', 'app', 'public', 'detalhes'))
sys.path.insert(0, AQUI)


def modulos():
    for nome in sorted(os.listdir(AQUI)):
        if nome.startswith('d') and nome[1:3].isdigit() and nome.endswith('.py'):
            yield int(nome[1:3]), nome[:-3]


def main(pedidos):
    os.makedirs(SAIDA, exist_ok=True)
    feitos = []
    for num, mod in modulos():
        if pedidos and num not in pedidos:
            continue
        m = importlib.import_module(mod)
        for var in m.VARIANTES:
            fig = m.desenhar(var)
            nome = 'det%02d_%s' % (num, var)
            assert fig.pid == 'det%02d%s' % (num, var), f'{mod}: prefixo de id não bate com o arquivo'
            txt = fig.svg()
            with open(os.path.join(SAIDA, nome + '.svg'), 'w', encoding='utf8', newline='\n') as f:
                f.write(txt)
            feitos.append(nome)
            print(f'{nome}  {len(txt) / 1024:5.1f} KB')
    return feitos


if __name__ == '__main__':
    main({int(a) for a in sys.argv[1:] if a.isdigit()})
