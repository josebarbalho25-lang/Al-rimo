# Detalhe 5 — cinta do topo (corte) e junta de controle entre dois contrafortes encostados (planta na fiada de
# canaleta).
#
# O que vem do app e do Revit do Jose:
#   - cinta: última fiada em canaleta grauteada com uma barra horizontal centralizada (entradas cinta_topo e
#     phi_cinta); graute de 1,5 entre a barra e o fundo (COB_GRAUTE, "ABCP" na aba Referências); canaleta da família
#     (paredes 2,5, fundo 2,91 na 19 e 3,91 na 14, cantos de dentro arredondados pelo volume — catalogo.ts);
#   - junta: com contrafortes, a junta fica entre dois contrafortes encostados, muro e sapata cortados juntos
#     (entrada junta_cada, Fig. 16); os trechos ficam a 1 cm um do outro (JUNTA da modulação) e cada trecho tem a sua
#     barra da cinta (a corrida termina no trecho) — a armadura horizontal não atravessa a junta;
#   - as peças da planta são LIDAS dos gabaritos do Jose (dados/encaixes_revit/*_templates.json, fiada de canaleta):
#     do lado esquerdo da junta a ponta direita do gabarito, do lado direito a ponta esquerda.
# Referência (sem frase no desenho): o manual da ABCP recomenda interromper (parte d)a armadura horizontal na junta
# de controle — o rótulo da barra leva "(ref. manual ABCP)".
# DEDUÇÃO: o enchimento da junta (espuma no miolo, selante na face aparente) é o usual de obra, não vem do app nem
# do Revit; a barra termina a 3 cm da junta (COB_PONTA da modulação, também dedução); o trecho da parede da canaleta do
# muro quebrado na frente do canal do contraforte segue o det01; sapata desenhada com talão e ponta de proporção.
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from iso import Det  # noqa: E402
from corte import ARG, Corte, FAMILIA, interrupcao, cota_curta_v  # noqa: E402
from applib import C, T_TIT, T_TXT, T_PEQ  # noqa: E402

DADOS = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'dados', 'encaixes_revit'))
PHI = 1.0
COB_GRAUTE = 1.5
COB_PONTA = 3.0
JAN = 45.0           # cm de muro desenhados de cada lado da junta
FOLGA = 1.0          # junta de controle (cm)
TALAO, PONTA_S = 12.0, 24.0      # sapata além da ponta do contraforte e à frente do muro (proporção)
SOLO_ALEM = 6.0                  # solo desenhado além do talão
SP = 5.2             # px por cm na planta
Z_CAN = 181.0        # fiada de canaleta do topo nos gabaritos

VARIANTES = {
    'b19c59': dict(fam='b19', arq='19x39_templates.json', tpl='contraforte_59'),
    'b14c34': dict(fam='b14', arq='14x39_templates.json', tpl='contraforte_curto_34'),
    'b14c54': dict(fam='b14', arq='14x39_templates.json', tpl='contraforte_longo_54'),
}


# ======================================= (a) cinta em corte =======================================
def corte_cinta(s, f, ox, oy):
    K = 9.0
    t = f['t']
    cc = Corte(s, ox, oy, K, ref=(t / 2, 20.0))
    P, X, Y = cc.P, cc.X, cc.Y
    zb = -12.0
    cc.ret(f['parede'], zb, t - f['parede'], 0, fill=C['hollow'], stroke='none')
    cc.bloco_no_furo(f, zb, 0, miolo='vazio')
    cc.argamassa(f, 0)
    cc.canaleta(f, 1.0)
    zfun = 1.0 + f['can_fundo']
    zbar = zfun + COB_GRAUTE + PHI / 2
    q = P(t / 2, zbar)
    s.circle(q[0], q[1], PHI / 2 * K, fill=C['steel'])
    interrupcao(s, P(-2, zb), P(t + 2, zb))
    cota_curta_v(s, X(t / 2 - 2.6), Y(zbar - PHI / 2), Y(zfun), '≥ 1,5', side=-1)
    s.dim_h(X(0), X(t), Y(20) - 22, f['nome'], ext_from=(Y(20), Y(20)), size=T_TXT)
    xl = X(0) - 46
    q = P(f['can_par'] / 2, 15)
    s.chamada(q[0], q[1], xl, q[1] + 6, 'canaleta', anchor='end')
    q = P(f['can_par'] + 2.2, 9)
    s.chamada(q[0], q[1], xl, q[1] + 30, 'graute', color=C['grout'], anchor='end')
    q = P(t / 2 + PHI / 2, zbar + 0.3)
    s.chamada(q[0], q[1], X(t) + 46, Y(14) + 6, 'barra da cinta', color=C['steel'], anchor='start')
    return cc


