# Tabelas desenhadas (figs. 22 e 23). Os números NÃO são digitados aqui: saem das mesmas células da planilha
# (app/src/motor/planilha.gerada.json), para a figura nunca discordar da conta.
import json
import os
from applib import C, T_TXT, _larg_texto

AQUI = os.path.dirname(os.path.abspath(__file__))
PLANILHA = os.path.normpath(os.path.join(AQUI, '..', '..', 'app', 'src', 'motor', 'planilha.gerada.json'))
_cel = None


def cel(ref, casas=None):
    global _cel
    if _cel is None:
        with open(PLANILHA, encoding='utf8') as f:
            _cel = json.load(f)['celulas']
    v = _cel.get(ref)
    if casas is not None and isinstance(v, (int, float)):
        return f'{v:.{casas}f}'.replace('.', ',')
    if isinstance(v, float):
        v = ('%g' % v).replace('.', ',')
    elif isinstance(v, int):
        v = str(v)
    return '' if v is None else str(v)


def tabela(s, x, y, titulo, cabec, linhas, campos_col=None, campo_titulo=None, size=T_TXT, alt=30, pad=14, alinhar=None):
    """Tabela simples: título, cabeçalho em negrito, linhas finas. campos_col[i] = nomes de entrada da coluna i
    (o grupo inclui o cabeçalho e as células: a grandeza é a coluna inteira)."""
    n = len(cabec)
    larg = []
    for j in range(n):
        w = max([_larg_texto(cabec[j], size)] + [_larg_texto(l[j], size) for l in linhas])
        larg.append(w * 0.92 + 2 * pad)
    alinhar = alinhar or ['middle'] * n
    W = sum(larg)
    if campo_titulo:
        with s.campo(*campo_titulo):
            s.text(x, y, titulo, size=size + 2, anchor='start', weight='bold')
    else:
        s.text(x, y, titulo, size=size + 2, anchor='start', weight='bold')
    y0 = y + 14
    s.line(x, y0, x + W, y0, stroke=C['line'], sw=1.4)
    xs = [x]
    for w in larg:
        xs.append(xs[-1] + w)

    def px(j):
        return {'start': xs[j] + pad, 'middle': (xs[j] + xs[j + 1]) / 2, 'end': xs[j + 1] - pad}[alinhar[j]]

    for j in range(n):
        campos = (campos_col or [None] * n)[j]
        if campos:
            s.add(f'<g data-campo="{" ".join(campos)}">')
            s._campos.extend(campos)
        s.text(px(j), y0 + alt - 9, cabec[j], size=size, anchor=alinhar[j], weight='bold')
        for i, l in enumerate(linhas):
            s.text(px(j), y0 + alt * (i + 2) - 9, l[j], size=size, anchor=alinhar[j])
        if campos:
            s.add('</g>')
    s.line(x, y0 + alt, x + W, y0 + alt, stroke=C['line'], sw=1)
    for i in range(1, len(linhas)):
        s.line(x, y0 + alt * (i + 1), x + W, y0 + alt * (i + 1), stroke=C['cinza2'], sw=0.7)
    s.line(x, y0 + alt * (len(linhas) + 1), x + W, y0 + alt * (len(linhas) + 1), stroke=C['line'], sw=1.4)
    return W, alt * (len(linhas) + 1) + 14
