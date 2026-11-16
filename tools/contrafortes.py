# Executado dentro de build_new.py (mesmo namespace): wb, E, R, line, name, section, header, title, widths, estilos.
# Aba Contrafortes — aula 12.3 (contraforte em T/retangular + painel entre contrafortes pelas tabelas de Libânio/Bares).
import json as _json, os as _os2
_HERE = _os2.path.dirname(_os2.path.abspath(__file__))
LIB = _json.load(open(_os2.path.join(_HERE, '..', 'dados', 'lib_tabs.json'), encoding='utf8'))

# ---------------- Referências: tabelas novas ----------------
REF2 = [
    ('Contraforte: modelo', 'Critério adotado', 'Contraforte intermediário = balanço engastado na base com carga σh·l (l = espaçamento eixo a eixo). Extremidade: l/2 + balanço do muro.'),
    ('Espessura efetiva com enrijecedores', 'NBR 16868-1 9.4.2 (Tab. 8)', 'te = δ·t, δ pela tabela lenr/eenr × tenr/t (interpolar). Só para a esbeltez; não vale para a área resistente.'),
    ('Largura colaborante', 'NBR 16868-1 11.3.4 e 10.1.3', 'Seção com enrijecedor e flexão no plano: bf ≤ 6t (cada lado), bm ≤ altura/3, hf ≤ 0,5d.'),
    ('Seção T × retangular', 'Critério adotado', 'Contraforte enterrado (do lado do solo): o muro fica comprimido → seção T, fpk do bloco vazado. Contraforte aparente (do lado de fora): o muro fica tracionado → seção retangular só da alma grauteada, fpk*.'),
    ('Tensão na armadura tracionada', 'NBR 16868-1 11.3.3', 'Bloco de concreto: fsd = fyd (todos os Ø).'),
    ('Armadura máxima', 'NBR 16868-1 12.3', 'Bloco de concreto: As ≤ 8% da área de graute do furo, incluindo traspasse.'),
    ('Cisalhamento com estribos', 'NBR 16868-1 11.4.3 e 12.2', 'Va = fvd·b·d; Vrd2 = Va + 0,4·b·d·√fpk/γm (MPa); Asw/s = (Vsd − Va)/(0,75·fywd·d); Asw,mín = ρ·b, ρ = 0,07% (fgk 15) a 0,14% (fgk 40). Estribos nas juntas de assentamento.'),
    ('ELS do contraforte', 'NBR 16868-1 9.2.3 e 9.2.4; δadm: critério adotado', 'Seção T bruta, Em = 800·fpk (bloco de concreto), ftk ⊥ fiada; Mr = ftk·Ig/yt; Ieq de Branson; heq = (12·Ieq/bm)^(1/3) para o Ftool; δ∞ = δ0·(1 + Δξ); δadm = 2·h/250.'),
    ('Painel entre contrafortes', 'Libânio (Bares/Pinheiro)', 'Base engastada (sapata corrida), topo livre, laterais apoiadas (Tipo 21) ou engastadas (Tipo 22). Carga triangular (Tab. 2.4e) + uniforme (Tab. 2.3e, Tipos 9/10). γ = h/l; m = μ·p·l²/100, l = menor vão. Flechas: Tab. 2.6b / 2.5b.'),
    ('Correspondência de eixos', 'Critério adotado', 'Mdx (horizontal, vão) ← μy; Mdxb (horizontal, borda livre) ← μyb; Mdy (vertical, vão) ← μx; Mdyei (vertical, engaste da base) ← μ\'x; Mdxe (horizontal, engaste lateral) ← μ\'y.'),
    ('Painel: flexão vertical', 'NBR 16868-1 11.3.3; posição das barras: critério adotado', 'Barras excêntricas simétricas a c das faces (ex.: c = 5 → d = t − 5): Mdyei traciona a face do solo na base, Mdy traciona a face externa no vão. K = 1; fpk líquido. Faixas = múltiplos do espaçamento dos furos.'),
    ('Painel: flexão horizontal', 'NBR 16868-1 6.2.2.4 b); ABCP 3.2', 'K = 0,5: fk,horizontal = 0,5·fk,vertical se a seção horizontal não for toda grauteada (= fk se for). Faixas 20/40/60/80 em canaleta, barra centralizada no detalhamento (d = t/2).'),
    ('Painel: ELS', 'NBR 16868-1 9.2.3; δadm: critério adotado', 'Vertical: seção I (bm = espaçamento das barras, alma = furo + septos, mesas = paredes do bloco), ftk⊥. Horizontal: bm = espaçamento das canaletas, alma = canaleta grauteada, ftk∥. Flecha pela tabela com cada heq; vale a direção mais crítica (δ∞ ≤ l/250).'),
    ('Ábaco simplificado do ELS', 'NBR 16868-1 E.5.1 (Fig. E.1)', 'Alvenaria armada: borda engastada considerada apoiada. Borda superior livre: h/t ≤ 80 até l/t = 40; cai a 60; reta até (55; 20); reta até (120; 15). Leitura do gráfico da Fig. E.1 (borda superior livre).'),
    ('Painel não armado entre armaduras', 'NBR 16868-1 Anexo E; carga média: critério adotado', 'Subpainel l = espaçamento das verticais × h = espaçamento das canaletas, caso 13; fd = 1,4·σh médio do subpainel de baixo.'),
    ('Reações por charneiras', 'NBR 6118 14.7.6.1 (critério de reações de laje)', '60° a partir do apoio engastado quando o vizinho é apoiado; 45° entre apoios do mesmo tipo; borda livre não recebe. Usado só para estimar a carga horizontal na sapata corrida (dedução nossa).'),
    ('Posição da barra principal do contraforte', 'Montagens modeladas no Revit (medido)', 'Centro do trecho comum aos furos das fiadas P e I (onde a barra passa reta). Enterrado, da ponta: 9,5 cm no bloco 14 (contrafortes de 34 e 54) e 10,0 cm no 19 (59 e 79) → d = 24,5 / 44,5 / 49,0 / 69,0. Aparente, da face do solo: 7,0 / 10,0 cm (espelho do template — dedução). Tabela nas colunas AT–BA.'),
    ('Contraforte dobrado', 'NBR 16868-1 3.3 (amarração indireta) e 12.6 (estribos); critério adotado',
     'Dois blocos lado a lado (2t + 1), todo grauteado, junta a prumo entre eles atravessada pelo estribo ancorado nos furos grauteados (amarração indireta). Critério adotado: os dois trabalham na flexão com a mesma linha neutra; estribo em toda fiada (c/20, 2 ramos) abraçando os dois, mesmo quando a conta o dispensaria; barras principais em número par, metade no furo da ponta de cada bloco (As,máx = 2 furos). Só o intermediário é dobrado; nas pontas e nas juntas, simples.'),
]
assert len(REF2) <= 18, 'a tabela de fontes encostaria na de δ (linha 103)'
R['A82'] = 'Muro com contrafortes'; R['A82'].font = fB
header(R, 83, ['Item', 'Fonte', 'O que diz / como foi usado'])
for i, (a, b, c_) in enumerate(REF2):
    rr = 84 + i
    for col, v in zip('ABC', (a, b, c_)):
        cell = R[f'{col}{rr}']; cell.value = v; cell.font = fN; cell.border = BOX
        cell.alignment = Alignment(wrap_text=True, vertical='top')

# δ dos enrijecedores (rows 104-109)
R['A103'] = 'δ — espessura efetiva com enrijecedores (NBR 16868-1 9.4.2, Tab. 8; interpolar). Linhas = lenr/eenr; colunas = tenr/t.'; R['A103'].font = fB
for j, v in enumerate(['lenr/eenr', 1, 2, 3]):
    c = R.cell(row=104, column=1 + j, value=v); c.font = fH; c.fill = NAVY; c.alignment = Alignment(horizontal='center')
for i, row_ in enumerate([(6, 1.0, 1.4, 2.0), (8, 1.0, 1.3, 1.7), (10, 1.0, 1.2, 1.4), (15, 1.0, 1.1, 1.2), (20, 1.0, 1.0, 1.0)]):
    for j, v in enumerate(row_):
        c = R.cell(row=105 + i, column=1 + j, value=v); c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center')
R['A110'] = '20 ou mais → 1,0. Fora da tabela, a planilha limita lenr/eenr a 6–20 e tenr/t a 1–3.'; R['A110'].font = fS
wb.defined_names['delta_le'] = DefinedName('delta_le', attr_text="'Referências'!$A$105:$A$109")
wb.defined_names['delta_tab'] = DefinedName('delta_tab', attr_text="'Referências'!$B$105:$D$109")

# Montagens do contraforte (colunas AT–BA, linhas 2–19, ao lado das listas das Entradas). POR QUE UMA TABELA: a barra
# principal não fica "no meio do bloco" (eenr/2) — fica onde há furo nas DUAS fiadas que ela atravessa (P: o muro
# passa; I: o contraforte atravessa o muro), e a peça da ponta muda de uma fiada para a outra. O centro desse trecho
# comum foi medido nos templates do Revit do Jose (09/10): bloco 14 → furo comum de 2,5 a 16,5 cm da ponta (c = 9,5);
# bloco 19 → de 3,5 a 16,5 (c = 10,0). Quem calcula a tabela é a seção do contraforte do app
# (app/src/modulacao/secaoDoContraforte.ts, com o catálogo de peças medido no Revit); o teste do app confere estas
# células contra ela — se o catálogo mudar, o teste acusa e a tabela é refeita. Aparente = espelho do template (a
# barra fica na célula do muro junto ao solo) — DEDUÇÃO, o Jose só modelou o enterrado.
# Barras que cabem: 15 mm de graute até o bloco (curso, item 12.1 — a regra do d sugerido) e a espera ao lado (é a
# seção da base, na emenda), arrumadas como o 3D arruma, no T e na ponta ao mesmo tempo. Só INFORMA: a régua do
# As,máx continua a do curso (Ag da tabela da aula), sem verificação nova (decisão do Jose, 09/10).
MONT_CF = [  # chave, t, tenr, c enterrado (da ponta), c aparente (da face do solo), furo comum E / A (cm²), barras E, barras A
    ('14x34', 14, 34, 9.5, 7.0, 105.08, 56.44, (20, 12, 6, 4, 2, 1), (8, 3, 2, 2, 0, 0)),
    ('14x54', 14, 54, 9.5, 7.0, 105.57, 56.44, (20, 12, 6, 4, 2, 1), (8, 3, 2, 2, 0, 0)),
    ('19x59', 19, 59, 10.0, 10.0, 163.29, 150.78, (40, 24, 15, 8, 6, 3), (35, 24, 15, 8, 6, 2)),
    ('19x79', 19, 79, 10.0, 10.0, 163.29, 150.78, (40, 24, 15, 8, 6, 3), (35, 24, 15, 8, 6, 2)),
]
MONT_PHI = PHI_BARRAS   # Ø de furo (build_new.py); o phi_cf sai da lista dos Ø com espera, que é parte desta
R['AT2'] = 'Contraforte: furo da barra principal nas montagens do Revit'; R['AT2'].font = fB
R['AT3'] = ('c = da face tracionada ao eixo das barras (enterrado: da ponta; aparente: da face do solo) = centro do trecho '
            'comum aos furos das fiadas P e I. Aparente = espelho do template (dedução).'); R['AT3'].font = fS
for j, h_ in enumerate(['Montagem', 't (cm)', 'tenr (cm)', 'c enterrado (cm)', 'c aparente (cm)', 'Furo comum enterrado (cm²)', 'Furo comum aparente (cm²)']):
    c = R.cell(row=4, column=46 + j, value=h_); c.font = fH; c.fill = NAVY; c.border = BOX
    c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
for i, (ch, tt, te, cE, cA, AE, AA, nE, nA) in enumerate(MONT_CF):
    for j, (v, fm) in enumerate([(ch, None), (tt, '0'), (te, '0'), (cE, '0.0'), (cA, '0.0'), (AE, '0.00'), (AA, '0.00')]):
        c = R.cell(row=5 + i, column=46 + j, value=v); c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center')
        if fm: c.number_format = fm
    for blk, ns in ((12, nE), (16, nA)):
        R.cell(row=blk + i, column=46, value=ch).font = fN
        R.cell(row=blk + i, column=47, value='enterrado' if blk == 12 else 'aparente').font = fN
        for k, v in enumerate(ns):
            c = R.cell(row=blk + i, column=48 + k, value=v); c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center')
R['AT10'] = 'Barras que cabem no furo comum: 15 mm de graute até o bloco, espera ao lado (emenda), eixo no c da montagem. Só informa.'; R['AT10'].font = fB
for j, h_ in enumerate(['Montagem', 'Posição'] + list(MONT_PHI)):
    c = R.cell(row=11, column=46 + j, value=h_); c.font = fH; c.fill = NAVY; c.border = BOX; c.alignment = Alignment(horizontal='center')
for nm_, rg in (('mont_ch', '$AT$5:$AT$8'), ('mont_t', '$AU$5:$AU$8'), ('mont_cE', '$AW$5:$AW$8'), ('mont_cA', '$AX$5:$AX$8'),
                ('mont_AE', '$AY$5:$AY$8'), ('mont_AA', '$AZ$5:$AZ$8'), ('mont_phi', '$AV$11:$BA$11'),
                ('mont_nE', '$AV$12:$BA$15'), ('mont_nA', '$AV$16:$BA$19')):
    wb.defined_names[nm_] = DefinedName(nm_, attr_text=f"'Referências'!{rg}")
# Estribo de 4 ramos (15/11): as mesmas barras do furo comum, agora sem passar sobre os ramos do meio do par de
# estribos (a 1/6 da largura do estribo de 2 ramos, t − 2·3,5 cm, do eixo: a superfície da barra e da espera fica a
# até (t − 7)/6 − φt/2 do eixo). Quem calcula é o app (secaoDoContraforte.ts, barrasQueCabem com a faixa
# faixaDosQuatroRamos), com o estribo Ø6,3 — o Ø5 dá a mesma tabela (o teste confere as duas); o 3D arruma as
# barras dentro da mesma faixa. A espera pode ir para o lado ao longo do contraforte (no eixo): por isso o bloco 14
# ainda leva barra na faixa estreita.
MONT_N4 = {  # chave → barras que cabem por Ø (MONT_PHI), enterrado / aparente
    '14x34': ((5, 4, 3, 2, 2, 0), (2, 1, 1, 1, 0, 0)),
    '14x54': ((5, 4, 3, 2, 2, 0), (2, 1, 1, 1, 0, 0)),
    '19x59': ((15, 8, 6, 2, 2, 1), (15, 8, 6, 2, 2, 1)),
    '19x79': ((15, 8, 6, 2, 2, 1), (15, 8, 6, 2, 2, 1)),
}
R['AT21'] = 'Estribo de 4 ramos: barras que cabem no furo comum sem passar sobre os ramos do meio (15 mm de graute, espera ao lado).'; R['AT21'].font = fB
for j, h_ in enumerate(['Montagem', 'Posição'] + list(MONT_PHI)):
    c = R.cell(row=22, column=46 + j, value=h_); c.font = fH; c.fill = NAVY; c.border = BOX; c.alignment = Alignment(horizontal='center')
for i, (ch, *_resto) in enumerate(MONT_CF):
    for blk, ns in ((23, MONT_N4[ch][0]), (27, MONT_N4[ch][1])):
        R.cell(row=blk + i, column=46, value=ch).font = fN
        R.cell(row=blk + i, column=47, value='enterrado' if blk == 23 else 'aparente').font = fN
        for k, v in enumerate(ns):
            c = R.cell(row=blk + i, column=48 + k, value=v); c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center')
for nm_, rg in (('mont_n4E', '$AV$23:$BA$26'), ('mont_n4A', '$AV$27:$BA$30')):
    wb.defined_names[nm_] = DefinedName(nm_, attr_text=f"'Referências'!{rg}")
# Contraforte DOBRADO com 4 ramos (Jose, 16/11: "dois estribos por fiada"): os dois estribos têm a largura do par
# (2t + 1) e os ramos do meio caem perto da junta entre os blocos. As barras de cada bloco ficam no furo DELE, do lado
# de fora do ramo do meio — por BLOCO. Quem calcula é o app (secaoDoContraforte.ts, barrasQueCabemNoDobrado), com o
# estribo Ø6,3 (o Ø5 cabe o mesmo ou mais; o teste confere as duas coisas).
MONT_N4D = {  # chave → barras que cabem em cada bloco por Ø (MONT_PHI), enterrado / aparente
    '14x34': ((20, 12, 6, 4, 2, 1), (8, 3, 2, 2, 0, 0)),
    '14x54': ((20, 12, 6, 4, 2, 1), (8, 3, 2, 2, 0, 0)),
    '19x59': ((40, 24, 15, 8, 6, 3), (35, 20, 12, 6, 6, 2)),
    '19x79': ((40, 24, 15, 8, 6, 3), (35, 20, 12, 6, 6, 2)),
}
R['AT31'] = 'Contraforte dobrado com 4 ramos: barras que cabem em CADA bloco, no furo comum, do lado de fora do ramo do meio (15 mm de graute, espera ao lado).'; R['AT31'].font = fB
for j, h_ in enumerate(['Montagem', 'Posição'] + list(MONT_PHI)):
    c = R.cell(row=32, column=46 + j, value=h_); c.font = fH; c.fill = NAVY; c.border = BOX; c.alignment = Alignment(horizontal='center')