# ======================================= (b) junta em planta =======================================
def pecas_da_ponta(v, lado):
    """Peças da fiada de canaleta numa ponta do gabarito ('dir' ou 'esq'), cortadas na janela."""
    tpl = json.load(open(os.path.join(DADOS, v['arq']), encoding='utf8'))['templates'][v['tpl']]
    X0, X1 = tpl['x']
    out = []
    for p in tpl['pecas']:
        if abs(p['z0'] - Z_CAN) > 0.01:
            continue
        if lado == 'dir' and p['x1'] > X1 - JAN:
            out.append(dict(x0=max(p['x0'], X1 - JAN), x1=p['x1'], y0=p['y0'], y1=p['y1']))
        elif lado == 'esq' and p['x0'] < X0 + JAN:
            dx = X1 + FOLGA - X0
            out.append(dict(x0=p['x0'] + dx, x1=min(p['x1'], X0 + JAN) + dx, y0=p['y0'], y1=p['y1']))
    return out, X1


def trecho(v, f, lado):
    ps, X1 = pecas_da_ponta(v, lado)
    yw1 = max(p['y1'] for p in ps)
    yw0 = yw1 - f['t']
    muro = sorted([p for p in ps if abs(p['y1'] - yw1) < 0.01 and abs(p['y0'] - yw0) < 0.01], key=lambda p: p['x0'])
    haste = [p for p in ps if p['y1'] <= yw0 + 0.01]
    assert len(haste) == 1 and len(muro) + 1 == len(ps), f'{v["tpl"]} {lado}: peças inesperadas na ponta'
    return dict(muro=muro, haste=haste[0], yw=(yw0, yw1), X1=X1)


