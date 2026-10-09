# Detalhe 2 — amarração do contraforte intermediário (T): fiada P × fiada I em perspectiva explodida (as duas
# fiadas afastadas na vertical), cada peça na cor do Jose (dados/encaixes_revit/cores_jose.json), legenda curta.
#
# As peças são LIDAS dos gabaritos medidos no Revit dele (dados/encaixes_revit/*_templates.json), fiada 1 (P: o
# muro passa) e fiada 2 (I: o contraforte atravessa), em volta do eixo do contraforte do meio:
#   b19c59 — 19x39, contraforte de 59;  b14c34 — 14x39, contraforte de 34;  b14c54 — 14x39, contraforte de 54.
# Ler do JSON (e não redigitar) garante que o desenho é o gabarito: se o Jose remodelar, regenera.
#
# Ajuste no gabarito de 59 (anotado no próprio JSON como "deslize_no_modelo"): no T há peça sobreposta — na fiada P
# um meio bloco DENTRO do inteiro de fora; na fiada I um inteiro recortado pelo Revit (4347 cm3) sobre o inteiro que
# atravessa. Desenha-se a montagem pretendida pela regra medida ("inteiro atravessa + meio por fora"): o meio
# sobreposto sai; o recortado vira um meio bloco na ponta de fora (mesmo y externo).
#
# DEDUÇÃO (cosmética, não vem do Revit): o furo dos blocos é desenhado retangular (no Revit tem canto arredondado);
# no bloco 54 o lado do furo de 14 × o de 15 não foi medido (o gabarito só dá o giro 0) — desenhado com o de 14 à
# esquerda. No bloco 34 girado, a ponta de 3,2 fica na face do muro: é o que põe o furo quadrado na linha dos furos
# do muro ("coluna de graute contínua no encontro", regra do gabarito).
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iso import Det, Iso, Caixa, COR_JOSE, legenda  # noqa: E402
from applib import C, T_TIT, T_TXT  # noqa: E402

DADOS = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'dados', 'encaixes_revit'))
JANELA = 50.6      # meia largura do trecho de muro em volta do eixo (cm): pega 1 inteiro de cada lado na P
# Afastamento vertical das duas fiadas no desenho (explosão). Cresce com o comprimento do contraforte: a ponta
# do contraforte da fiada de cima, vista de frente, desce na tela sobre o topo da fiada de baixo; com folga menor
# que ~0,8·tenr ela cobre o T da fiada de baixo, que é justamente o que o detalhe mostra.
def gap(tenr):
    return 0.8 * tenr + 10.0

VARIANTES = {
    'b19c59': dict(arq='19x39_templates.json', tpl='contraforte_59', eixo=-194.1, t=19),
    'b14c34': dict(arq='14x39_templates.json', tpl='contraforte_curto_34', eixo=-1185.1, t=14),
    'b14c54': dict(arq='14x39_templates.json', tpl='contraforte_longo_54', eixo=-1555.1, t=14),
}

NOME = {'inteiro': 'bloco inteiro', 'meio': 'meio bloco', 'b34': 'bloco 34', 'b54': 'bloco 54'}

# Furos ao longo do comprimento: (início, comprimento) a partir de uma ponta; largura do furo na transversal.
# Medidas das famílias do Revit (14x39_templates.json / 19x39_casaR.json).
FUROS = {
    ('inteiro', 19): ([(3.5, 14.25), (21.25, 14.25)], 12.6),
    ('meio', 19): ([(2.5, 14.0)], 14.0),
    ('inteiro', 14): ([(2.5, 15.75), (20.75, 15.75)], 7.6),
    ('meio', 14): ([(2.5, 14.0)], 9.0),
    ('b54', 14): ([(2.5, 14.0), (23.2, 7.6), (36.5, 15.0)], 7.6),
    ('b34', 14): ([(3.2, 7.6), (17.5, 14.0)], 7.6),      # a partir da ponta de 3,2 (face do muro)
}


def tipo(p):
    f = p['familia']
    if f.startswith('Blocos Padr'):
        return 'inteiro'
    if f.startswith('Meio Bloco'):
        return 'meio'
    if f.startswith('Bloco 34'):
        return 'b34'
    if f.startswith('Bloco 54'):
        return 'b54'
    raise ValueError(f'peça inesperada na fiada P/I: {f}')


def _cobre(a, b):
    return min(a['x1'], b['x1']) - max(a['x0'], b['x0']) > 0.01 and min(a['y1'], b['y1']) - max(a['y0'], b['y0']) > 0.01