for i, (ch, *_resto) in enumerate(MONT_CF):
    for blk, ns in ((33, MONT_N4D[ch][0]), (37, MONT_N4D[ch][1])):
        R.cell(row=blk + i, column=46, value=ch).font = fN
        R.cell(row=blk + i, column=47, value='enterrado' if blk == 33 else 'aparente').font = fN
        for k, v in enumerate(ns):
            c = R.cell(row=blk + i, column=48 + k, value=v); c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center')
for nm_, rg in (('mont_n4dE', '$AV$33:$BA$36'), ('mont_n4dA', '$AV$37:$BA$40')):
    wb.defined_names[nm_] = DefinedName(nm_, attr_text=f"'Referências'!{rg}")
for _cc, _w in (('AT', 10), ('AU', 9), ('AV', 9), ('AW', 11), ('AX', 11), ('AY', 13), ('AZ', 13), ('BA', 9)):
    R.column_dimensions[_cc].width = _w

# Libânio (rows 112-149)
R['A112'] = 'Libânio (Bares 1972, adaptado por L. M. Pinheiro). γ = h/l (h = vertical, direção em que a carga varia). m = μ·p·l²/100; flecha a = α/100·p·l⁴/(E·t³). Laranja = suspeita de digitação na fonte (mantido como está).'
R['A112'].font = fB
blocks = [('Triangular — laterais apoiadas (Tipo 21)', 'lib_TA'), ('Triangular — laterais engastadas (Tipo 22)', 'lib_TE'),
          ('Uniforme — laterais apoiadas (Tipo 9)', 'lib_UA'), ('Uniforme — laterais engastadas (Tipo 10)', 'lib_UE')]
subh = ['μx', "μ'x", 'μy', 'μyb', "μ'y", "μ'yb", 'α', 'αB']
R.cell(row=114, column=1, value='γ').font = fH; R.cell(row=114, column=1).fill = NAVY
for b_, (tit_, nm_) in enumerate(blocks):
    c0 = 2 + 8 * b_
    R.cell(row=113, column=c0, value=tit_).font = fB
    for j, h_ in enumerate(subh):
        c = R.cell(row=114, column=c0 + j, value=h_); c.font = fH; c.fill = NAVY; c.alignment = Alignment(horizontal='center')
    wb.defined_names[nm_] = DefinedName(nm_, attr_text=f"'Referências'!${_gl(c0)}$115:${_gl(c0 + 7)}$149")
wb.defined_names['lib_g'] = DefinedName('lib_g', attr_text="'Referências'!$A$115:$A$149")
for i in range(35):
    tr, ta, un, ua = LIB['tri'][i + 1], LIB['tri_a'][i + 1], LIB['uni'][i + 1], LIB['uni_a'][i + 1]
    rows4 = [tr[1:5] + [0, 0] + [ta[5], ta[6]], tr[5:11] + [ta[7], ta[8]], un[1:5] + [0, 0] + [ua[5], ua[6]], un[5:11] + [ua[7], ua[8]]]
    rr = 115 + i
    c = R.cell(row=rr, column=1, value=tr[0]); c.font = fB; c.border = BOX; c.number_format = '0.00'
    for b_, vals in enumerate(rows4):
        for j, v in enumerate(vals):
            c = R.cell(row=rr, column=2 + 8 * b_ + j, value=v); c.font = fN; c.border = BOX; c.number_format = '0.00'
# suspeitas: tri Tipo 22 μ'x γ1,10; uni Tipo 9 μy γ1,35; uni Tipo 10 μ'yb γ1,15; uni Tipo 9 α γ1,75
for (blk, col, g) in [(1, 1, 1.10), (2, 2, 1.35), (3, 5, 1.15), (2, 6, 1.75)]:
    rr = 115 + round((g - 0.30) / 0.05)
    R.cell(row=rr, column=2 + 8 * blk + col).fill = SUS
R['A150'] = 'Suspeitas (dedução nossa, conferir no PDF do Libânio): Tipo 22 μ\'x em γ 1,10 (3,50; vizinhos 3,52 e 3,67); Tipo 9 μy em γ 1,35 (7,55); Tipo 10 μ\'yb em γ 1,15 (6,49; vizinhos 8,50 e 8,48); Tipo 9 α em γ 1,75 (12,23; vizinhos 11,01 e 11,44). O PDF traz os mesmos valores. γ = 1,0 tem quebra natural (troca de eixo da tabela).'
R['A150'].font = fS
# fgk na tabela 3.2 (coluna K) — valores da planilha 01 do curso (concreto)
c = R['K4']; c.value = 'fgk'; c.font = fH; c.fill = NAVY; c.alignment = Alignment(horizontal='center')
for i, v in enumerate([15, 15, 15, 20, 20, 25, 25, 30, 30, 35, 35, 40]):
    c = R[f'K{5+i}']; c.value = v; c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center')

# ---------------- Aba Contrafortes ----------------
C = wb.create_sheet('Contrafortes', 6)
title(C, 'Muro com contrafortes — contraforte e painel',
      'Contraforte = balanço engastado na base com a carga da área de influência. Painel = placa com base engastada (sapata corrida), topo livre e laterais nos contrafortes (tabelas de Libânio).')
header(C, 3, ['Item', 'Valor', 'Unid.', 'Observação', 'Fonte'])
r = 4
def Lc(label, f, unit='', note='', kind='res', fmt=None, nm=None, src=None):
    global r
    line(C, r, label, f, unit, note, kind, fmt, nm, src); r += 1

def fphi(ph):
    return f'IF({ph}=INT({ph}),FIXED({ph},0),FIXED({ph},1))'

Lc('Tipo de muro nas Entradas', '=IF(Tipo_muro="Contrafortes","Contrafortes — esta é a aba de cálculo","Balanço — esta aba calcula, mas o muro escolhido é em balanço")', '', '', 'key')
r += 1
section(C, r, '1. Carga no contraforte (área de influência)'); r += 1
# Daqui para baixo tudo lê o eixo a eixo e o comprimento ADOTADOS (na grade do bloco, Entradas): a memória calcula o
# mesmo contraforte que o 3D desenha (decisão do Jose). Com os valores das listas das Entradas, adotado = digitado.
Lc('Espaçamento entre contrafortes (eixo a eixo)', '=l_cf_adot', 'm', 'Adotado no módulo do bloco (Entradas).', 'res', '0.00')
Lc('Largura de influência', '=IF(LEFT(tipo_cf,5)="Inter",l_cf_adot,l_cf_adot/2+bal_cf)', 'm', 'Intermediário = l; extremidade = l/2 + balanço do muro além do contraforte.', 'res', '0.00', 'binf', 'Critério adotado (área de influência)')
Lc('Carga na base = σh,base·largura', '=sh_base*binf', 'kN/m', '', 'res', '0.00', 'q_cf')
Lc('Mk na base do contraforte', '=Mk_*binf+Mk_wcf', 'kN·m', 'Mk por metro (aba Solo e Empuxo) × largura + vento (aba Muro de cima e vento; zero sem vento).', 'res', '0.00', 'Mk_cf')
Lc('Vk na base do contraforte', '=Vk_*binf+Vk_wcf', 'kN', '', 'res', '0.00', 'Vk_cf')
Lc('Md = γf·Mk', '=gama_f*Mk_cf', 'kN·m', '', 'key', '0.00', 'Md_cf')
Lc('Vd = γf·Vk', '=gama_f*Vk_cf', 'kN', '', 'key', '0.00', 'Vd_cf')
r += 1
section(C, r, '2. Esbeltez da parede com enrijecedores'); r += 1
Lc('eenr (espessura do contraforte)', '=IF(dob_cf=1,2*t_bloco+1,t_bloco)', 'cm', 'Simples: a largura do bloco. Dobrado (intermediário): 2t + 1 (seção 18).', 'res', '0.0', 'eenr')
Lc('lenr/eenr', '=l_cf_adot*100/eenr', '', '', 'res', '0.000', 'r_le')
Lc('tenr/t', '=tenr_adot/t_bloco', '', '', 'res', '0.000', 'r_tt')
Lc('lenr/eenr limitado (6 a 20)', '=MIN(20,MAX(6,r_le))', '', '', 'res', '0.000', 'xl_d')
Lc('tenr/t limitado (1 a 3)', '=MIN(3,MAX(1,r_tt))', '', '', 'res', '0.000', 'yl_d')
Lc('linha i da tabela', '=MATCH(xl_d,delta_le,1)', '', '', 'res', '0', 'i_dl')
Lc('coluna j da tabela', '=MIN(3,INT(yl_d))', '', '', 'res', '0', 'j_dl')
Lc('tx', '=IF(i_dl>=5,0,(xl_d-INDEX(delta_le,i_dl))/(INDEX(delta_le,i_dl+1)-INDEX(delta_le,i_dl)))', '', '', 'res', '0.000', 'tx_dl')
Lc('ty', '=IF(j_dl>=3,0,yl_d-j_dl)', '', '', 'res', '0.000', 'ty_dl')
Lc('δ', '=(1-tx_dl)*((1-ty_dl)*INDEX(delta_tab,i_dl,j_dl)+ty_dl*INDEX(delta_tab,i_dl,MIN(3,j_dl+1)))+tx_dl*((1-ty_dl)*INDEX(delta_tab,MIN(5,i_dl+1),j_dl)+ty_dl*INDEX(delta_tab,MIN(5,i_dl+1),MIN(3,j_dl+1)))', '', 'Interpolação bilinear.', 'key', '0.000', 'delta_e', 'NBR 16868-1 9.4.2 (Tab. 8)')
Lc('te = δ·t', '=delta_e*t_bloco', 'cm', 'Só para esbeltez.', 'res', '0.00', 'te_cf')
Lc('he', '=he_', 'm', 'Mesmo critério da aba Muro em balanço (sem travamento: 2h).', 'res', '0.00')
Lc('λ = he/te', '=he_*100/te_cf', '', 'Armada ≤ 30.', 'key', '0.0', 'lam_cf')
r += 1
section(C, r, '3. Seção do contraforte'); r += 1
Lc('Tipo de seção', '=IF(LEFT(pos_cf,4)="Ente","T — muro comprimido (contraforte do lado do solo)","Retangular — muro tracionado (contraforte do lado de fora)")', '', 'Enterrado → T; aparente → retangular.', 'key', None, None, 'Critério adotado')
Lc('Seção T? (1 = sim)', '=IF(LEFT(pos_cf,4)="Ente",1,0)', '', '', 'res', '0', 'cf_T')
Lc('h = tenr (comprimento do contraforte, com o muro)', '=tenr_adot', 'cm', '', 'res', '0.0', 'h_cf')
Lc('bw = eenr', '=eenr', 'cm', '', 'res', '0.0', 'bw_cf')
# Posição da barra pela MONTAGEM (templates do Revit, tabela nas colunas AT–BA das Referências), não mais eenr/2: no
# bloco 14 o furo da ponta fica a 9,5 cm do fim, e "barra no meio do bloco" dava d 2,5 cm maior do que a peça permite
# (contraforte de 34: 27 × 24,5). Contraforte fora das montagens do Revit (só por valor digitado fora da lista): a 1ª
# linha do mesmo bloco — com a regra da haste (inteiros a partir do muro, meio na ponta) o furo da ponta é o mesmo.
Lc('Linha da montagem (Referências, colunas AT–BA)', '=IFERROR(MATCH(t_bloco&"x"&tenr_adot,mont_ch,0),MATCH(t_bloco,mont_t,0))', '', 'Bloco × comprimento do contraforte.', 'res', '0', 'k_mont')
Lc('c da montagem (face tracionada → eixo das barras)', '=IF(cf_T=1,INDEX(mont_cE,k_mont),INDEX(mont_cA,k_mont))', 'cm', 'Medido no template do Revit: centro do trecho comum aos furos das fiadas P e I. Enterrado: da ponta; aparente: da face do solo (espelho do template — dedução).', 'key', '0.0', 'c_mont', 'Montagens do Revit (medido)')
Lc('Cobrimento ao eixo das barras (da face tracionada)', '=IF(ISNUMBER(c_cf_dir),c_cf_dir,c_mont)', 'cm', 'Entradas; em branco = c da montagem.', 'res', '0.0', 'c_cf')
Lc('d', '=h_cf-c_cf', 'cm', '', 'key', '0.0', 'd_cf')
Lc('Aba de cada lado bf ≤ 6t', '=MIN(6*t_bloco,(l_cf_adot*100-IF(dob_o=1,2*t_bloco+1,bw_cf))/2)', 'cm', 'Lado do vão (limitada à metade do vão livre; vizinho dobrado: o vão livre até ele).', 'res', '0.0', 'bf_a')
Lc('Aba do outro lado', '=IF(LEFT(tipo_cf,5)="Inter",bf_a,MIN(6*t_bloco,bal_cf*100))', 'cm', 'Extremidade: limitada ao balanço do muro.', 'res', '0.0', 'bf_b')
Lc('bm (largura colaborante)', '=IF(cf_T=1,MIN(bw_cf+bf_a+bf_b,H_muro*100/3),bw_cf)', 'cm', 'bm ≤ bw + 2·6t e ≤ altura do muro/3.', 'key', '0.0', 'bm_cf', 'NBR 16868-1 11.3.4 e 10.1.3')
Lc('hf (mesa = espessura do muro)', '=IF(cf_T=1,t_bloco,0)', 'cm', '', 'res', '0.0', 'hf_cf')
r += 1
section(C, r, '4. Materiais'); r += 1
Lc('fpk do bloco vazado (bruto)', '=fpk_oco', 'MPa', 'Tab. 3.2 pelo fbk.', 'res', '0.00')
Lc('fpk* (prisma cheio)', '=fpk_chei', 'MPa', '', 'res', '0.00')
Lc('fpk da flexão do contraforte', '=IF(cf_T=1,fpk_oco,fpk_chei)', 'MPa', 'T: compressão na mesa (muro sem graute) → fpk vazado; retangular: ponta grauteada → fpk*.', 'key', '0.00', 'fpk_cf', 'Critério adotado')
Lc('K', '=IF(ISNUMBER(K_cf),K_cf,IF(cf_T=1,1.5,2))', '', 'Entradas; em branco = NBR (1,5 sem graute; 2,0 grauteado).', 'res', '0.00', 'K_cfu')
Lc('Kfd = K·0,7·fpk/γm', '=K_cfu*0.7*fpk_cf/gama_m', 'MPa', '', 'res', '0.000', 'Kfd_cf')
Lc('fsd da barra principal', '=fyk_/gama_s', 'MPa', 'Bloco de concreto: fsd = fyd.', 'res', '0.0', 'fsd_cf', 'NBR 16868-1 11.3.3')
r += 1
section(C, r, '5. Flexão do contraforte'); r += 1
Lc('Md/(0,5·bm·d²·Kfd)', '=Md_cf*100/(0.5*bm_cf*d_cf^2*Kfd_cf/10)', '', 'Se ≥ 1 a seção não resiste.', 'res', '0.000', 'arg_cf')
Lc('x (compressão dentro da largura bm)', '=IF(arg_cf<1,1.25*d_cf*(1-SQRT(1-arg_cf)),"não resiste")', 'cm', '', 'res', '0.00', 'x_cfr', 'ABCP 3.4')
Lc('Bloco 0,8x cabe na mesa?', '=IF(cf_T=0,"— (seção retangular)",IF(ISNUMBER(x_cfr),IF(0.8*x_cfr<=hf_cf,"Sim — calcula como retangular bm × d","Não — calcula como T (mesa + alma)"),"—"))', '', '', 'res')
Lc('Cf = Kfd·(bm − bw)·hf (abas da mesa)', '=Kfd_cf/10*(bm_cf-bw_cf)*hf_cf', 'kN', 'Só entra se o bloco 0,8x passar da mesa.', 'res', '0.00', 'Cf_cf')
Lc('x na alma (seção T)', '=IF(AND(cf_T=1,ISNUMBER(x_cfr)),IF(0.8*x_cfr>hf_cf,IFERROR(1.25*d_cf*(1-SQRT(1-(Md_cf*100-Cf_cf*(d_cf-hf_cf/2))/(0.5*bw_cf*d_cf^2*Kfd_cf/10))),"não resiste"),"— (não precisa)"),"—")', 'cm', 'Só quando o bloco 0,8x passa da mesa.', 'res', '0.00', 'x_cfw')
Lc('Caso T além da mesa? (1 = sim)', '=IF(AND(cf_T=1,ISNUMBER(x_cfr)),IF(0.8*x_cfr>hf_cf,1,0),0)', '', '', 'res', '0', 'cf_TT')
Lc('x adotado', '=IF(cf_TT=1,x_cfw,x_cfr)', 'cm', '', 'key', '0.00', 'x_cf')
Lc('x/d', '=IFERROR(x_cf/d_cf,"—")', '', 'Limite 0,45. x23 = 3/13·d; xduc = 0,45d.', 'res', '0.000', 'xd_cf')
Lc('z = d − 0,4x ≤ 0,95d', '=IFERROR(MIN(d_cf-0.4*x_cf,0.95*d_cf),"—")', 'cm', '', 'res', '0.00', 'z_cf')
Lc('As do momento', '=IF(Md_cf<=0,0,IF(cf_TT=1,(Cf_cf+Kfd_cf/10*bw_cf*0.8*x_cfw)/(fsd_cf/10),Md_cf*100/(fsd_cf/10*z_cf)))', 'cm²', '', 'key', '0.00', 'As_cfn', 'NBR 16868-1 11.3.4 / ABCP 3.4')
Lc('As,mín', '=IF(LEFT(AsMin_crit,4)="Viga",0.0015*bw_cf*d_cf,0.001*bw_cf*h_cf)', 'cm²', 'Viga: 0,15%·bw·d; Parede: 0,10%·bw·h (Entradas).', 'res', '0.00', 'As_cfm', 'NBR 16868-1 12.2')
Lc('As de cálculo', '=MAX(As_cfn,As_cfm)', 'cm²', '', 'key', '0.00', 'As_cfc')
Lc('Área de uma barra (Ø das Entradas)', '=PI()*phi_cf^2/400', 'cm²', '', 'res', '0.000', 'a_cf')
Lc('Nº de barras', '=IF(dob_cf=1,IF(ISNUMBER(n_cf_dir),MAX(4,2*ROUNDUP(n_cf_dir/2,0)),MAX(4,2*ROUNDUP(ROUNDUP(As_cfc/a_cf-0.005,0)/2,0))),IF(ISNUMBER(n_cf_dir),n_cf_dir,MAX(2,ROUNDUP(As_cfc/a_cf-0.005,0))))', '', 'Entradas ou automático (mínimo 2). Dobrado: par, metade em cada bloco, no mínimo 2 em cada (4); ímpar digitado → o par de cima.', 'key', '0', 'n_cf')
Lc('As efetiva', '=n_cf*a_cf', 'cm²', '', 'res', '0.00', 'As_cfe')
Lc('As,máx no furo da ponta', '=IF(dob_cf=1,2*pAs_max*Ag_furo,pAs_max*Ag_furo)', 'cm²', '8% da área de graute, contando o traspasse. Dobrado: dois furos na ponta.', 'res', '0.00', 'As_cfx', 'NBR 16868-1 12.3')
Lc('As no furo para comparar (com traspasse no concreto)', '=As_cfe*f_trasp', 'cm²', '2× (região de traspasse).', 'res', '0.00', 'As_cfx2')
# O furo REAL onde a barra passa (montagem do Revit): só INFORMA. A régua do As,máx continua a do curso (linha acima,
# com o Ag da tabela da aula, e a verificação da seção 15) — decisão do Jose (09/10): nenhuma verificação nova.
Lc('Furo comum da barra (fiadas P e I): área', '=IF(cf_T=1,INDEX(mont_AE,k_mont),INDEX(mont_AA,k_mont))', 'cm²', 'Montagem do Revit. Só informa.', 'res', '0.00', 'A_fcm', 'Montagens do Revit (medido)')
Lc('Barras do Ø das Entradas que cabem no furo comum', '=IF(dob_cf=1,2,1)*IF(cf_T=1,INDEX(mont_nE,k_mont,MATCH(phi_cf,mont_phi,0)),INDEX(mont_nA,k_mont,MATCH(phi_cf,mont_phi,0)))', '', '15 mm de graute até o bloco, espera ao lado (emenda). Dobrado: os dois furos da ponta. Só informa.', 'res', '0', 'nb_cab', 'NBR 16868-1 12.1 (graute 15 mm)')
Lc('Barras do Ø das Entradas pela taxa de 8% do furo comum, com traspasse', '=IF(dob_cf=1,2*INT(pAs_max*A_fcm/(f_trasp*a_cf)),INT(pAs_max*A_fcm/(f_trasp*a_cf)))', '', 'Dobrado: os dois furos da ponta. Só informa.', 'res', '0', 'nb_tx')
r += 1
_hyp_r = r
C.cell(row=r, column=1, value='Hipóteses de bitola (nº de barras para o As de cálculo; o que cabe no furo comum só informa)').font = fB; r += 1
header(C, r, ['Ø (mm)', 'As nec. (cm²)', 'Nº barras', 'As efetiva (cm²)', 'Cabem no furo comum (15 mm)', 'Pela taxa de 8% do furo comum']); r += 1
for ph in (10, 12.5, 16, 20):
    C.cell(row=r, column=1, value=ph)
    C.cell(row=r, column=2, value='=IFERROR(As_cfc,"—")')
    C.cell(row=r, column=3, value=f'=IFERROR(IF(dob_cf=1,MAX(4,2*ROUNDUP(ROUNDUP(B{r}/(PI()*A{r}^2/400)-0.005,0)/2,0)),MAX(2,ROUNDUP(B{r}/(PI()*A{r}^2/400)-0.005,0))),"—")')
    C.cell(row=r, column=4, value=f'=IFERROR(C{r}*PI()*A{r}^2/400,"—")')
    C.cell(row=r, column=5, value=f'=IFERROR(IF(dob_cf=1,2,1)*IF(cf_T=1,INDEX(mont_nE,k_mont,MATCH(A{r},mont_phi,0)),INDEX(mont_nA,k_mont,MATCH(A{r},mont_phi,0))),"—")')
    C.cell(row=r, column=6, value=f'=IFERROR(IF(dob_cf=1,2*INT(pAs_max*A_fcm/(f_trasp*PI()*A{r}^2/400)),INT(pAs_max*A_fcm/(f_trasp*PI()*A{r}^2/400))),"—")')
    for cc, fm in zip('ABCDEF', ['0.0', '0.00', '0', '0.00', '0', '0']):
        c = C[f'{cc}{r}']; c.number_format = fm; c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center'); c.fill = RES
    r += 1