def planta_junta(s, v, f, ox, oy, S=SP):
    par = f['can_par']
    E, D = trecho(v, f, 'dir'), trecho(v, f, 'esq')       # esquerda da junta = ponta direita do gabarito
    yw0, yw1 = E['yw']
    xj0 = E['X1']
    xj1 = xj0 + FOLGA
    xref = xj0 + FOLGA / 2
    Q = lambda x, y: (ox + (x - xref) * S, oy + (y - yw1) * S)      # solo para cima na tela

    def ret(x0, y0, x1, y1, **kw):
        (a, b), (c, d) = Q(x0, y0), Q(x1, y1)
        s.rect(min(a, c), min(b, d), abs(c - a), abs(d - b), **kw)
    hy0 = min(E['haste']['y0'], D['haste']['y0'])
    ys0, ys1 = hy0 - TALAO, yw1 + PONTA_S
    yt = ys0 - SOLO_ALEM
    xa, xb = xj0 - JAN, xj1 + JAN
    # solo (aterro) do lado do contraforte, contínuo sobre a junta; a sapata fica embaixo dele (contorno oculto)
    ret(xa, yt, xb, yw0, fill=s.SOLO, stroke='none')
    oculto = dict(stroke=C['line'], sw=1.0, extra='stroke-dasharray="6,4"')
    for x0, x1 in ((xa, xj0), (xj1, xb)):
        a, b = Q(x0, ys0), Q(x1, ys0)
        s.line(a[0], a[1], b[0], b[1], **oculto)
    for x in (xj0, xj1):
        a, b = Q(x, ys0), Q(x, hy0)
        s.line(a[0], a[1], b[0], b[1], **oculto)
    # ponta da sapata, à frente do muro (no nível do terreno da frente): à vista, cortada na junta
    for x0, x1 in ((xa, xj0), (xj1, xb)):
        ret(x0, yw1, x1, ys1, fill=s.CONC, stroke='none')
        a, b = Q(x0, ys1), Q(x1, ys1)
        s.line(a[0], a[1], b[0], b[1], stroke=C['line'], sw=1.2)
    for x in (xj0, xj1):
        a, b = Q(x, yw1), Q(x, ys1)
        s.line(a[0], a[1], b[0], b[1], stroke=C['line'], sw=1.2)
    # junta: espuma entre os contrafortes, entre os muros e na sapata; selante na face aparente do muro
    ret(xj0, hy0, xj1, ys1, fill=C['sub'], stroke='none')
    ret(xj0, yw1 - 1.2, xj1, yw1, fill=C['line'], stroke='none')
    # alvenaria de cada trecho
    for T in (E, D):
        h = T['haste']
        hx0, hx1 = h['x0'], h['x1']
        nx0, nx1 = hx0 + par, hx1 - par                      # canal do contraforte
        mx0, mx1 = T['muro'][0]['x0'], T['muro'][-1]['x1']
        # graute: canal do muro + canal do contraforte, ligados pelo trecho quebrado da parede
        L = [(mx0, yw1 - par), (mx0, yw0 + par), (nx0, yw0 + par), (nx0, h['y0']), (nx1, h['y0']), (nx1, yw0 + par),
             (mx1, yw0 + par), (mx1, yw1 - par)]
        s.poly([Q(*p) for p in L], fill=C['groutfill'], stroke=C['grout'], sw=1.0)
        # juntas de argamassa entre peças (paredes) e entre o contraforte e o muro
        for a, b in zip(T['muro'], T['muro'][1:]):
            ret(a['x1'], yw0, b['x0'], yw0 + par, fill=ARG, stroke='none')
            ret(a['x1'], yw1 - par, b['x0'], yw1, fill=ARG, stroke='none')
        if yw0 - h['y1'] > 0.01:
            ret(hx0, h['y1'], hx0 + par, yw0, fill=ARG, stroke='none')
            ret(hx1 - par, h['y1'], hx1, yw0, fill=ARG, stroke='none')
        # paredes das canaletas
        for p in T['muro']:
            for a, b in ((p['x0'], min(p['x1'], nx0)), (max(p['x0'], nx1), p['x1'])):
                if b - a > 0.01:
                    ret(a, yw0, b, yw0 + par, fill=C['blockfill'], stroke=C['line'], sw=1.0)
            ret(p['x0'], yw1 - par, p['x1'], yw1, fill=C['blockfill'], stroke=C['line'], sw=1.0)
        ret(hx0, h['y0'], hx0 + par, h['y1'], fill=C['blockfill'], stroke=C['line'], sw=1.0)
        ret(hx1 - par, h['y0'], hx1, h['y1'], fill=C['blockfill'], stroke=C['line'], sw=1.0)
    # barra da cinta: uma por trecho, termina antes da junta
    yc = (yw0 + yw1) / 2
    sw = max(2.6, PHI * S * 0.8)
    for x0, x1 in ((xa + 1, xj0 - COB_PONTA), (xj1 + COB_PONTA, xb - 1)):
        a, b = Q(x0, yc), Q(x1, yc)
        s.line(a[0], a[1], b[0], b[1], stroke=C['steel'], sw=sw)
    # interrupções nas bordas da janela
    for x in (xa, xb):
        interrupcao(s, Q(x, yt - 2), Q(x, ys1 + 3))
    # eixo da junta (fora do desenho, para não cobrir o enchimento) e rótulo
    a, b = Q(xref, yt - 14), Q(xref, yt - 1)
    s.line(a[0], a[1], b[0], b[1], stroke=C['steel'], sw=1.4, extra='stroke-dasharray="6,4"')
    s.text(a[0], a[1] - 10, 'junta de controle', size=T_TXT, color=C['steel'], weight='bold')
    # cota da folga, embaixo
    yq = Q(0, ys1)[1] + 50
    xq0, xq1 = Q(xj0, 0)[0], Q(xj1, 0)[0]
    for x in (xq0, xq1):
        s.line(x, Q(0, ys1)[1] + 4, x, yq + 5, stroke=C['dim'], sw=0.7)
    s.line(xq0 - 22, yq, xq0, yq, stroke=C['dim'], sw=1)
    s.line(xq1, yq, xq1 + 22, yq, stroke=C['dim'], sw=1)
    s.dim_h(xq0, xq1, yq, '')
    s.text(xq1 + 28, yq + 6, '1', size=T_TXT, color=C['dim'], anchor='start')
    # rótulos
    xr = Q(xb, 0)[0] + 34
    xl = Q(xa, 0)[0] - 34
    q = Q(xj1 + COB_PONTA + 0.3, yc)
    s.chamada(q[0], q[1], xr, Q(0, yw0 + 2)[1] - 30, 'barra da cinta interrompida', color=C['steel'], anchor='start')
    s.text(xr, Q(0, yw0 + 2)[1] - 8, '(ref. manual ABCP)', size=T_PEQ, color=C['steel'], anchor='start')
    q = Q(xref, (hy0 + yw0) / 2)
    s.chamada(q[0], q[1], xr, q[1] + 6, 'espuma', anchor='start')
    q = Q(xref, yw1 - 0.6)
    s.chamada(q[0], q[1], xr, Q(0, yw1)[1] + 50, 'selante', anchor='start')
    h = E['haste']
    q = Q((h['x0'] + h['x1']) / 2, h['y0'] + 7)
    s.chamada(q[0], q[1], xl, q[1] + 6, 'graute', color=C['grout'], anchor='end')
    q = Q(xa + 10, (yw1 + ys1) / 2 + 3)
    s.text(q[0], q[1] + 6, 'sapata', size=T_TXT, color=C['note'], anchor='start', halo=True)
    q = Q(xa + 4, yw0 - 3)
    s.text(q[0], q[1], 'solo', size=T_TXT, color=C['soil'], weight='bold', anchor='start')
    q = Q(xa + 4, yw1 + 4.5)
    s.text(q[0], q[1], 'face externa', size=T_PEQ, color=C['note'], anchor='start', halo=True)


def desenhar(var):
    v = VARIANTES[var]
    f = FAMILIA[v['fam']]
    s = Det('det05' + var, 1000, 1000)
    corte_cinta(s, f, 0, 0)
    bb = list(s.caixa)
    s.text(bb[0] - 60, bb[1] - 24, 'cinta — corte', size=T_TIT, anchor='start', weight='bold')
    topo = s.caixa[3] + 170
    # planta: o topo do solo desenhado fica `topo` px abaixo do corte
    E = trecho(v, f, 'dir')
    yw1 = E['yw'][1]
    hy0 = E['haste']['y0']
    oy = topo + (yw1 - (hy0 - TALAO - SOLO_ALEM)) * SP
    planta_junta(s, v, f, 0, oy)
    s.text(bb[0] - 60, topo - 120, 'junta — planta', size=T_TIT, anchor='start', weight='bold')
    return s


if __name__ == '__main__':
    for k in VARIANTES:
        print(k, len(desenhar(k).svg()))
