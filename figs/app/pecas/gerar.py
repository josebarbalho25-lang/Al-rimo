# Gera as figuras das peças (app/public/pecas/<b14|b19>_<peca>.svg) a partir de pecas.py.
#
#   cd figs/app/pecas && python gerar.py
#
# Antes de desenhar, reexporta o catálogo do app (node catalogo.mjs → catalogo.json): se a modulação mudar uma
# medida de peça, a figura acompanha na mesma rodada. Sem Node na máquina, desenha com o catalogo.json que já está
# aqui (e avisa). Como nas figuras do app, não precisa de navegador: o recorte sai da caixa acumulada pela applib.
#
# A lista de arquivos que o app espera está em app/src/quantitativo/pecas.ts (FIGURAS_DAS_PECAS); o teste do
# quantitativo confere que cada uma existe aqui.
import os
import shutil
import subprocess
import sys

sys.dont_write_bytecode = True
AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.normpath(os.path.join(AQUI, '..', '..', '..', 'app', 'public', 'pecas'))
sys.path.insert(0, AQUI)


def exportar_catalogo():
    node = shutil.which('node')
    if not node:
        print('AVISO: sem node — usando o catalogo.json que já existe')
        return
    r = subprocess.run([node, os.path.join(AQUI, 'catalogo.mjs')], capture_output=True, text=True, encoding='utf8')
    if r.returncode:
        raise SystemExit('catalogo.mjs falhou:\n' + r.stderr)
    print(r.stdout.strip())


def main():
    exportar_catalogo()
    import pecas      # depois do export: lê o catalogo.json novo
    os.makedirs(SAIDA, exist_ok=True)
    feitos = []
    for fam, arq in pecas.todas():
        fig = pecas.desenhar(fam, arq)
        nome = f'{pecas.PREFIXO[fam]}_{arq}'
        txt = fig.svg()
        with open(os.path.join(SAIDA, nome + '.svg'), 'w', encoding='utf8', newline='\n') as f:
            f.write(txt)
        feitos.append(nome)
        print(f'{nome:24s} {len(txt) / 1024:5.1f} KB')
    # arquivo que sobrou de uma peça que saiu da lista
    for n in os.listdir(SAIDA):
        if n.endswith('.svg') and n[:-4] not in feitos:
            print('AVISO: sobrou', n)
    return feitos


if __name__ == '__main__':
    main()