r += 1
section(C, r, '6. Cisalhamento do contraforte'); r += 1
Lc('ρ = As,ef/(bw·d) ≤ 2%', '=MIN(As_cfe/(bw_cf*d_cf),0.02)', '', '', 'res', '0.000000', 'rho_cf')
Lc('fvk = 0,35 + 17,5ρ ≤ 0,7', '=MIN(0.35+17.5*rho_cf,0.7)', 'MPa', '', 'res', '0.000', 'fvk_cf', 'NBR 16868-1 6.2.2.6')
Lc('fvd = fvk/γm', '=fvk_cf/gama_m', 'MPa', '', 'res', '0.000', 'fvd_cf')
Lc('τvd = Vd/(bw·d)', '=Vd_cf/(bw_cf*d_cf)*10', 'MPa', '', 'res', '0.000', 'tau_cf')
Lc('Va = fvd·bw·d', '=fvd_cf/10*bw_cf*d_cf', 'kN', '', 'res', '0.00', 'Va_cf')
Lc('Vrd2 = Va + 0,4·bw·d·√fpk*/γm', '=Va_cf+0.4*bw_cf*d_cf*SQRT(fpk_chei)/gama_m/10', 'kN', 'Alma grauteada → fpk*.', 'key', '0.00', 'Vrd2_cf', 'NBR 16868-1 11.4.3')
Lc('fywd', '=fyk_/gama_s', 'MPa', '', 'res', '0.0', 'fywd')
Lc('Asw/s necessário = (Vd − Va)/(0,75·fywd·d)', '=MAX(0,(Vd_cf-Va_cf)/(0.75*fywd/10*d_cf)*100)', 'cm²/m', '', 'res', '0.00', 'Asw_n')
Lc('fgk do graute', '=fgk_', 'MPa', 'Entradas ou tabela pelo fbk.', 'res', '0.0')
Lc('ρw,mín (0,07% em fgk 15 a 0,14% em fgk 40)', '=MIN(0.14,MAX(0.07,0.07+(fgk_-15)*0.07/25))', '%', '', 'res', '0.000', 'rhow_cf', 'NBR 16868-1 12.2')
Lc('Asw,mín = ρw·bw', '=rhow_cf/100*bw_cf*100', 'cm²/m', '', 'res', '0.00', 'Asw_m')
Lc('Asw/s de cálculo', '=IF(dob_cf=1,MAX(Asw_n,Asw_m),IF(Vd_cf<=Va_cf,0,MAX(Asw_n,Asw_m)))', 'cm²/m', 'Zero se Vd ≤ Va (dispensa estribo pela conta). Dobrado: nunca zero (o estribo é a ligação dos dois blocos).', 'key', '0.00', 'Asw_c')
Lc('Ø necessário com os ramos e o espaçamento das Entradas', '=SQRT(s_est_u*4*Asw_c/100/(ram_ef*PI()))*10', 'mm', 'Ramos que a conta usa (abaixo); espaçamento usado (dobrado: 20).', 'res', '0.0', 'phi_wn')
# Estribo só quando a conta pede (Jose, 13/10; planilha 05 do Carini: "Dispensa Estribos" se fvd ≥ τvd, que é o
# mesmo Vd ≤ Va daqui; o mínimo ρw·bw só vale do lado "com armadura"). Em alvenaria não se põe estribo sem
# necessidade: com Asw_c = 0 o muro sai SEM estribo — Asw,ef, Vrd3 = Va, nº de estribos 0 — e o app não desenha nenhum.
Lc('Asw/s efetivo', '=IF(Asw_c=0,0,ram_ef*PI()*phi_est^2/400/s_est_u*100)', 'cm²/m', 'Zero sem estribo (dispensa pela conta). Com os ramos que cabem (abaixo).', 'res', '0.00', 'Asw_e')
Lc('Vrd3 = Va + 0,75·fywd·d·Asw/s', '=Va_cf+0.75*fywd/10*d_cf*Asw_e/100', 'kN', '', 'res', '0.00', 'Vrd3_cf')
Lc('Estribo fechado (sugestão): largura × altura', '=IF(Asw_c=0,"Sem estribo (dispensa pela conta)",FIXED(eenr-7,0)&" × "&FIXED(h_cf-9,0)&" cm")', '', 'Largura = eenr − 7; altura = tenr − 9.', 'res')
Lc('Perímetro do estribo (sem ganchos)', '=IF(Asw_c=0,0,2*((eenr-7)+(h_cf-9)))', 'cm', 'Somar os ganchos do detalhe.', 'res', '0')
Lc('Nº de estribos na altura', '=IF(Asw_c=0,0,ROUNDUP(H_muro*100/s_est_u,0))', '', 'Um por junta de assentamento a cada s, na altura do muro; zero sem estribo (dispensa pela conta).', 'res', '0', 'n_est')
# 4 RAMOS = DOIS ESTRIBOS MENORES SOBREPOSTOS (Jose, 15/11: "3 ramos não existe; 4 são 2 estribos menores — no
# Pró-Viga tem um modelo quando a viga tem uma base grande"). A regra do Pró-Viga (viewer3d.js, estribo duplo): cada
# estribo tem 2/3 da largura do de 2 ramos e fica deslocado ±1/6 dela — os quatro ramos a cada 1/3, os ganchos no
# canto de FORA de cada um. Aqui a largura do de 2 ramos é eenr − 7 (o eixo a 3,5 cm das faces, linha acima), o
# mesmo estribo que o app desenha (modulacao/armaduras.ts). Só se conta o aço que se monta: os dois estribos têm de
# caber, senão a conta fica com 2 ramos e a verificação "Estribo: 4 ramos cabem no contraforte" reprova dizendo.
# Duas condições (DEDUÇÃO, as medidas que o app desenha):
#   · o gancho de 135° do estribo menor: a ponta sai do canto a 45° e vai até encostar no ramo do outro lado
#     (barras.ts, medidasDoEstribo) — tem de chegar a 5φ ≥ 5 cm (NBR 6118 9.4.6.1), com o pino 3φ (Tab. 9.2);
#   · o ramo do meio (a 1/6 da largura do eixo do contraforte) não passa sobre as barras principais nem sobre as
#     esperas delas: as n_cf barras cabem no furo comum dentro da faixa entre os dois ramos do meio (tabela
#     mont_n4E/A da aba Referências, como a das barras que cabem) — a espera vai até o traspasse, e o 1º estribo fica
#     na junta sobre a sapata. As construtivas, do lado do muro, o 3D arruma na mesma faixa (na fila, no eixo).
Lc('4 ramos: largura de cada estribo (dois sobrepostos)', '=2*(eenr-7)/3', 'cm', 'De eixo a eixo dos ramos: 2/3 da largura do estribo de 2 ramos, deslocados ±1/6 (ramos a cada 1/3).', 'res', '0.00', 'w4_est', 'Critério adotado (estribo duplo)')
Lc('4 ramos: raio da dobra no eixo (pino 3φ)', '=(3*phi_est/2+phi_est/2)/10', 'cm', '', 'res', '0.00', 'rd4_est', 'NBR 6118 Tab. 9.2')
Lc('4 ramos: ponta do gancho de 135° que cabe no estribo menor', '=(w4_est-phi_est/10-(1+SQRT(2)/2)*rd4_est)/(SQRT(2)/2)', 'cm', 'Do canto, a 45°, até encostar no ramo do outro lado.', 'res', '0.00', 'pg4_est')
Lc('Ponta do gancho de 135° exigida = 5φ ≥ 5 cm', '=MAX(5*phi_est/10,5)', 'cm', '', 'res', '0.00', 'pgn_est', 'NBR 6118 9.4.6.1')
Lc('4 ramos: barras do Ø das Entradas que cabem entre os ramos do meio', '=IF(cf_T=1,INDEX(mont_n4E,k_mont,MATCH(phi_cf,mont_phi,0)),INDEX(mont_n4A,k_mont,MATCH(phi_cf,mont_phi,0)))', '', 'Furo comum, 15 mm de graute, espera ao lado; nenhuma barra sobre os ramos do meio. Montagens do Revit.', 'res', '0', 'nb4_cab', 'Montagens do Revit (medido)')
Lc('Ramos que a conta usa', '=IF(dob_cf=1,IF(pd4_est=1,IF(AND(pg4_est>=pgn_est-0.005,n_cf/2<=nb4d_cab),4,2),2),IF(ramos_est=4,IF(AND(pg4_est>=pgn_est-0.005,n_cf<=nb4_cab),4,2),IF(ramos_est>0,2,ramos_est)))', '', '4 só se os dois estribos couberem; senão 2. Dobrado: 4 (dois estribos abraçando os dois blocos) se pedido ou se 2 ramos c/20 não bastam (seção 18).', 'key', '0', 'ram_ef')
r += 1
section(C, r, '7. ELS do contraforte'); r += 1
Lc('Em = (Em/fpk)·fpk', '=Em_coef*fpk_cf', 'MPa', 'T: seção bruta ↔ fpk bruto.', 'res', '0', 'Em_cf', 'NBR 16868-1 6.2.1 (Tab. 1)')
Lc('n = Es/Em', '=210000/Em_cf', '', '', 'res', '0.00', 'n_cfe')
Lc('ftk ⊥ fiada', '=ftk_nor', 'MPa', '', 'res', '0.00')
Lc('Área bruta', '=IF(cf_T=1,(bm_cf-bw_cf)*hf_cf+bw_cf*h_cf,bw_cf*h_cf)', 'cm²', '', 'res', '0.0', 'A_cfg')
Lc('yCG (da face comprimida)', '=IF(cf_T=1,((bm_cf-bw_cf)*hf_cf^2/2+bw_cf*h_cf^2/2)/A_cfg,h_cf/2)', 'cm', '', 'res', '0.00', 'y_cfg')
Lc('Ig', '=IF(cf_T=1,(bm_cf-bw_cf)*hf_cf^3/12+(bm_cf-bw_cf)*hf_cf*(y_cfg-hf_cf/2)^2+bw_cf*h_cf^3/12+bw_cf*h_cf*(h_cf/2-y_cfg)^2,bw_cf*h_cf^3/12)', 'cm⁴', '', 'res', '0', 'Ig_cf')
Lc('Mr = ftk·Ig/yt (yt = h − yCG)', '=ftk_nor/10*Ig_cf/(h_cf-y_cfg)', 'kN·cm', '', 'key', '0.0', 'Mr_cf')
Lc('Ma = (Ma/Mk)·Mk', '=psi_els*(Mk_cf-Mk_wcf)*100', 'kN·cm', '', 'key', '0.0', 'Ma_cf')
Lc('b da compressão no estádio II', '=IF(cf_T=1,bm_cf,bw_cf)', 'cm', '', 'res', '0.0', 'b2_cf')
# LN e III em pedaços, como no balanço (aba ELS): B e C em linha própria; III = alvenaria + abas + barra
Lc('B = n·As', '=n_cfe*As_cfe', 'cm²', 'LN: b·x²/2 + B·x − C = 0 → x = (−B + √(B² + 2·b·C))/b.', 'res', '0.00', 'lnB_cf')
Lc('C = n·As·d', '=n_cfe*As_cfe*d_cf', 'cm³', '', 'res', '0.00', 'lnC_cf')
Lc('x supondo LN na mesa', '=(-lnB_cf+SQRT(lnB_cf^2+2*b2_cf*lnC_cf))/b2_cf', 'cm', '', 'res', '0.00', 'x2r_cf')
Lc('B com a LN na alma = (bm − bw)·hf + B', '=(bm_cf-bw_cf)*hf_cf+lnB_cf', 'cm²', 'Seção retangular (aparente): bm = bw e hf = 0, igual ao B.', 'res', '0.00', 'lnBw_cf')
Lc('C com a LN na alma = (bm − bw)·hf²/2 + C', '=(bm_cf-bw_cf)*hf_cf^2/2+lnC_cf', 'cm³', '', 'res', '0.00', 'lnCw_cf')
Lc('x supondo LN na alma (T)', '=IF(cf_T=1,(-lnBw_cf+SQRT(lnBw_cf^2+2*bw_cf*lnCw_cf))/bw_cf,x2r_cf)', 'cm', '', 'res', '0.00', 'x2t_cf')
Lc('x adotado (estádio II)', '=IF(OR(cf_T=0,x2r_cf<=hf_cf),x2r_cf,x2t_cf)', 'cm', '', 'res', '0.00', 'x2_cf')
Lc('III da alvenaria comprimida = b·x³/3', '=IF(OR(cf_T=0,x2r_cf<=hf_cf),b2_cf,bw_cf)*x2_cf^3/3', 'cm⁴', 'b da compressão com a LN na mesa (ou seção retangular); bw com a LN na alma.', 'res', '0', 'IIc_cf')
Lc('III das abas da mesa', '=IF(OR(cf_T=0,x2r_cf<=hf_cf),0,(bm_cf-bw_cf)*hf_cf^3/12+(bm_cf-bw_cf)*hf_cf*(x2_cf-hf_cf/2)^2)', 'cm⁴', 'Só com a LN na alma: (bm − bw)·hf³/12 + (bm − bw)·hf·(x − hf/2)².', 'res', '0', 'IIf_cf')
Lc('III da barra = n·As·(d − x)²', '=n_cfe*As_cfe*(d_cf-x2_cf)^2', 'cm⁴', 'Armadura comprimida (construtivas) desprezada (a favor da segurança).', 'res', '0', 'IIs_cf')
Lc('III', '=IIc_cf+IIf_cf+IIs_cf', 'cm⁴', 'Alvenaria comprimida + abas + barra.', 'res', '0', 'III_cf')
Lc('Ieq (Branson) ≤ Ig', '=IF(Ma_cf<=Mr_cf,Ig_cf,MIN(Ig_cf,(Mr_cf/Ma_cf)^3*Ig_cf+(1-(Mr_cf/Ma_cf)^3)*III_cf))', 'cm⁴', '', 'key', '0', 'Ieq_cf')
Lc('heq (retângulo b × heq, para o Ftool)', '=(12*Ieq_cf/b2_cf)^(1/3)', 'cm', '', 'key', '0.00', 'heq_cf')
Lc('σs = n·Ma·(d − x)/III', '=n_cfe*Ma_cf*(d_cf-x2_cf)/III_cf', 'kN/cm²', '', 'res', '0.00')
Lc('δ0 = (Ma/Mk)·Σ·largura/(Em·Ieq)', '=psi_els*sum_d*binf/(Em_cf*1000*Ieq_cf/100000000)*1000', 'mm', 'Mesmo perfil de carga da aba Solo e Empuxo (igual ao Ftool).', 'key', '0.00', 'd0_cf')
Lc('δ∞ = δ0·(1 + Δξ)', '=d0_cf*(1+dxi)', 'mm', "ρ' = 0 (a favor da segurança).", 'key', '0.00', 'dinf_cf')
Lc('δadm', '=dadm_', 'mm', 'Balanço: 2L/250 (Entradas; critério adotado).', 'res', '0.00', 'dadm_cf')
r += 1
section(C, r, '8. Painel entre contrafortes — momentos (Libânio)'); r += 1
Lc('Vinculação', '="Base engastada (sapata corrida), topo livre, laterais "&IF(LEFT(lat_pan,4)="Apoi","apoiadas (Tipo 21 / 9)","engastadas (Tipo 22 / 10)")', '', '', 'key')
# PAINEL COM SOLO ABAIXO DO TOPO DO MURO (09/10). As tabelas de Libânio supõem a carga na altura toda da placa. A placa
# é o MURO (base engastada, topo livre no topo do muro): h = h muro. A carga real só existe até h solo. Caminho
# adotado — DEDUÇÃO nossa, a favor da segurança e sem tabela nova: o triângulo vai de 0 no topo do MURO a
# (σh,base − σh,topo) na base, e a parcela uniforme σh,topo (sobrecarga) vale na altura toda. Em qualquer altura y da
# base esse carregamento é ≥ o real: sem água, Ka·γ·hs·(1 − y/hm) ≥ Ka·γ·(hs − y) porque hm ≥ hs, e acima do solo o
# real é zero. Com água ou coesão o perfil real cresce mais depressa embaixo (curva convexa) e fica abaixo da reta
# topo–base, que já era a hipótese de antes. As fórmulas são as mesmas; com h solo = h muro é o carregamento da aula 12.3.
Lc('l (vão entre contrafortes)', '=l_cf_adot', 'm', '', 'res', '0.00', 'l_p')
Lc('h', '=H_muro', 'm', 'Altura do muro (a placa vai até o topo do muro, borda livre).', 'res', '0.00', 'h_p')
Lc('γ = h/l', '=h_p/l_p', '', 'Tabela vai de 0,30 a 2,00.', 'res', '0.000', 'gam_p')
Lc('γ usado (limitado à tabela)', '=MIN(2,MAX(0.3,gam_p))', '', '', 'res', '0.000', 'gam_c')
Lc('l de referência = menor vão', '=MIN(h_p,l_p)', 'm', '', 'res', '0.00', 'lref_p')
Lc('Parcela triangular (σh,base − σh,topo)', '=MAX(0,sh_base-sh_topo)', 'kPa', 'Característica. Perfil tratado como linear entre topo e base. Com solo abaixo do topo do muro, o triângulo vai de 0 no topo do muro a este valor na base (dedução, a favor da segurança).', 'res', '0.00', 'p_tri')
Lc('Parcela uniforme (σh,topo)', '=sh_topo', 'kPa', 'Sobrecarga etc. (no topo do solo; aplicada na altura toda da placa).', 'res', '0.00', 'p_uni')
Lc('linha da tabela', '=MATCH(gam_c,lib_g,1)', '', '', 'res', '0', 'i_g')
Lc('t (interpolação)', '=IF(i_g>=35,0,(gam_c-INDEX(lib_g,i_g))/(INDEX(lib_g,i_g+1)-INDEX(lib_g,i_g)))', '', '', 'res', '0.000', 't_g')
_coef_r = r
header(C, r, ['Coeficiente', 'Triangular', 'Uniforme', '', '']); r += 1
_TT = 'CHOOSE(IF(LEFT(lat_pan,4)="Apoi",1,2),lib_TA,lib_TE)'
_TU = 'CHOOSE(IF(LEFT(lat_pan,4)="Apoi",1,2),lib_UA,lib_UE)'
_cn = {}
for k, lab in enumerate(subh, start=1):
    C.cell(row=r, column=1, value=lab).font = fN
    for col, T_ in (('B', _TT), ('C', _TU)):
        C[f'{col}{r}'] = f'=INDEX({T_},i_g,{k})+t_g*(INDEX({T_},MIN(35,i_g+1),{k})-INDEX({T_},i_g,{k}))'
        C[f'{col}{r}'].number_format = '0.0000'; C[f'{col}{r}'].fill = RES; C[f'{col}{r}'].font = fN; C[f'{col}{r}'].border = BOX
    _cn[lab] = r
    r += 1