def fiada(v, z0):
    """Peças da fiada (z0 do Revit) em volta do eixo, já sem as sobreposições do gabarito."""
    tpl = json.load(open(os.path.join(DADOS, v['arq']), encoding='utf8'))['templates'][v['tpl']]
    ps = [dict(p) for p in tpl['pecas'] if abs(p['z0'] - z0) < 0.01 and abs((p['x0'] + p['x1']) / 2 - v['eixo']) <= JANELA]
    for p in ps:
        p['tipo'] = tipo(p)
    # deslize do gabarito de 59 (ver cabeçalho)
    fora = []
    for a in ps:
        for b in ps:
            if a is b or not _cobre(a, b):
                continue
            va = (a['x1'] - a['x0']) * (a['y1'] - a['y0'])
            vb = (b['x1'] - b['x0']) * (b['y1'] - b['y0'])
            dentro = a['x0'] >= b['x0'] - 0.01 and a['x1'] <= b['x1'] + 0.01 and a['y0'] >= b['y0'] - 0.01 and a['y1'] <= b['y1'] + 0.01
            if dentro and va < vb:
                fora.append(a)                           # meio bloco dentro do inteiro de fora
            elif not dentro and a['vol_cm3'] < 7000 and a['tipo'] == 'inteiro':
                a['tipo'] = 'meio'                       # inteiro recortado pelo Revit → meio bloco na ponta de fora
                a['y1'] = a['y0'] + 19.0
    ps = [p for p in ps if not any(p is f for f in fora)]
    for a in ps:
        for b in ps:
            assert a is b or not _cobre(a, b), f'peças ainda sobrepostas em {v["tpl"]} z={z0}'
    return ps


def furos(p, t):
    lay, larg = FUROS[(p['tipo'], t)]
    lx, ly = p['x1'] - p['x0'], p['y1'] - p['y0']
    out = []
    if lx >= ly:                       # peça ao longo do muro
        yc = (p['y0'] + p['y1']) / 2
        for a, L in lay:
            out.append((p['x0'] + a, p['x0'] + a + L, yc - larg / 2, yc + larg / 2))
    else:                              # peça girada (no contraforte): conta a partir da face do muro (y maior)
        xc = (p['x0'] + p['x1']) / 2
        for a, L in lay:
            out.append((xc - larg / 2, xc + larg / 2, p['y1'] - a - L, p['y1'] - a))
    return out


def caixas(v, ps, z0):
    out = []
    for p in ps:
        cor = COR_JOSE[p['tipo']]
        out.append(Caixa(p['x0'], p['x1'], p['y0'], p['y1'], z0, z0 + 19.0, cor, borda='#262626', sw=0.9,
                         furos=furos(p, v['t']), tons=(0.4, 0.0, -0.3)))
    return out


def desenhar(var):
    v = VARIANTES[var]
    s = Det('det02' + var, 1000, 700)
    P_ = fiada(v, 1.0)          # fiada P (1, 3, 6, 8)
    I_ = fiada(v, 21.0)         # fiada I (2, 4, 7, 9)
    yw1 = max(p['y1'] for p in P_)                       # face do muro (lado oposto ao contraforte)
    S = 4.6
    # olhando do lado do contraforte (ele vem para a frente, o muro fica atrás e nada o esconde)
    iso = Iso(s, 0, 0, S, sx=1, sy=-1, ref=(v['eixo'], yw1, 0))
    tenr = max(p['y1'] for p in P_) - min(p['y0'] for p in P_)
    zI = 19.0 + gap(tenr)
    iso.desenhar(caixas(v, P_, 0.0) + caixas(v, I_, zI))
    # guias da explosão: a ponta do contraforte de uma fiada sobre a da outra
    yp = min(p['y0'] for p in P_)
    cf = [p for p in P_ if p['y0'] <= yp + 0.01][0]
    for xg in (cf['x0'], cf['x1']):
        a, b = iso.p(xg, yp, 19.0), iso.p(xg, yp, zI)
        s.line(a[0], a[1] + 4, b[0], b[1] - 4, stroke=C['cinza'], sw=1.0, extra='stroke-dasharray="4 4"')
    # rótulos das fiadas: à esquerda da ponta esquerda do muro de cada uma
    for ps, z, rot in ((P_, 0.0, 'fiada P'), (I_, zI, 'fiada I')):
        xm = min(p['x0'] for p in ps)
        muro = [p for p in ps if p['y1'] >= yw1 - 0.01]
        y_ext = min(p['y0'] for p in muro if abs(p['x0'] - xm) < 0.01) if any(abs(p['x0'] - xm) < 0.01 for p in muro) else yw1 - v['t']
        q = iso.p(xm, y_ext, z + 9.5)
        s.text(q[0] - 22, q[1] + 7, rot, size=T_TIT, anchor='end', weight='bold')
    # legenda: só as peças que aparecem
    usados = []
    for p in P_ + I_:
        if p['tipo'] not in usados:
            usados.append(p['tipo'])
    ordem = [k for k in ('inteiro', 'meio', 'b34', 'b54') if k in usados]
    bb = list(s.caixa)
    legenda(s, bb[2] - 190, bb[1] + 40, [(COR_JOSE[k], NOME[k]) for k in ordem], size=T_TXT)
    return s


if __name__ == '__main__':
    for k in VARIANTES:
        print(k, len(desenhar(k).svg()))
