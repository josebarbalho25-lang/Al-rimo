from figlib import SVG, C
S = 2.6                      # px por cm
W, H = 1180, 570
s = SVG(W, H)
s.text(30, 34, 'Fig. 12 — Contraforte em planta: enterrado (seção T) ou aparente (seção retangular)', size=18, anchor='start', weight='bold')
s.text(30, 56, 'A posição do contraforte decide se o muro trabalha comprimido (mesa da seção T) ou tracionado (só a alma resiste). Medidas do exemplo da aula 12.3.', size=13, anchor='start', color=C['note'])

def case(x0, buried):
    # x0 = eixo do contraforte; muro horizontal; solo embaixo
    t, e, ten, half = 14, 14, 59, 100          # cm
    yw = 245 if buried else 300                  # face externa do muro (topo) — muro de yw a yw + t
    X = lambda v: x0 + v * S
    Yw0, Yw1 = yw, yw + t * S
    # solo (embaixo do muro)
    soil_top = Yw1
    s.rect(X(-half) - 10, soil_top, (2 * half) * S + 20, 480 - soil_top, fill='url(#soilh)', stroke='none')
    s.text(X(-half) + 6, 472, 'SOLO', size=13, anchor='start', color=C['soil'], weight='bold')
    s.text(X(-half) + 6, Yw0 - 10, 'lado externo', size=12, anchor='start', color=C['note'])
    # muro
    s.rect(X(-half), Yw0, 2 * half * S, t * S, fill=C['blockfill'], stroke=C['block'], sw=1.2)
    # contraforte
    if buried:
        cy0, cy1 = Yw1, Yw0 + ten * S
    else:
        cy0, cy1 = Yw0 - (ten - t) * S, Yw0
    s.rect(X(-e / 2), cy0, e * S, cy1 - cy0, fill=C['groutfill'], stroke=C['grout'], sw=1.4)
    # empuxo (setas do solo para fora)
    for k in ((-92, -76, -60) if buried else (-80, -55, 55, 80)):
        s.arrow(X(k), Yw1 + 60, X(k), Yw1 + 6, color=C['load'])
    s.text(X(-76), Yw1 + 78, 'empuxo', size=11, color=C['load'])
    if buried:
        bm = 86.7
        s.rect(X(-bm / 2), Yw0, bm * S, t * S, fill='#f4b183', stroke='#c55a11', sw=1.4, extra='fill-opacity="0.55"')
        s.text(x0, Yw0 + t * S / 2 + 5, 'mesa comprimida (bm)', size=12, color='#843c0c', weight='bold')
        s.dim_h(X(-bm / 2), X(bm / 2), Yw0 - 34, 'bm = mín(bw + 2·6t; h/3) = 86,7', size=12)
        # barras na ponta (tração) e construtivas
        for dx in (-3.5, 0, 3.5):
            s.circle(X(dx), cy1 - 7 * S, 4.2)
        s.circle(X(-3.5), cy0 + 6 * S, 3.6, fill='#7f7f7f'); s.circle(X(3.5), cy0 + 6 * S, 3.6, fill='#7f7f7f')
        s.rect(X(-3.5) - 6, cy0 + 4.5 * S, 7 * S + 12, (ten - t - 9) * S + 12, stroke=C['steel'], sw=1.2, extra='stroke-dasharray="5,3"')
        s.text(X(e / 2) + 12, cy1 - 7 * S + 4, '3Ø10 — tração (d = 52)', size=12, anchor='start', color=C['steel'], weight='bold')
        s.text(X(e / 2) + 12, cy0 + 6 * S + 4, '2Ø10 construtivas', size=12, anchor='start', color='#595959')
        s.text(X(e / 2) + 12, (cy0 + cy1) / 2 + 4, 'estribo Ø6,3 c/20 na junta', size=12, anchor='start', color=C['steel'])
        s.dim_v(X(-e / 2) - 70, Yw0, cy1, 'tenr = 59 (com o muro)', side=-1, ext_from=(X(-e / 2), X(-e / 2)), size=12)
        s.dim_h(X(-e / 2), X(e / 2), cy1 + 22, 'eenr = 14', size=12)
        s.text(x0, 100, 'ENTERRADO (lado do solo) → seção T', size=16, weight='bold', color=C['grout'])
        s.text(x0, 122, 'muro comprimido: entra como mesa; fpk do bloco vazado (6,0)', size=12, color=C['note'])
    else:
        s.rect(X(-e / 2), cy0, e * S, 9 * S, fill='#f4b183', stroke='#c55a11', sw=1.2, extra='fill-opacity="0.55"')
        s.text(X(e / 2) + 12, cy0 + 4.5 * S + 4, 'ponta comprimida (fpk*, grauteada)', size=12, anchor='start', color='#843c0c', weight='bold')
        for dx in (-3.5, 0, 3.5):
            s.circle(X(dx), Yw1 - 7 * S, 4.2)
        s.text(X(e / 2) + 12, Yw1 - 7 * S + 4, 'barras de tração junto ao solo', size=12, anchor='start', color=C['steel'], weight='bold')
        s.text(X(-half) + 10, Yw0 + t * S / 2 + 5, 'muro tracionado: não colabora', size=12, anchor='start', color=C['note'])
        s.dim_v(X(-e / 2) - 26, cy0, Yw1, 'tenr = 59 (com o muro)', side=-1, ext_from=(X(-e / 2), X(-e / 2)), size=12)
        s.text(x0, 100, 'APARENTE (lado de fora) → seção retangular', size=16, weight='bold', color=C['grout'])
        s.text(x0, 122, 'só a alma resiste (bw × tenr); compressão na ponta: fpk* (9,6)', size=12, color=C['note'])
    # largura de influência
    s.dim_h(X(-75), X(75), 505, 'largura de influência = l (eixo a eixo) — intermediário', size=12)
    s.line(X(-75), 488, X(-75), 512, stroke=C['dim'], sw=0.8, extra='stroke-dasharray="3,3"')
    s.line(X(75), 488, X(75), 512, stroke=C['dim'], sw=0.8, extra='stroke-dasharray="3,3"')

case(305, True)
case(880, False)
s.line(590, 85, 590, 520, stroke='#bfbfbf', sw=1)
s.text(30, 555, 'Campos das Entradas: Posição do contraforte, Comprimento (tenr), Espessura (eenr), Espaçamento entre contrafortes, Ø/nº de barras, estribo. Extremidade: largura = l/2 + balanço.', size=11, anchor='start', color=C['note'])
s.save('fig12_contraforte.svg'); print('ok')