def mom(lab):
    rr = _cn[lab]
    return f'gama_f*(B{rr}*p_tri+C{rr}*p_uni)*lref_p^2'
Lc('Mdx — horizontal, vão (← μy)', '=' + mom('μy'), 'kN·cm/m', '', 'key', '0.0', 'Mdx_p')
Lc('Mdxb — horizontal, borda livre (← μyb)', '=' + mom('μyb'), 'kN·cm/m', '', 'res', '0.0', 'Mdxb_p')
Lc('Mdy — vertical, vão (← μx)', '=' + mom('μx'), 'kN·cm/m', 'traciona a face externa', 'key', '0.0', 'Mdy_p')
Lc("Mdyei — vertical, engaste da base (← μ'x)", "=" + mom("μ'x"), 'kN·cm/m', 'traciona a face do solo', 'key', '0.0', 'Mdyei_p')
Lc("Mdxe — horizontal, engaste lateral (← μ'y)", "=" + mom("μ'y"), 'kN·cm/m', 'Só com laterais engastadas — traciona a face do solo junto ao contraforte.', 'res', '0.0', 'Mdxe_p')
Lc("Mdxeb — horizontal, engaste lateral na borda (← μ'yb)", "=" + mom("μ'yb"), 'kN·cm/m', '', 'res', '0.0', 'Mdxeb_p')
r += 1
section(C, r, '9. Painel — flexão vertical (barras nos furos)'); r += 1
# grauteamento do painel (13/10): total → seção cheia, prisma cheio (fpk*); parcial e alternado → seção I, como antes
Lc('fpk do painel', '=IF(gr_tot="Sim",fpk_chei,IF(LEFT(fpk_ref,4)="Líqu",fpk_oco/r_liq,fpk_oco))', 'MPa', 'Seção I → fpk líquido ou bruto (Entradas: área de referência); grauteamento total → seção cheia, fpk*.', 'res', '0.00', 'fpk_pn')
Lc('Kfd vertical = K·0,7·fpk/γm', '=K_pv*0.7*fpk_pn/gama_m', 'MPa', '', 'res', '0.000', 'Kfd_pv')
Lc('d vertical', '=IF(LEFT(pos_pv,1)="2",t_bloco-c_pv,t_bloco/2)', 'cm', '2 barras a c das faces → d = t − c; 1 barra centralizada → t/2.', 'key', '0.0', 'd_pv')
Lc('Momento para a barra do lado do solo', '=IF(LEFT(pos_pv,1)="2",Mdyei_p,MAX(Mdyei_p,Mdy_p))', 'kN·cm/m', '', 'res', '0.0', 'M_pvs')
Lc('Momento para a barra do lado externo', '=Mdy_p', 'kN·cm/m', '', 'res', '0.0', 'M_pve')
# = meio bloco m das Entradas (o 19 é sempre 39). Antes era (L + 1)/2 direto, que com 19 e 29 digitado dava 15.
Lc('Espaçamento dos furos', '=m_mod', 'cm', '29 → 15; 39 → 20. Faixas = múltiplos disso.', 'res', '0.0', 's_furo')
_LIST = (6.3, 8, 10, 12.5, 16, 20)
def arr_table(tag, d_nm, kfd_nm, mom_nm, bms, phi_nm, extra_d=None):
    """Tabela de arranjos: uma linha por faixa bm. Retorna (linha inicial, linha final)."""
    global r
    cols = ['bm (cm)', 'Md (kN·cm)', 'As com fyd (cm²)', 'As,mín (cm²)', 'Ø sugerido (mm)', 'Ø das Entradas atende?']
    if extra_d: cols.append(extra_d[0])
    header(C, r, cols); C.row_dimensions[r].height = 30; r += 1
    r0 = r
    for bm_ in bms:
        C[f'A{r}'] = f'={bm_}'
        C[f'B{r}'] = f'={mom_nm}*A{r}/100'
        _x = f'1.25*{d_nm}*(1-SQRT(1-B{r}/(0.5*A{r}*{d_nm}^2*{kfd_nm}/10)))'
        C[f'C{r}'] = f'=IFERROR(B{r}/(fyk_/gama_s/10*MIN({d_nm}-0.4*{_x},0.95*{d_nm})),"não resiste")'
        C[f'D{r}'] = f'=IF(LEFT(AsMin_crit,4)="Viga",0.0015*A{r}*{d_nm},0.001*A{r}*t_bloco)'
        # flags por bitola em colunas ocultas (L..Q)
        for j, ph in enumerate(_LIST):
            cl = _gl(12 + j)
            C[f'{cl}{r}'] = f'=IF(ISNUMBER(C{r}),IF(PI()*{ph}^2/400>=MAX(C{r},D{r})-0.0005,1,0),0)'
            C[f'{cl}{r}'].font = Font(name=F, size=8, color='A6A6A6')
        C[f'E{r}'] = f'=IFERROR(INDEX({{6.3,8,10,12.5,16,20}},MATCH(1,L{r}:Q{r},0)),"> Ø20")'
        C[f'F{r}'] = f'=IF(ISNUMBER(C{r}),IF(PI()*{phi_nm}^2/400>=MAX(C{r},D{r})-0.0005,"OK","não"),"—")'
        if extra_d:
            dd = extra_d[1]
            _x2 = f'1.25*{dd}*(1-SQRT(1-B{r}/(0.5*A{r}*{dd}^2*{kfd_nm}/10)))'
            C[f'G{r}'] = f'=IFERROR(B{r}/(fyk_/gama_s/10*MIN({dd}-0.4*{_x2},0.95*{dd})),"—")'
        for cc, fm in zip('ABCDEFG', ['0', '0.0', '0.00', '0.00', '0.0', None, '0.00']):
            if cc == 'G' and not extra_d: continue
            c = C[f'{cc}{r}']; c.border = BOX; c.alignment = Alignment(horizontal='center'); c.font = fN; c.fill = RES
            if fm: c.number_format = fm
        r += 1
    return r0, r - 1
C.cell(row=r, column=1, value='Arranjos (faixa bm = múltiplo do espaçamento dos furos; barra do lado do solo, momento da base)').font = fB; r += 1
# faixas = múltiplos do graute a cada X (a barra cai num furo grauteado; Jose, 13/10), até 6t no automático
pv0, pv1 = arr_table('pv', 'd_pv', 'Kfd_pv', 'M_pvs', [f'Graute*{k}' for k in (1, 2, 3, 4)], 'phi_pv')
# O digitado também cai na grade dos furos, para baixo (mesma regra do s_adot do balanço): barra fora do furo não
# existe na obra, e a conta tem de ser a do muro que o 3D desenha.
Lc('Espaçamento vertical adotado', f'=IF(ISNUMBER(s_pv_dir),ROUNDDOWN(s_pv_dir/Graute,0)*Graute,SUMPRODUCT(MAX((F{pv0}:F{pv1}="OK")*(A{pv0}:A{pv1}<=6*t_bloco)*A{pv0}:A{pv1})))', 'cm', 'Entradas (ajustado para baixo ao múltiplo dos furos) ou automático (maior faixa em que o Ø das Entradas atende).', 'key', '0', 's_pv')
Lc('Md da faixa — lado do solo', '=M_pvs*s_pv/100', 'kN·cm', '', 'res', '0.0', 'Md_pvs')
Lc('x', '=IFERROR(1.25*d_pv*(1-SQRT(1-Md_pvs/(0.5*s_pv*d_pv^2*Kfd_pv/10))),"não resiste")', 'cm', '', 'res', '0.00', 'x_pv')
Lc('fsd da barra vertical', '=fyk_/gama_s', 'MPa', '', 'res', '0.0', 'fsd_pv')
Lc('As lado do solo', '=IFERROR(Md_pvs/(fsd_pv/10*MIN(d_pv-0.4*x_pv,0.95*d_pv)),"não resiste")', 'cm²', '', 'res', '0.00', 'As_pvs')
Lc('As lado externo (vão)', '=IFERROR(M_pve*s_pv/100/(fsd_pv/10*MIN(d_pv-0.4*1.25*d_pv*(1-SQRT(1-M_pve*s_pv/100/(0.5*s_pv*d_pv^2*Kfd_pv/10))),0.95*d_pv)),"—")', 'cm²', 'Só com 2 barras por furo.', 'res', '0.00', 'As_pve')
Lc('As,mín da faixa', '=IF(LEFT(AsMin_crit,4)="Viga",0.0015*s_pv*d_pv,0.001*s_pv*t_bloco)', 'cm²', '', 'res', '0.00', 'As_pvm')
Lc('Área da barra vertical', '=PI()*phi_pv^2/400', 'cm²', '', 'res', '0.000', 'a_pv')
Lc('Barras por furo', '=IF(LEFT(pos_pv,1)="2",2,1)', '', '', 'res', '0', 'nb_pv')
r += 1
section(C, r, '10. Painel — flexão horizontal (barras nas canaletas)'); r += 1
Lc('K horizontal', '=IF(ISNUMBER(K_ph),K_ph,IF(gr_tot="Sim",1,0.5))', '', 'Entradas ou, em branco: 0,5 com a seção horizontal não toda grauteada (manual ABCP); 1,0 com grauteamento total.', 'res', '0.00', 'K_ph_us', 'Manual ABCP')
Lc('Kfd horizontal = K·0,7·fpk/γm', '=K_ph_us*0.7*fpk_pn/gama_m', 'MPa', '', 'res', '0.000', 'Kfd_ph', 'Manual ABCP')
Lc('Barras por canaleta', '=IF(LEFT(pos_ph,1)="2",2,1)', '', '2 = uma barra encostada em cada face.', 'res', '0', 'nb_ph')
Lc('d horizontal', '=IF(LEFT(pos_ph,4)="Cent",t_bloco/2,t_bloco-c_pv)', 'cm', 'Centralizada na canaleta → d = t/2; encostada na face externa ou uma em cada face → d = t − c.', 'key', '0.0', 'd_ph')
Lc('Momento horizontal de cálculo', '=IF(OR(LEFT(pos_ph,4)="Cent",nb_ph=2),MAX(Mdx_p,Mdxe_p),Mdx_p)', 'kN·cm/m', 'Barra centralizada atende os dois sinais (vão e engaste lateral); com uma barra em cada face, cada face leva o maior dos dois.', 'res', '0.0', 'M_ph')
C.cell(row=r, column=1, value='Arranjos (faixa bm = espaçamento das canaletas; última coluna = As com a barra encostada na face, d = t − c)').font = fB; r += 1
ph0, ph1 = arr_table('ph', 'd_ph', 'Kfd_ph', 'M_ph', ['20', '40', '60', '80'], 'phi_ph', extra_d=('As com d = t − c, fyd (cm²)', '(t_bloco-c_pv)'))
Lc('Espaçamento das canaletas adotado', f'=IF(ISNUMBER(s_ph_dir),s_ph_dir,SUMPRODUCT(MAX((F{ph0}:F{ph1}="OK")*A{ph0}:A{ph1})))', 'cm', 'Entradas ou automático.', 'key', '0', 's_ph')
Lc('Md da faixa', '=M_ph*s_ph/100', 'kN·cm', '', 'res', '0.0', 'Md_ph')
Lc('x', '=IFERROR(1.25*d_ph*(1-SQRT(1-Md_ph/(0.5*s_ph*d_ph^2*Kfd_ph/10))),"não resiste")', 'cm', '', 'res', '0.00', 'x_ph')
Lc('fsd da barra horizontal', '=fyk_/gama_s', 'MPa', '', 'res', '0.0', 'fsd_ph')
Lc('As horizontal', '=IFERROR(Md_ph/(fsd_ph/10*MIN(d_ph-0.4*x_ph,0.95*d_ph)),"não resiste")', 'cm²', '', 'res', '0.00', 'As_phc')
Lc('As,mín da faixa', '=IF(LEFT(AsMin_crit,4)="Viga",0.0015*s_ph*d_ph,0.001*s_ph*t_bloco)', 'cm²', '', 'res', '0.00', 'As_phm')
Lc('Área da barra horizontal', '=PI()*phi_ph^2/400', 'cm²', '', 'res', '0.000', 'a_ph')
Lc('Precisa de barra do lado do solo junto ao contraforte?', '=IF(AND(LEFT(pos_ph,4)="Enco",Mdxe_p>0),"SIM — laterais engastadas com barra encostada na face externa: Mdxe traciona a face do solo. Usar barra centralizada ou 2 barras na canaleta","Não")', '', '', 'res')
r += 1
section(C, r, '11. Painel não armado entre barras e canaletas'); r += 1
Lc('l = espaçamento vertical', '=s_pv/100', 'm', '', 'res', '0.00', 'l_sp')
# Mesma regra do painel do balanço (aba Painel não armado): altura do subpainel limitada pelo MURO; z e o índice no
# perfil pela altura de SOLO. Subpainel mais alto que o solo → z = 0, trapézio do solo no subpainel inteiro (DEDUÇÃO, a
# favor da segurança).
Lc('h = espaçamento das canaletas', '=MIN(s_ph/100,H_muro)', 'm', 'No máximo a altura do muro.', 'res', '0.00', 'h_sp')
Lc('Existe painel não armado?', '=IF(OR(s_pv<=s_furo,s_ph<=20),"Não — barra em todos os furos ou canaleta em toda fiada","Sim")', '', '', 'res', None, 'tem_sp')
Lc('z do topo do subpainel de baixo', '=MAX(0,H_solo-h_sp)', 'm', 'A partir do topo do solo; 0 se o subpainel passa do solo (a favor da segurança).', 'res', '0.00', 'z_sp')
_k2 = 'INT(z_sp/H_solo*40)'
Lc('σh no topo do subpainel', f"=INDEX('Solo e Empuxo'!$G$44:$G$84,{_k2}+1)+(z_sp/H_solo*40-{_k2})*(INDEX('Solo e Empuxo'!$G$44:$G$84,MIN({_k2}+2,41))-INDEX('Solo e Empuxo'!$G$44:$G$84,{_k2}+1))", 'kPa', '', 'res', '0.00', 'sp_t2')
Lc('fd = γf·σh médio', '=gama_f*(sp_t2+sh_base)/2', 'kN/m²', '', 'key', '0.00', 'fd_sp')
Lc('h/l (limitado 0,3–3,0)', '=MIN(3,MAX(0.3,h_sp/l_sp))', '', '', 'res', '0.000', 'hl_sp')
Lc('μ (limitado 0,3–1,0)', '=MIN(1,MAX(0.3,mu_pan))', '', '', 'res', '0.000', 'mu_sp')
Lc('j', '=MATCH(hl_sp,hl_row,1)', '', '', 'res', '0', 'j_sp')
Lc('i', '=MATCH(mu_sp,mu_col,-1)', '', '', 'res', '0', 'i_sp')
Lc('tx', '=IF(j_sp>=11,0,(hl_sp-INDEX(hl_row,j_sp))/(INDEX(hl_row,j_sp+1)-INDEX(hl_row,j_sp)))', '', '', 'res', '0.000', 'tx_sp')
Lc('ty', '=IF(i_sp>=9,0,(INDEX(mu_col,i_sp)-mu_sp)/(INDEX(mu_col,i_sp)-INDEX(mu_col,i_sp+1)))', '', '', 'res', '0.000', 'ty_sp')
Lc('βf (caso 13)', '=(1-ty_sp)*((1-tx_sp)*INDEX(tabela_13,i_sp,j_sp)+tx_sp*INDEX(tabela_13,i_sp,MIN(11,j_sp+1)))+ty_sp*((1-tx_sp)*INDEX(tabela_13,MIN(9,i_sp+1),j_sp)+tx_sp*INDEX(tabela_13,MIN(9,i_sp+1),MIN(11,j_sp+1)))', '', '', 'key', '0.0000', 'bf_sp', 'NBR 16868-1 E.4.2 (Tab. E.1)')
Lc('Md,par = βf·fd·l²', '=bf_sp*fd_sp*l_sp^2*100', 'kN·cm/m', '', 'res', '0.0', 'Mpar_sp')
Lc('Md,nor = μ·Md,par', '=mu_pan*Mpar_sp', 'kN·cm/m', '', 'res', '0.0', 'Mnor_sp')
Lc('σtd,par = Md,par/W', '=Mpar_sp/(100*t_bloco^2/6)*10', 'MPa', '', 'res', '0.000', 'st_psp')
Lc('ftd,par = ftk∥/γm', '=ftk_par/gama_m', 'MPa', '', 'res', '0.000', 'ftdp_sp')
Lc('σtd,nor = Md,nor/W', '=Mnor_sp/(100*t_bloco^2/6)*10', 'MPa', '', 'res', '0.000', 'st_nsp')
Lc('ftd,nor = ftk⊥/γm', '=ftk_nor/gama_m', 'MPa', '', 'res', '0.000', 'ftdn_sp')
r += 1
section(C, r, '12. Painel — ELS nas duas direções'); r += 1
Lc('Em do painel = (Em/fpk)·fpk', '=Em_coef*fpk_pn', 'MPa', 'Seção I ↔ fpk líquido ou bruto; seção cheia ↔ fpk*.', 'res', '0', 'Em_pn')
Lc('n = Es/Em', '=210000/Em_pn', '', '', 'res', '0.00', 'n_pn')
# --- vertical
Lc('VERTICAL — bm', '=s_pv', 'cm', '', 'res', '0.0', 'bm_ev')
Lc('Furos grauteados na faixa', '=MAX(1,INT(bm_ev/Graute+0.5))', '', 'Faixa de uma barra (bm = s, múltiplo do graute a cada X): s/X furos grauteados, cada um uma alma.', 'res', '0', 'n_alm_v')
Lc('bw (furo grauteado + septos)', '=IF(gr_tot="Sim",bm_ev,MIN(bm_ev,n_alm_v*IF(ISNUMBER(bwv_dir),bwv_dir,(L_bloco-3*hf_bl)/2+2*hf_bl)))', 'cm', 'Uma alma por furo grauteado da faixa; grauteamento total → seção cheia.', 'res', '0.00', 'bw_ev')
Lc("As1 / As2 (d' = c)", '=FIXED(a_pv,3)&" / "&FIXED(IF(nb_pv=2,a_pv,0),3)', 'cm²', '', 'res')
Lc('Ma = (Ma/Mk)·Mdyei/γf·bm', '=psi_els*Mdyei_p/gama_f*bm_ev/100', 'kN·cm', '', 'res', '0.0', 'Ma_ev')
Lc('Im', '=bm_ev*t_bloco^3/12-(bm_ev-bw_ev)*(t_bloco-2*hf_bl)^3/12', 'cm⁴', '', 'res', '0', 'Im_ev')
Lc('Mr = ftk⊥·Im/(h/2)', '=ftk_nor/10*Im_ev/(t_bloco/2)', 'kN·cm', '', 'res', '0.0', 'Mr_ev')
def ln_hipotese(tag, k, bm, bw, As1, d, As2, dl, n2, hip):
    """Uma hipótese da LN no estádio II, em pedaços (a conta inteira numa linha só ficava grande demais na memória):
    B e C da equação do 2º grau, x com a LN na mesa, B e C com a LN na alma (T), x na alma. x = (−B + √(B² + 2·b·C))/b.
    k = '' (sem 2ª barra: hipótese única), '1' (2ª barra tracionada, n2 = n) ou '2' (comprimida, n2 = n − 1)."""
    B, C, Bw, Cw = f'lnB{k}_{tag}', f'lnC{k}_{tag}', f'lnBw{k}_{tag}', f'lnCw{k}_{tag}'
    dois = As2 != '0'
    q = f' ({hip})' if hip else ''
    Lc(f'B{q} = n·As1' + (' + n2·As2' if dois else ''), f'=n_pn*{As1}' + (f'+{n2}*{As2}' if dois else ''), 'cm²',
       'LN: b·x²/2 + B·x − C = 0 → x = (−B + √(B² + 2·b·C))/b.', 'res', '0.00', B)
    Lc(f'C{q} = n·As1·d' + (" + n2·As2·d'" if dois else ''), f'=n_pn*{As1}*{d}' + (f'+{n2}*{As2}*{dl}' if dois else ''), 'cm³',
       '', 'res', '0.00', C)
    Lc('x supondo LN na mesa', f'=(-{B}+SQRT({B}^2+2*{bm}*{C}))/{bm}', 'cm', '', 'res', '0.000', f'xr{k}_{tag}')
    Lc('B com a LN na alma = (bm − bw)·hf + B', f'=({bm}-{bw})*hf_bl+{B}', 'cm²', '', 'res', '0.00', Bw)
    Lc('C com a LN na alma = (bm − bw)·hf²/2 + C', f'=({bm}-{bw})*hf_bl^2/2+{C}', 'cm³', '', 'res', '0.00', Cw)
    Lc('x supondo LN na alma (T)', f'=(-{Bw}+SQRT({Bw}^2+2*{bw}*{Cw}))/{bw}', 'cm', '', 'res', '0.000', f'xt{k}_{tag}')
def els_block(tag, bm, bw, As1, d, As2, dl, Ma, Mr, Im):
    # LN: 1º supõe As2 tracionada (n); se x > d', As2 comprimida (n − 1). Sem 2ª barra (horizontal), hipótese única.
    dois = As2 != '0'
    if dois:
        ln_hipotese(tag, '1', bm, bw, As1, d, As2, dl, 'n_pn', '2ª barra tracionada')
        Lc('x com As2 tracionada (n)', f'=IF(xr1_{tag}<=hf_bl,xr1_{tag},xt1_{tag})', 'cm', '', 'res', '0.000', f'x1_{tag}')
        ln_hipotese(tag, '2', bm, bw, As1, d, As2, dl, '(n_pn-1)', '2ª barra comprimida')
        Lc('x adotado', f'=IF(OR({As2}=0,x1_{tag}<={dl}),x1_{tag},IF(xr2_{tag}<=hf_bl,xr2_{tag},xt2_{tag}))', 'cm', "Se x < d', a 2ª barra está tracionada (entra com n).", 'key', '0.00', f'x_{tag}')
        Lc('n da 2ª barra', f'=IF(x_{tag}<={dl},n_pn,n_pn-1)', '', '2ª barra tracionada: n; comprimida: n − 1.', 'res', '0.00', f'n2_{tag}')
    else:
        ln_hipotese(tag, '', bm, bw, As1, d, As2, dl, None, '')
        Lc('x adotado', f'=IF(xr_{tag}<=hf_bl,xr_{tag},xt_{tag})', 'cm', 'Se x ≤ hf vale a hipótese da mesa.', 'key', '0.00', f'x_{tag}')
    Lc('III da alvenaria comprimida = b·x³/3', f'=IF(x_{tag}<=hf_bl,{bm},{bw})*x_{tag}^3/3', 'cm⁴', 'b = bm com a LN na mesa; bw com a LN na alma.', 'res', '0', f'IIc_{tag}')
    Lc('III das abas da mesa', f'=IF(x_{tag}<=hf_bl,0,({bm}-{bw})*hf_bl^3/12+({bm}-{bw})*hf_bl*(x_{tag}-hf_bl/2)^2)', 'cm⁴', 'Só com a LN na alma: (bm − bw)·hf³/12 + (bm − bw)·hf·(x − hf/2)².', 'res', '0', f'IIf_{tag}')
    partes = [f'IIc_{tag}', f'IIf_{tag}']
    if dois:
        Lc("III da 2ª barra = n2·As2·(x − d')²", f'=n2_{tag}*{As2}*(x_{tag}-{dl})^2', 'cm⁴', '', 'res', '0', f'IIs2_{tag}')
        partes.append(f'IIs2_{tag}')
    Lc('III da barra tracionada = n·As1·(d − x)²', f'=n_pn*{As1}*({d}-x_{tag})^2', 'cm⁴', '', 'res', '0', f'IIs1_{tag}')
    partes.append(f'IIs1_{tag}')
    Lc('III', '=' + '+'.join(partes), 'cm⁴', 'Alvenaria comprimida + abas + barras.', 'res', '0', f'III_{tag}')
    Lc('Ieq (Branson) ≤ Im', f'=IF({Ma}<={Mr},{Im},MIN({Im},({Mr}/{Ma})^3*{Im}+(1-({Mr}/{Ma})^3)*III_{tag}))', 'cm⁴', '', 'res', '0', f'Ieq_{tag}')
    Lc('heq = (12·Ieq/bm)^(1/3)', f'=(12*Ieq_{tag}/{bm})^(1/3)', 'cm', '', 'key', '0.00', f'heq_{tag}')
els_block('ev', 'bm_ev', 'bw_ev', 'a_pv', 'd_pv', 'IF(nb_pv=2,a_pv,0)', 'c_pv', 'Ma_ev', 'Mr_ev', 'Im_ev')
# --- horizontal
Lc('HORIZONTAL — bm', '=s_ph', 'cm', '', 'res', '0.0', 'bm_eh')
Lc('bw (canaleta grauteada)', '=IF(gr_tot="Sim",bm_eh,MIN(bm_eh,bwh_els))', 'cm', 'Todos os furos grauteados → seção cheia. Nos parciais a seção horizontal continua só com a canaleta (furo grauteado não corre na horizontal).', 'res', '0.00', 'bw_eh')
Lc('Ma = (Ma/Mk)·M/γf·bm', '=psi_els*M_ph/gama_f*bm_eh/100', 'kN·cm', '', 'res', '0.0', 'Ma_eh')
Lc('Im', '=bm_eh*t_bloco^3/12-(bm_eh-bw_eh)*(t_bloco-2*hf_bl)^3/12', 'cm⁴', '', 'res', '0', 'Im_eh')
Lc('Mr = ftk∥·Im/(h/2)', '=ftk_par/10*Im_eh/(t_bloco/2)', 'kN·cm', '', 'res', '0.0', 'Mr_eh')
els_block('eh', 'bm_eh', 'bw_eh', 'a_ph', 'd_ph', 'IF(nb_ph=2,a_ph,0)', 'c_pv', 'Ma_eh', 'Mr_eh', 'Im_eh')
# --- flechas
_a, _aB = _cn['α'], _cn['αB']
Lc('Carga de serviço × α (triangular + uniforme)', f'=psi_els*(B{_a}*p_tri+C{_a}*p_uni)', 'kN/m²', 'α·p de cada parcela, somados.', 'res', '0.00', 'ap_c')
Lc('Carga de serviço × αB (borda livre)', f'=psi_els*(B{_aB}*p_tri+C{_aB}*p_uni)', 'kN/m²', '', 'res', '0.00', 'apB_c')
Lc('δ0 com heq vertical', '=ap_c/100*lref_p^4/(Em_pn*1000*(heq_ev/100)^3)*1000', 'mm', '', 'res', '0.00', 'd0_ev')
Lc('δb0 com heq vertical', '=apB_c/100*lref_p^4/(Em_pn*1000*(heq_ev/100)^3)*1000', 'mm', '', 'res', '0.00', 'db0_ev')
Lc('δ0 com heq horizontal', '=ap_c/100*lref_p^4/(Em_pn*1000*(heq_eh/100)^3)*1000', 'mm', '', 'res', '0.00', 'd0_eh')
Lc('δb0 com heq horizontal', '=apB_c/100*lref_p^4/(Em_pn*1000*(heq_eh/100)^3)*1000', 'mm', '', 'res', '0.00', 'db0_eh')
# Alguma direção ficou sem heq (nenhum arranjo de barras válido). O MÁXIMO do Excel IGNORA texto e daria
# δ∞ = 0 — flecha zero que passa sem dever (achado da memória de cálculo, 09/10). Sem as quatro flechas, não há δ∞.
Lc('δ∞ = (1 + Δξ)·maior δ', '=IF(AND(ISNUMBER(d0_ev),ISNUMBER(db0_ev),ISNUMBER(d0_eh),ISNUMBER(db0_eh)),(1+dxi)*MAX(d0_ev,db0_ev,d0_eh,db0_eh),"—")', 'mm', 'A placa tem uma flecha só; vale a direção mais crítica (menor heq), a favor da segurança.', 'key', '0.00', 'dinf_p', 'NBR 16868-1 9.2.4')
Lc('δadm = menor vão/limite', '=lref_p*1000/div_adm', 'mm', '', 'res', '0.00', 'dadm_p')
Lc('Ábaco NBR (borda superior livre): h/t', '=H_muro*100/t_bloco', '', '', 'res', '0.0', 'ht_ab')
Lc('l/t', '=l_cf_adot*100/t_bloco', '', '', 'res', '0.0', 'lt_ab')
Lc('h/t limite (leitura do gráfico)', '=IF(lt_ab<=40,80,IF(lt_ab<=55,60-(lt_ab-40)*40/15,IF(lt_ab<=120,20-(lt_ab-55)*5/65,"fora do ábaco")))', '', 'Engaste da base tratado como apoio.', 'res', '0.0', 'htl_ab', 'NBR 16868-1 E.5.1 (Fig. E.1)')
r += 1
section(C, r, '13. Cargas para a sapata corrida (dimensionamento na aba Fundação)'); r += 1
Lc('Ângulo das charneiras a partir da base', '=IF(LEFT(lat_pan,4)="Apoi",60,45)', '°', 'Base engastada + laterais apoiadas → 60°; laterais engastadas → 45°.', 'res', '0', 'th_ch', 'NBR 6118 14.7.6.1')
Lc('Altura da região que vai para a base', '=MIN(l_p*TAN(RADIANS(th_ch))/2,h_p)', 'm', '', 'res', '0.000', 'a_ch')
Lc('Força horizontal na sapata por vão (característica)', '=sh_base*l_p*a_ch-(2/TAN(RADIANS(th_ch))*sh_base+(sh_base-sh_topo)/h_p*l_p)*a_ch^2/2+2/TAN(RADIANS(th_ch))*(sh_base-sh_topo)/h_p*a_ch^3/3', 'kN', '', 'key', '0.00', 'F_ch')
Lc('Força total no painel', '=l_p*h_p*(sh_base+sh_topo)/2', 'kN', 'Com a carga do modelo do painel (seção 8).', 'res', '0.00', 'F_tot')
Lc('Para cada contraforte (lateral)', '=(F_tot-F_ch)/2', 'kN', 'O contraforte foi calculado com 100% da área: a soma passa de 100%, a favor da segurança.', 'res', '0.00')
Lc('Pico na sapata (meio do vão)', '=sh_base*a_ch-(sh_base-sh_topo)/h_p*a_ch^2/2', 'kN/m', 'Distribuição de 0 junto ao contraforte até o pico.', 'res', '0.00')
Lc('Média na sapata', '=F_ch/l_p', 'kN/m', '', 'res', '0.00')
Lc('Momento da base do painel (engaste na sapata)', '=Mdyei_p', 'kN·cm/m', 'De cálculo. Vira momento/torção na sapata corrida.', 'res', '0.0')
Lc('Md e Vd na base do contraforte', '=FIXED(Md_cf,2)&" kN·m  /  "&FIXED(Vd_cf,2)&" kN"', '', '', 'res')
r += 1
section(C, r, '14. Detalhamento (resumo)'); r += 1
Lc('Contraforte', '=IF(dob_cf=1,"Dobrado (2 blocos, "&FIXED(eenr,0)&" cm): "&n_cf&"Ø"&'+fphi('phi_cf')+'&" na ponta ("&n_cf/2&" em cada bloco; d = "&FIXED(d_cf,1)&" cm) + "&n_cc&"Ø"&'+fphi('phi_cc')+'&" construtivas em cada bloco; "&IF(ram_ef=4,"dois estribos","estribo")&" Ø"&'+fphi('phi_est')+'&" c/20 ("&ram_ef&" ramos) abraçando os dois blocos, em toda fiada",n_cf&"Ø"&'+fphi('phi_cf')+'&" na ponta (d = "&FIXED(d_cf,1)&" cm) + "&n_cc&"Ø"&'+fphi('phi_cc')+'&" construtivas; "&IF(Asw_c=0,"sem estribos (dispensa pela conta)","estribos Ø"&'+fphi('phi_est')+'&" c/"&FIXED(s_est,0)&" ("&ram_ef&" ramos) nas juntas")&IF(dob_o=1,". Intermediários dobrados (2 blocos, "&FIXED(eenr_o,0)&" cm): "&n_cfo&"Ø"&'+fphi('phi_cf')+'&" ("&n_cf&" em cada bloco) + "&n_cc&"Ø"&'+fphi('phi_cc')+'&" construtivas em cada bloco; "&IF(ram_o=4,"dois estribos","estribo")&" Ø"&'+fphi('phi_est')+'&" c/20 ("&ram_o&" ramos) em toda fiada",""))', '', '', 'key')
Lc('Painel — vertical', '=IF(nb_pv=2,"Ø"&'+fphi('phi_pv')+'&" c/"&FIXED(s_pv,0)&" em CADA face (2 barras por furo, a "&'+fphi('c_pv')+'&" cm das faces)","Ø"&'+fphi('phi_pv')+'&" c/"&FIXED(s_pv,0)&" centralizada")', '', '', 'key')
Lc('Painel — horizontal', '="Ø"&'+fphi('phi_ph')+'&" c/"&FIXED(s_ph,0)&" em canaleta grauteada, "&IF(LEFT(pos_ph,4)="Cent","centralizada",IF(nb_ph=2,"uma em cada face","encostada na face externa"))', '', '', 'key')
r += 1
section(C, r, '15. Verificações'); r += 1
CHK = [
    ('Esbeltez λ ≤ 30 (armada)', '=IF(lam_cf<=30,"OK ("&FIXED(lam_cf,1)&")","NÃO OK ("&FIXED(lam_cf,1)&")")'),
    ('hf ≤ 0,5d (largura colaborante)', '=IF(cf_T=0,"— (retangular)",IF(hf_cf<=0.5*d_cf,"OK","NÃO OK"))'),
    ('Contraforte: seção resiste', '=IF(ISNUMBER(x_cf),"OK","NÃO OK — aumentar o contraforte ou o fpk")'),
    ('Contraforte: ductilidade x/d ≤ 0,45', '=IF(ISNUMBER(xd_cf),IF(xd_cf<=0.45,"OK ("&FIXED(xd_cf,3)&")","NÃO OK"),"NÃO OK")'),
    ('Contraforte: As,ef ≥ As de cálculo', '=IF(As_cfe>=As_cfc-0.005,"OK ("&FIXED(As_cfe,2)&" ≥ "&FIXED(As_cfc,2)&")","NÃO OK")'),
    ('Contraforte: As ≤ As,máx do furo', '=IF(As_cfx2<=As_cfx,"OK ("&FIXED(As_cfx2,2)&" ≤ "&FIXED(As_cfx,2)&")","NÃO OK — distribuir em mais furos ou aumentar Ø/graute")'),
    ('Contraforte: bielas Vd ≤ Vrd2', '=IF(Vd_cf<=Vrd2_cf,"OK ("&FIXED(Vd_cf,1)&" ≤ "&FIXED(Vrd2_cf,1)&")","NÃO OK — aumentar a seção")'),
    ('Contraforte: estribos', '=IF(dob_cf=1,IF(Asw_e>=Asw_c-0.005,"OK ("&FIXED(Asw_e,2)&" ≥ "&FIXED(Asw_c,2)&" cm²/m; dobrado: c/20, "&ram_ef&" ramos)","NÃO OK — dobrado: "&IF(AND(pd4_est=1,ram_ef<>4),"4 ramos não cabem ("&mot4_est&")","estribo c/20 com "&ram_ef&" ramos não basta, aumentar o Ø")&" ("&FIXED(Asw_e,2)&" < "&FIXED(Asw_c,2)&" cm²/m)"),IF(Asw_c=0,"Dispensa pela conta (Vd ≤ Va)",IF(Asw_e>=Asw_c-0.005,"OK ("&FIXED(Asw_e,2)&" ≥ "&FIXED(Asw_c,2)&" cm²/m)","NÃO OK — aumentar Ø, ramos ou reduzir s")))'),
    ('Estribo cabe na junta (Ø ≤ 6,3 mm)', '=IF(Asw_c=0,"— (sem estribo)",IF(phi_est<=6.3,"OK","NÃO OK — Ø > 6,3 não cabe na junta de assentamento"))'),
    ('Estribo: 4 ramos cabem no contraforte', '=IF(dob_cf=1,IF(pd4_est=0,"— (2 ramos)",IF(ram_ef=4,"OK (dobrado, dois estribos: gancho "&FIXED(pg4_est,1)&" ≥ "&FIXED(pgn_est,1)&" cm; "&n_cf/2&" ≤ "&nb4d_cab&" barras por bloco)","NÃO OK — 4 ramos não cabem no contraforte dobrado ("&mot4_est&")")),IF(Asw_c=0,"— (sem estribo)",IF(ramos_est<>4,"— (2 ramos)",IF(ram_ef=4,"OK (gancho "&FIXED(pg4_est,1)&" ≥ "&FIXED(pgn_est,1)&" cm; "&n_cf&" ≤ "&nb4_cab&" barras)","NÃO OK — 4 ramos não cabem na largura do contraforte ("&IF(pg4_est<pgn_est-0.005,"gancho de "&FIXED(pg4_est,1)&" < "&FIXED(pgn_est,1)&" cm",n_cf&" barras e só "&nb4_cab&" cabem entre os ramos do meio")&")"))))'),
    ('Contraforte: ELS δ∞ ≤ δadm', '=IF(dinf_cf<=dadm_cf,"OK ("&FIXED(dinf_cf,1)&" ≤ "&FIXED(dadm_cf,1)&" mm)","NÃO OK")'),
    ('Painel: γ dentro da tabela (0,30–2,00)', '=IF(AND(gam_p>=0.3,gam_p<=2),"OK","NÃO OK — fora da tabela: mudar espaçamento dos contrafortes")'),
    ('Painel vertical: barra do lado do solo', '=IF(ISNUMBER(As_pvs),IF(a_pv>=MAX(As_pvs,As_pvm)-0.0005,"OK","NÃO OK"),"NÃO OK — não resiste")'),
    ('Painel vertical: barra do lado externo', '=IF(nb_pv=1,"— (1 barra centralizada)",IF(ISNUMBER(As_pve),IF(a_pv>=MAX(As_pve,As_pvm)-0.0005,"OK","NÃO OK"),"NÃO OK"))'),
    ('Painel vertical: As ≤ As,máx do furo', '=IF(nb_pv*a_pv*f_trasp<=pAs_max*Ag_furo,"OK","NÃO OK")'),
    ('Painel horizontal: barra na canaleta', '=IF(ISNUMBER(As_phc),IF(a_ph>=MAX(As_phc,As_phm)-0.0005,"OK ("&FIXED(a_ph,2)&" ≥ "&FIXED(MAX(As_phc,As_phm),2)&")","NÃO OK"),"NÃO OK — não resiste")'),
    ('Painel não armado: σtd,par ≤ ftd,par', '=IF(LEFT(tem_sp,3)="Não","— não se aplica",IF(st_psp<=ftk_par/gama_m,"OK ("&TEXT(st_psp/(ftk_par/gama_m),"0%")&")","NÃO OK"))'),
    ('Painel não armado: σtd,nor ≤ ftd,nor', '=IF(LEFT(tem_sp,3)="Não","— não se aplica",IF(st_nsp<=ftk_nor/gama_m,"OK ("&TEXT(st_nsp/(ftk_nor/gama_m),"0%")&")","NÃO OK"))'),
    ('Painel não armado: dimensões-limite', '=IF(LEFT(tem_sp,3)="Não","— não se aplica",IF(AND(MAX(l_sp,h_sp)<=50*t_bloco/100,l_sp*h_sp<=2025*(t_bloco/100)^2),"OK","NÃO OK"))'),
    ('Painel: ELS δ∞ ≤ δadm', '=IF(dinf_p<=dadm_p,"OK ("&FIXED(dinf_p,1)&" ≤ "&FIXED(dadm_p,1)&" mm)","NÃO OK")'),
    ('Painel: ábaco simplificado da NBR', '=IF(ISNUMBER(htl_ab),IF(ht_ab<=htl_ab,"OK (h/t "&FIXED(ht_ab,1)&" ≤ "&FIXED(htl_ab,0)&")","NÃO OK pelo ábaco — vale o cálculo da flecha acima"),"fora do ábaco")'),
    ('POSIÇÃO DAS BARRAS DO PAINEL', '=IF(nb_pv=2,"ATENÇÃO — verticais: uma barra encostada em CADA face (a "&'+fphi('c_pv')+'&" cm), não centralizar. Horizontais: "&IF(LEFT(pos_ph,4)="Cent","centralizadas na canaleta.",IF(nb_ph=2,"uma encostada em CADA face da canaleta.","encostadas na face externa.")),"Verticais centralizadas."&IF(nb_ph=2," Horizontais: uma encostada em CADA face da canaleta.",""))'),
    ('Muro de cima e vento', '=res_mc'),
]
# Nome em todas as verificações (15/11): a memória do app as achava pelo rótulo da coluna A; o diagrama de esforços
# precisa do veredito de cada peça pelo nome. Dar nome a uma célula que já existe não muda valor nenhum.
NOME_CHK_CF = {
    'Esbeltez λ ≤ 30 (armada)': 'chk_esb_cf', 'hf ≤ 0,5d (largura colaborante)': 'chk_hf_cf',
    'Contraforte: seção resiste': 'chk_res_cf', 'Contraforte: ductilidade x/d ≤ 0,45': 'chk_duc_cf',
    'Contraforte: As,ef ≥ As de cálculo': 'chk_As_cf', 'Contraforte: As ≤ As,máx do furo': 'chk_Asx_cf',
    'Contraforte: bielas Vd ≤ Vrd2': 'chk_bie_cf', 'Contraforte: estribos': 'chk_est_cf',
    'Estribo cabe na junta (Ø ≤ 6,3 mm)': 'chk_estj_cf', 'Estribo: 4 ramos cabem no contraforte': 'chk_ram_cf',
    'Contraforte: ELS δ∞ ≤ δadm': 'chk_els_cf',
    'Painel: γ dentro da tabela (0,30–2,00)': 'chk_gam_p', 'Painel vertical: barra do lado do solo': 'chk_pvs',
    'Painel vertical: barra do lado externo': 'chk_pve', 'Painel vertical: As ≤ As,máx do furo': 'chk_pvx',
    'Painel horizontal: barra na canaleta': 'chk_ph', 'Painel não armado: σtd,par ≤ ftd,par': 'chk_spp',
    'Painel não armado: σtd,nor ≤ ftd,nor': 'chk_spn', 'Painel não armado: dimensões-limite': 'chk_spd',
    'Painel: ELS δ∞ ≤ δadm': 'chk_els_p', 'Painel: ábaco simplificado da NBR': 'chk_ab_p',
    'POSIÇÃO DAS BARRAS DO PAINEL': 'chk_pos_p', 'Muro de cima e vento': 'chk_mc_cf'}
assert set(NOME_CHK_CF) == {lab for lab, _ in CHK}, 'verificação sem nome na aba Contrafortes'
for lab, f in CHK:
    Lc(lab, f, '', '', 'key', None, NOME_CHK_CF[lab])
r += 1
# ---------- 16. momentos resistentes e o outro contraforte (15/11, vista "Esforços") ----------
# No FIM da aba: nada acima muda de lugar (a memória do app acha as linhas de cima pelo rótulo da coluna A, a 1ª vez
# que ele aparece — os rótulos daqui não repetem os de cima).
# γf: os MSd de cada peça já são de cálculo nesta aba (Md_cf = γf·Mk_cf; Mdy/Mdyei/Mdx = γf·μ·p·l², seção 8). Ao longo
# da altura do contraforte: Solo e Empuxo, colunas W (este tipo) e Y (o outro), = γf·(M solo·binf + M vento).
section(C, r, '16. Momentos resistentes com a armadura adotada (diagrama de momentos) e o outro contraforte'); r += 1
# O OUTRO TIPO: a aba dimensiona só o contraforte escolhido em "Contraforte calculado" (intermediário OU extremidade),
# mas o muro tem os dois e a armadura é a mesma em todos. O diagrama precisa do MSd dos dois. Mesma conta da seção 1
# (e do vento, aba Muro de cima e vento, seção 3) com a largura de influência do outro tipo; e a seção T do outro tipo
# muda a aba do lado do balanço (bf_b), por isso o MRd dele sai com a bm dele.
Lc('Contraforte do outro tipo', '=IF(LEFT(tipo_cf,5)="Inter","Extremidade","Intermediário")', '', '', 'res', None, 'tipo_cfo')
Lc('Largura de influência do outro tipo', '=IF(LEFT(tipo_cf,5)="Inter",l_cf_adot/2+bal_cf,l_cf_adot)', 'm', 'Intermediário = l; extremidade = l/2 + balanço do muro.', 'res', '0.00', 'binf_o', 'Critério adotado (área de influência)')
# Dobrado (16/11): o outro tipo tem a SUA largura (eenr_o) e as suas barras (As_cfo) — seção 18. Com o contraforte
# simples, bw_cfo = bw_cf e As_cfo = As_cfe: as fórmulas abaixo dão o mesmo número de antes, bit a bit. Os nomes novos
# (bf_ao, bw_cfo, Fas_cfo…) ficam na seção 18, no fim: nenhuma linha desta seção muda de endereço.
Lc('Aba do lado do balanço no outro tipo', '=IF(LEFT(tipo_cf,5)="Inter",MIN(6*t_bloco,bal_cf*100),bf_ao)', 'cm', '', 'res', '0.0', 'bf_bo')
Lc('bm do outro tipo', '=IF(cf_T=1,MIN(bw_cfo+bf_ao+bf_bo,H_muro*100/3),bw_cfo)', 'cm', 'bm ≤ bw + abas e ≤ altura do muro/3.', 'res', '0.0', 'bm_cfo', 'NBR 16868-1 11.3.4 e 10.1.3')
Lc('Abas da mesa do outro tipo = Kfd·(bm − bw)·hf', '=Kfd_cf/10*(bm_cfo-bw_cfo)*hf_cf', 'kN', '', 'res', '0.00', 'Cf_cfo')
Lc('Outro tipo: vento do muro de cima', '=IF(Tipo_muro="Contrafortes",p_w*h_mce*pil_ncf*binf_o,0)', 'kN', 'Como o F_wpc (aba Muro de cima e vento) com a largura do outro tipo.', 'res', '0.00', 'Fpo_cf')
Lc('Outro tipo: vento no arrimo acima do solo', '=IF(Tipo_muro="Contrafortes",p_w*h_exp*binf_o,0)', 'kN', '', 'res', '0.00', 'Feo_cf')
Lc('Outro tipo: Vk do vento', '=Fpo_cf+Feo_cf', 'kN', '', 'res', '0.00', 'Vk_wcfo')
Lc('Outro tipo: Mk do vento na base', '=Fpo_cf*(H_muro+h_mce/2)+Feo_cf*(H_solo+h_exp/2)', 'kN·m', '', 'res', '0.00', 'Mk_wcfo')
Lc('Outro tipo: Mk na base', '=Mk_*binf_o+Mk_wcfo', 'kN·m', '', 'res', '0.00', 'Mk_cfo')
Lc('Outro tipo: Vk na base', '=Vk_*binf_o+Vk_wcfo', 'kN', '', 'res', '0.00', 'Vk_cfo')
Lc('Outro tipo: Md = γf·Mk', '=gama_f*Mk_cfo', 'kN·m', '', 'key', '0.00', 'Md_cfo')
Lc('Outro tipo: Vd = γf·Vk', '=gama_f*Vk_cfo', 'kN', '', 'key', '0.00', 'Vd_cfo')
# MRd do contraforte: a conta da seção 5 desfeita (x com As,ef pelo equilíbrio). T quando a força no aço passa da
# mesa inteira (bm·hf): Cf = abas (bm − bw)·hf e a alma de cima a 0,8x, como o x_cfw da seção 5; retangular (bm × d,
# ou só a alma no aparente) com z ≤ 0,95d. Limite x/d = 0,45 (verificação "ductilidade").
Lc('Força no aço F = As,ef·fsd', '=As_cfe*fsd_cf/10', 'kN', 'Barras principais do contraforte (Nº × Ø).', 'res', '0.00', 'Fas_cf')
Lc('x limite = 0,45·d (contraforte)', '=0.45*d_cf', 'cm', 'Ductilidade (verificação x/d ≤ 0,45).', 'res', '0.00', 'xlim_cf')
for _sx, _bm, _cfm, _rot, _bw, _Fas in (('cf', 'bm_cf', 'Cf_cf', 'este tipo', 'bw_cf', 'Fas_cf'),
                                         ('cfo', 'bm_cfo', 'Cf_cfo', 'outro tipo', 'bw_cfo', 'Fas_cfo')):
    _T = f'AND(cf_T=1,{_Fas}>Fb_{_sx})'          # seção T além da mesa
    _TL = 'AND(cf_T=1,0.8*xlim_cf>hf_cf)'         # o limite de ductilidade cai na alma
    Lc(f'Mesa inteira comprimida Kfd·bm·hf ({_rot})', f'=Kfd_cf/10*{_bm}*hf_cf', 'kN', 'Zero na seção retangular.', 'res', '0.00', f'Fb_{_sx}')
    Lc(f'x com As,ef ({_rot})', f'=IF({_T},({_Fas}-{_cfm})/(0.8*Kfd_cf/10*{_bw}),{_Fas}/(0.8*Kfd_cf/10*{_bm}))', 'cm', 'T: F = abas + Kfd·bw·0,8x; retangular: F = Kfd·bm·0,8x.', 'res', '0.00', f'xas_{_sx}')
    Lc(f'M com As,ef ({_rot})', f'=IF({_T},{_cfm}*(d_cf-hf_cf/2)+({_Fas}-{_cfm})*(d_cf-0.4*xas_{_sx}),{_Fas}*IF(xas_{_sx}<=0.125*d_cf,0.95*d_cf,d_cf-0.4*xas_{_sx}))', 'kN·cm', 'T: abas·(d − hf/2) + alma·(d − 0,4x); retangular: F·z, z ≤ 0,95d.', 'res', '0.00', f'Mas_{_sx}')
    Lc(f'Força no limite ({_rot})', f'=IF({_TL},{_cfm}+0.8*Kfd_cf/10*{_bw}*xlim_cf,0.8*Kfd_cf/10*{_bm}*xlim_cf)', 'kN', '', 'res', '0.00', f'Flim_{_sx}')
    Lc(f'M no limite ({_rot})', f'=IF({_TL},{_cfm}*(d_cf-hf_cf/2)+0.8*Kfd_cf/10*{_bw}*xlim_cf*(d_cf-0.4*xlim_cf),0.8*Kfd_cf/10*{_bm}*xlim_cf*(d_cf-0.4*xlim_cf))', 'kN·cm', '', 'res', '0.00', f'Mlim_{_sx}')
    Lc(f'MRd do contraforte ({_rot})', f'=IF(AND(ISNUMBER({_Fas}),d_cf>0),IF({_Fas}<=Flim_{_sx},Mas_{_sx},Mlim_{_sx})/100,"—")', 'kN·m', 'Compara com o Md ' + ('(seção 1).' if _sx == 'cf' else 'do outro tipo (acima).'), 'key', '0.00', f'MRd_{_sx}', 'NBR 16868-1 11.3 (conta da flexão invertida)')
    Lc(f'x no MRd ({_rot})', f'=IF({_Fas}<=Flim_{_sx},IF({_T},xas_{_sx},1.25*d_cf*(1-SQRT(1-MRd_{_sx}*100/(0.5*{_bm}*d_cf^2*Kfd_cf/10)))),xlim_cf)', 'cm', '', 'res', '0.00', f'xM_{_sx}')
    Lc(f'MSd/MRd ({_rot})', f'=Md_{_sx}/MRd_{_sx}', '', '', 'key', '0.000', f'ap_{_sx}')
# Cortante: a resistência que as verificações usam — Vrd3 (Va + estribos; = Va sem estribo) e as bielas Vrd2.
Lc('VRd do contraforte = mín(Vrd3; Vrd2)', '=MIN(Vrd3_cf,Vrd2_cf)', 'kN', 'Sem estribo (dispensa pela conta), Vrd3 = Va. Este tipo; o outro tipo tem o VRd dele (seção 18; contraforte simples: o mesmo).', 'key', '0.00', 'VRd_cf', 'NBR 16868-1 11.4.3')
Lc('VSd/VRd (este tipo)', '=Vd_cf/VRd_cf', '', '', 'res', '0.000', 'apV_cf')
Lc('VSd/VRd (outro tipo)', '=Vd_cfo/VRd_cfo', '', 'Os estribos são os deste tipo (dobrado: c/20 em toda fiada): se o outro pedir estribo e este não, passa de 1. VRd do outro tipo na seção 18.', 'res', '0.000', 'apV_cfo')
# Painel: a conta das seções 9 e 10 é por FAIXA (b = espaçamento das barras) com o momento por metro × faixa; o MRd
# sai na faixa e volta por metro (kN·cm/m, a unidade dos Mdy/Mdyei/Mdx de Libânio). As verificações do painel não
# conferem a ductilidade: o limite é o fim da conta (x = 1,25d), como a aba faz.
r += 1
C.cell(row=r, column=1, value='Painel — flexão vertical (uma barra de cada face por faixa s; a mesma seção nos dois sinais)').font = fB; r += 1
mrd_ret(Lc, 'pv', 'a_pv', 'fsd_pv', '0.8*Kfd_pv', '0.5*Kfd_pv', 's_pv', 'd_pv', '1.25', True, '1,25·d (fim da conta)')
Lc('MRd vertical — barra do lado do solo (por metro)', '=IFERROR(MRf_pv*100/s_pv,"—")', 'kN·cm/m', 'Compara com o momento da barra do lado do solo (Mdyei; centralizada: o maior dos dois).', 'key', '0.0', 'MRd_pvs', 'NBR 16868-1 11.3 (conta da flexão invertida)')
Lc('MRd vertical — barra do lado externo (por metro)', '=IFERROR(MRd_pvs,"—")', 'kN·cm/m', 'Mesma barra, mesmo d (2 barras simétricas ou 1 centralizada). Compara com o Mdy.', 'key', '0.0', 'MRd_pve')
Lc('MSd/MRd vertical — lado do solo', '=IFERROR(M_pvs/MRd_pvs,"—")', '', '', 'key', '0.000', 'ap_pvs')
Lc('MSd/MRd vertical — lado externo', '=IFERROR(M_pve/MRd_pve,"—")', '', '', 'key', '0.000', 'ap_pve')
C.cell(row=r, column=1, value='Painel — flexão horizontal (uma barra Ø horizontal por faixa de canaleta; com 2 barras, uma em cada face)').font = fB; r += 1
mrd_ret(Lc, 'ph', 'a_ph', 'fsd_ph', '0.8*Kfd_ph', '0.5*Kfd_ph', 's_ph', 'd_ph', '1.25', True, '1,25·d (fim da conta)')
Lc('MRd horizontal (por metro)', '=IFERROR(MRf_ph*100/s_ph,"—")', 'kN·cm/m', 'Compara com o momento horizontal de cálculo (seção 10). Todas as canaletas têm o mesmo.', 'key', '0.0', 'MRd_ph', 'NBR 16868-1 11.3 (conta da flexão invertida)')
Lc('MSd/MRd horizontal', '=IFERROR(M_ph/MRd_ph,"—")', '', '', 'key', '0.000', 'ap_ph')
C.cell(row=r, column=1, value='Painel não armado entre barras e canaletas (seção 11) — resistência como momento').font = fB; r += 1
Lc('MRd,par = ftd,par·W (W = 100·t²/6)', '=ftdp_sp*(100*t_bloco^2/6)/10', 'kN·cm/m', 'A verificação σtd ≤ ftd escrita em momento; compara com o Md,par (seção 11).', 'key', '0.0', 'MRp_sp')
Lc('MRd,nor = ftd,nor·W', '=ftdn_sp*(100*t_bloco^2/6)/10', 'kN·cm/m', 'Compara com o Md,nor.', 'key', '0.0', 'MRn_sp')
Lc('Md,par/MRd,par (subpainel)', '=Mpar_sp/MRp_sp', '', '', 'res', '0.000', 'ap_psp')
Lc('Md,nor/MRd,nor (subpainel)', '=Mnor_sp/MRn_sp', '', '', 'res', '0.000', 'ap_nsp')
r += 1
# ---------- 17. aço do painel por metro (15/11, 2ª versão da vista "Esforços") ----------
# As seções 9 e 10 dão o As na FAIXA (b = espaçamento das barras); o diagrama do aço é por metro, como o do balanço e
# o da sapata: a mesma área dividida pela faixa. Só os picos (a placa de Libânio não dá o momento ao longo do vão).
section(C, r, '17. Aço do painel por metro (diagrama do aço)'); r += 1
Lc('Vertical, lado do solo: As necessário por metro', '=As_pvs*100/s_pv', 'cm²/m', 'Seção 9 (o As do momento, sem o mínimo).', 'res', '0.00', 'Amv_s')
Lc('Vertical, lado externo: As necessário por metro', '=As_pve*100/s_pv', 'cm²/m', 'Só com 2 barras por furo.', 'res', '0.00', 'Amv_e')
Lc('Vertical: As,mín por metro', '=As_pvm*100/s_pv', 'cm²/m', '', 'res', '0.00', 'Amv_m')
Lc('Vertical: As colocado por metro, em cada face', '=a_pv*100/s_pv', 'cm²/m', 'Uma barra por faixa em cada face (ou a centralizada).', 'res', '0.00', 'Amv_ef')
Lc('Horizontal: As necessário por metro', '=As_phc*100/s_ph', 'cm²/m', 'Seção 10 (o As do momento, sem o mínimo).', 'res', '0.00', 'Amh_n')
Lc('Horizontal: As,mín por metro', '=As_phm*100/s_ph', 'cm²/m', '', 'res', '0.00', 'Amh_m')
Lc('Horizontal: As colocado por metro, em cada face', '=a_ph*100/s_ph', 'cm²/m', 'Uma barra por canaleta (com 2 barras, uma em cada face).', 'res', '0.00', 'Amh_ef')
r += 1
# ---------- 18. contraforte dobrado (16/11) ----------
# Jose, 16/11: dois blocos lado a lado (2t + 1), todo grauteado, a montagem de dois contrafortes de ponta espelhados
# com 1 cm de argamassa; a ligação é o ESTRIBO, um só abraçando os dois, em toda fiada (c/20), mesmo quando a conta o
# dispensaria. Só o intermediário é dobrado: na ponta do muro e na junta o contraforte é a "metade" do dobrado (simples,
# com l/2 + balanço). Nas seções de cima: eenr (largura), n_cf par, As,máx de dois furos, Asw_c nunca zero, ram_ef 2 e
# s_est_u 20. O c da montagem e o d são os do simples: o furo da ponta de cada bloco é o do template L. No FIM da aba:
# nada de cima muda de lugar.
section(C, r, '18. Contraforte dobrado (dois blocos lado a lado, ligados pelo estribo)'); r += 1
Lc('Contraforte calculado é dobrado? (1 = sim)', '=IF(AND(larg_cf="Dobrado",LEFT(tipo_cf,5)="Inter"),1,0)', '', 'Dobrado nas Entradas e contraforte intermediário. Extremidade: simples.', 'res', '0', 'dob_cf', 'Critério adotado (contraforte dobrado)')
Lc('O outro tipo é dobrado? (1 = sim)', '=IF(AND(larg_cf="Dobrado",LEFT(tipo_cf,5)<>"Inter"),1,0)', '', 'Calculado = extremidade (simples) → o intermediário é o dobrado.', 'res', '0', 'dob_o')
Lc('Estribo: espaçamento usado', '=IF(dob_cf=1,20,s_est)', 'cm', 'Dobrado: toda fiada (20 cm); simples: o das Entradas.', 'res', '0', 's_est_u', 'NBR 16868-1 12.6')
Lc('Largura do outro tipo', '=IF(dob_o=1,2*t_bloco+1,t_bloco)', 'cm', '', 'res', '0.0', 'eenr_o')
Lc('bw do outro tipo', '=eenr_o', 'cm', '', 'res', '0.0', 'bw_cfo')
Lc('Aba do lado do vão no outro tipo', '=MIN(6*t_bloco,(l_cf_adot*100-IF(larg_cf="Dobrado",2*t_bloco+1,bw_cfo))/2)', 'cm', 'Como bf_a: metade do vão livre (com dobrado, o vão livre até o dobrado vizinho).', 'res', '0.0', 'bf_ao')
Lc('Barras do outro tipo ÷ barras deste', '=IF(dob_cf=1,0.5,IF(dob_o=1,2,1))', '', 'O dobrado leva o dobro do simples: metade em cada bloco.', 'res', '0.0', 'f_no')
Lc('Nº de barras do outro tipo', '=n_cf*f_no', '', '', 'res', '0', 'n_cfo')
Lc('As efetiva do outro tipo', '=As_cfe*f_no', 'cm²', '', 'res', '0.00', 'As_cfo')
Lc('Outro tipo: força no aço F = As,ef·fsd', '=As_cfo*fsd_cf/10', 'kN', '', 'res', '0.00', 'Fas_cfo')
Lc('Outro tipo: ρ = As,ef/(bw·d) ≤ 2%', '=MIN(As_cfo/(bw_cfo*d_cf),0.02)', '', '', 'res', '0.000000', 'rho_cfo')
Lc('Outro tipo: fvk = 0,35 + 17,5ρ ≤ 0,7', '=MIN(0.35+17.5*rho_cfo,0.7)', 'MPa', '', 'res', '0.000', 'fvk_cfo', 'NBR 16868-1 6.2.2.6')
Lc('Outro tipo: fvd = fvk/γm', '=fvk_cfo/gama_m', 'MPa', '', 'res', '0.000', 'fvd_cfo')
Lc('Outro tipo: Va = fvd·bw·d', '=fvd_cfo/10*bw_cfo*d_cf', 'kN', '', 'res', '0.00', 'Va_cfo')
Lc('Outro tipo: Vrd2 = Va + 0,4·bw·d·√fpk*/γm', '=Va_cfo+0.4*bw_cfo*d_cf*SQRT(fpk_chei)/gama_m/10', 'kN', '', 'res', '0.00', 'Vrd2_cfo', 'NBR 16868-1 11.4.3')
Lc('Outro tipo: Asw,mín = ρw·bw', '=rhow_cf/100*bw_cfo*100', 'cm²/m', '', 'res', '0.00', 'Asw_mo')
Lc('Outro tipo: Asw/s efetivo', '=IF(larg_cf<>"Dobrado",Asw_e,IF(Asw_co=0,0,ram_o*PI()*phi_est^2/400/s_o*100))', 'cm²/m', 'Contraforte simples: os estribos deste tipo. Com dobrado: os do outro tipo (seção 19: ramos e espaçamento dele).', 'res', '0.00', 'Asw_eo')
Lc('Outro tipo: Vrd3 = Va + 0,75·fywd·d·Asw/s', '=Va_cfo+0.75*fywd/10*d_cf*Asw_eo/100', 'kN', '', 'res', '0.00', 'Vrd3_cfo')
Lc('VRd do outro tipo = mín(Vrd3; Vrd2)', '=MIN(Vrd3_cfo,Vrd2_cfo)', 'kN', 'Simples: o mesmo VRd deste tipo.', 'key', '0.00', 'VRd_cfo', 'NBR 16868-1 11.4.3')
Lc('Dobrado: estribo', '=IF(larg_cf<>"Dobrado","— (contraforte simples)",IF(dob_cf=1,"Ø"&'+fphi('phi_est')+'&" c/20, "&ram_ef&" ramos, "&IF(ram_ef=4,"dois estribos de "&FIXED(w4_est,1)&" cm","um estribo de "&FIXED(eenr-7,0)&" cm")&" × "&FIXED(h_cf-9,0)&" cm abraçando os dois blocos, em toda fiada","Intermediário dobrado: Ø"&'+fphi('phi_est')+'&" c/20, "&ram_o&" ramos, abraçando os dois blocos, em toda fiada (seção 19)"))', '', 'Ligação dos dois blocos (amarração indireta).', 'res', None, 'est_dob', 'NBR 16868-1 3.3 e 12.6')
# DOIS ESTRIBOS POR FIADA NO DOBRADO (Jose, 16/11): quando um estribo (2 ramos c/20) não basta, o par leva dois
# estribos sobrepostos (4 ramos) — o estribo duplo da seção 6, com a largura do par: cada um com 2/3 da largura do de
# 2 ramos, deslocados ±1/6, os dois cruzando a junta entre os blocos. Cabe se o gancho de 135° do estribo menor chega a
# 5φ ≥ 5 cm (pg4_est já sai com eenr = 2t + 1) e se as barras de cada bloco ficam do lado de fora do ramo do meio
# (tabela mont_n4dE/A, POR BLOCO). Antes, todo dobrado de bloco 19 com fgk 20 reprovava pelo mínimo (3,12 < 3,28).
Lc('Dobrado: 2 ramos c/20 com o Ø das Entradas', '=2*PI()*phi_est^2/400/s_est_u*100', 'cm²/m', 'Um estribo por fiada.', 'res', '0.00', 'Asw_e2d')
Lc('Dobrado: dois estribos por fiada? (1 = sim)', '=IF(dob_cf=1,IF(OR(ramos_est=4,Asw_e2d<Asw_c-0.005),1,0),0)', '', '4 nas Entradas, ou um estribo não alcança o Asw/s de cálculo (seção 6).', 'res', '0', 'pd4_est', 'Critério adotado (Jose, 16/11)')
Lc('Dobrado com 4 ramos: barras do Ø das Entradas que cabem em cada bloco', '=IF(cf_T=1,INDEX(mont_n4dE,k_mont,MATCH(phi_cf,mont_phi,0)),INDEX(mont_n4dA,k_mont,MATCH(phi_cf,mont_phi,0)))', '', 'Furo comum, 15 mm de graute, espera ao lado; nenhuma barra sobre o ramo do meio. Montagens do Revit.', 'res', '0', 'nb4d_cab', 'Montagens do Revit (medido)')
Lc('Por que 4 ramos não cabem', '=IF(pg4_est<pgn_est-0.005,"gancho de "&FIXED(pg4_est,1)&" < "&FIXED(pgn_est,1)&" cm",IF(dob_cf=1,n_cf/2&" barras por bloco e só "&nb4d_cab&" cabem fora dos ramos do meio",n_cf&" barras e só "&nb4_cab&" cabem entre os ramos do meio"))', '', '', 'res', None, 'mot4_est')
r += 1
# ---------- 19. o outro tipo no veredito (16/11) ----------
# Com o dobrado, o contraforte da ponta (simples) e o intermediário (dobrado) têm seção e aço diferentes: verificar só o
# calculado deixava o outro sem conferência (achado da revisão de 16/11: intermediário com Vd 135 > VRd 92; ponta com
# Md 102,8 > MRd 95,3, sem acusar). As verificações do outro tipo, com a seção e o aço dele. Contraforte simples: o outro
# tem a mesma seção e o mesmo aço — as linhas dizem "— (mesma seção do calculado)". No FIM da aba.
section(C, r, '19. Verificações do outro tipo de contraforte (com o dobrado)'); r += 1
Lc('Outro tipo: espaçamento dos estribos', '=IF(dob_o=1,20,s_est)', 'cm', 'Dobrado: toda fiada; simples: o das Entradas.', 'res', '0', 's_o')
Lc('Outro tipo: Asw/s necessário = (Vd − Va)/(0,75·fywd·d)', '=MAX(0,(Vd_cfo-Va_cfo)/(0.75*fywd/10*d_cf)*100)', 'cm²/m', '', 'res', '0.00', 'Asw_no')
Lc('Outro tipo: Asw/s de cálculo', '=IF(dob_o=1,MAX(Asw_no,Asw_mo),IF(Vd_cfo<=Va_cfo,0,MAX(Asw_no,Asw_mo)))', 'cm²/m', 'Simples: zero se Vd ≤ Va. Dobrado: nunca zero.', 'key', '0.00', 'Asw_co')
Lc('Outro tipo: 4 ramos, largura de cada estribo', '=2*(eenr_o-7)/3', 'cm', '', 'res', '0.00', 'w4_o')
Lc('Outro tipo: ponta do gancho de 135° que cabe no estribo menor', '=(w4_o-phi_est/10-(1+SQRT(2)/2)*rd4_est)/(SQRT(2)/2)', 'cm', '', 'res', '0.00', 'pg4_o')
Lc('Outro tipo: barras cabem com 4 ramos? (1 = sim)', '=IF(dob_o=1,IF(n_cfo/2<=nb4d_cab,1,0),IF(n_cfo<=nb4_cab,1,0))', '', 'Dobrado: por bloco (mont_n4dE/A); simples: mont_n4E/A.', 'res', '0', 'n4ok_o')
Lc('Outro tipo: 4 ramos pedidos? (1 = sim)', '=IF(OR(ramos_est=4,AND(dob_o=1,2*PI()*phi_est^2/400/s_o*100<Asw_co-0.005)),1,0)', '', 'Dobrado: também quando um estribo por fiada não basta.', 'res', '0', 'pd4_o')
Lc('Outro tipo: ramos', '=IF(larg_cf<>"Dobrado",ram_ef,IF(pd4_o=1,IF(AND(pg4_o>=pgn_est-0.005,n4ok_o=1),4,2),2))', '', '4 só se os dois estribos couberem.', 'key', '0', 'ram_o')
Lc('Outro tipo: As,mín', '=IF(LEFT(AsMin_crit,4)="Viga",0.0015*bw_cfo*d_cf,0.001*bw_cfo*h_cf)', 'cm²', '', 'res', '0.00', 'Asm_cfo', 'NBR 16868-1 12.2')
_NA = '"— (mesma seção do calculado)"'
CHK_O = [
    ('Outro tipo: flexão MSd ≤ MRd (x ≤ 0,45d)', f'=IF(larg_cf<>"Dobrado",{_NA},IF(AND(ISNUMBER(MRd_cfo),Md_cfo<=MRd_cfo+0.005),"OK ("&FIXED(Md_cfo,2)&" ≤ "&FIXED(MRd_cfo,2)&" kN·m)","NÃO OK — "&tipo_cfo&": Md "&FIXED(Md_cfo,2)&" > MRd "&IF(ISNUMBER(MRd_cfo),FIXED(MRd_cfo,2),"—")&" kN·m"))', 'chk_fl_cfo'),
    ('Outro tipo: As,ef ≥ As,mín', f'=IF(larg_cf<>"Dobrado",{_NA},IF(As_cfo>=Asm_cfo-0.005,"OK ("&FIXED(As_cfo,2)&" ≥ "&FIXED(Asm_cfo,2)&" cm²)","NÃO OK — "&tipo_cfo&": "&FIXED(As_cfo,2)&" < "&FIXED(Asm_cfo,2)&" cm²"))', 'chk_Asm_cfo'),
    ('Outro tipo: bielas Vd ≤ Vrd2', f'=IF(larg_cf<>"Dobrado",{_NA},IF(Vd_cfo<=Vrd2_cfo,"OK ("&FIXED(Vd_cfo,1)&" ≤ "&FIXED(Vrd2_cfo,1)&")","NÃO OK — "&tipo_cfo&": Vd "&FIXED(Vd_cfo,1)&" > Vrd2 "&FIXED(Vrd2_cfo,1)&" kN"))', 'chk_bie_cfo'),
    ('Outro tipo: estribos', f'=IF(larg_cf<>"Dobrado",{_NA},IF(Asw_co=0,"Dispensa pela conta (Vd ≤ Va)",IF(Asw_eo>=Asw_co-0.005,"OK ("&FIXED(Asw_eo,2)&" ≥ "&FIXED(Asw_co,2)&" cm²/m; c/"&s_o&", "&ram_o&" ramos)","NÃO OK — "&tipo_cfo&": "&IF(AND(pd4_o=1,ram_o<>4),"4 ramos não cabem","estribo c/"&s_o&" com "&ram_o&" ramos não basta")&" ("&FIXED(Asw_eo,2)&" < "&FIXED(Asw_co,2)&" cm²/m)")))', 'chk_est_cfo'),
    ('Outro tipo: cortante Vd ≤ VRd', f'=IF(larg_cf<>"Dobrado",{_NA},IF(Vd_cfo<=VRd_cfo+0.005,"OK ("&FIXED(Vd_cfo,1)&" ≤ "&FIXED(VRd_cfo,1)&" kN)","NÃO OK — "&tipo_cfo&": Vd "&FIXED(Vd_cfo,1)&" > VRd "&FIXED(VRd_cfo,1)&" kN"))', 'chk_v_cfo'),
    ('Outro tipo: 4 ramos cabem', f'=IF(larg_cf<>"Dobrado",{_NA},IF(Asw_co=0,"— (sem estribo)",IF(pd4_o=0,"— (2 ramos)",IF(ram_o=4,"OK","NÃO OK — "&tipo_cfo&": 4 ramos não cabem ("&IF(pg4_o<pgn_est-0.005,"gancho de "&FIXED(pg4_o,1)&" < "&FIXED(pgn_est,1)&" cm",IF(dob_o=1,"as barras não ficam fora dos ramos do meio","as barras não cabem entre os ramos do meio"))&")"))))', 'chk_ram_cfo'),
]
for lab, f, nm in CHK_O:
    Lc(lab, f, '', '', 'key', None, nm)
Lc('Outro tipo: resumo', '=IF(larg_cf<>"Dobrado",' + _NA + ',IF(AND(' + ','.join(f'OR(LEFT({nm},2)="OK",LEFT({nm},3)="— (",LEFT({nm},4)="Disp")' for _l, _f, nm in CHK_O) + '),"OK","NÃO OK — "&tipo_cfo))', '', 'Entra no veredito do muro.', 'key', None, 'res_cfo')
widths(C, {'A': 46, 'B': 24, 'C': 10, 'D': 72, 'E': 22, 'G': 16})
for _cc in 'LMNOPQ':
    C.column_dimensions[_cc].hidden = True
C.freeze_panes = 'A4'
