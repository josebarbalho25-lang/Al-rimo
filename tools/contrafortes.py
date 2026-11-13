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
]
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
Lc('eenr (espessura do contraforte)', '=t_bloco', 'cm', 'Contraforte da largura do bloco (montagem fechada).', 'res', '0.0', 'eenr')
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
Lc('Aba de cada lado bf ≤ 6t', '=MIN(6*t_bloco,(l_cf_adot*100-bw_cf)/2)', 'cm', 'Lado do vão (limitada à metade do vão livre).', 'res', '0.0', 'bf_a')
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
Lc('Nº de barras', '=IF(ISNUMBER(n_cf_dir),n_cf_dir,MAX(2,ROUNDUP(As_cfc/a_cf-0.005,0)))', '', 'Entradas ou automático (mínimo 2).', 'key', '0', 'n_cf')
Lc('As efetiva', '=n_cf*a_cf', 'cm²', '', 'res', '0.00', 'As_cfe')
Lc('As,máx no furo da ponta', '=pAs_max*Ag_furo', 'cm²', '8% da área de graute, contando o traspasse.', 'res', '0.00', 'As_cfx', 'NBR 16868-1 12.3')
Lc('As no furo para comparar (com traspasse no concreto)', '=As_cfe*f_trasp', 'cm²', '2× (região de traspasse).', 'res', '0.00', 'As_cfx2')
# O furo REAL onde a barra passa (montagem do Revit): só INFORMA. A régua do As,máx continua a do curso (linha acima,
# com o Ag da tabela da aula, e a verificação da seção 15) — decisão do Jose (09/10): nenhuma verificação nova.
Lc('Furo comum da barra (fiadas P e I): área', '=IF(cf_T=1,INDEX(mont_AE,k_mont),INDEX(mont_AA,k_mont))', 'cm²', 'Montagem do Revit. Só informa.', 'res', '0.00', 'A_fcm', 'Montagens do Revit (medido)')
Lc('Barras do Ø das Entradas que cabem no furo comum', '=IF(cf_T=1,INDEX(mont_nE,k_mont,MATCH(phi_cf,mont_phi,0)),INDEX(mont_nA,k_mont,MATCH(phi_cf,mont_phi,0)))', '', '15 mm de graute até o bloco, espera ao lado (emenda). Só informa.', 'res', '0', 'nb_cab', 'NBR 16868-1 12.1 (graute 15 mm)')
Lc('Barras do Ø das Entradas pela taxa de 8% do furo comum, com traspasse', '=INT(pAs_max*A_fcm/(f_trasp*a_cf))', '', 'Só informa.', 'res', '0', 'nb_tx')
r += 1
_hyp_r = r
C.cell(row=r, column=1, value='Hipóteses de bitola (nº de barras para o As de cálculo; o que cabe no furo comum só informa)').font = fB; r += 1
header(C, r, ['Ø (mm)', 'As nec. (cm²)', 'Nº barras', 'As efetiva (cm²)', 'Cabem no furo comum (15 mm)', 'Pela taxa de 8% do furo comum']); r += 1
for ph in (10, 12.5, 16, 20):
    C.cell(row=r, column=1, value=ph)
    C.cell(row=r, column=2, value='=IFERROR(As_cfc,"—")')
    C.cell(row=r, column=3, value=f'=IFERROR(MAX(2,ROUNDUP(B{r}/(PI()*A{r}^2/400)-0.005,0)),"—")')
    C.cell(row=r, column=4, value=f'=IFERROR(C{r}*PI()*A{r}^2/400,"—")')
    C.cell(row=r, column=5, value=f'=IFERROR(IF(cf_T=1,INDEX(mont_nE,k_mont,MATCH(A{r},mont_phi,0)),INDEX(mont_nA,k_mont,MATCH(A{r},mont_phi,0))),"—")')
    C.cell(row=r, column=6, value=f'=IFERROR(INT(pAs_max*A_fcm/(f_trasp*PI()*A{r}^2/400)),"—")')
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
Lc('Asw/s de cálculo', '=IF(Vd_cf<=Va_cf,0,MAX(Asw_n,Asw_m))', 'cm²/m', 'Zero se Vd ≤ Va (dispensa estribo pela conta).', 'key', '0.00', 'Asw_c')
Lc('Ø necessário com os ramos e o espaçamento das Entradas', '=SQRT(s_est*4*Asw_c/100/(ramos_est*PI()))*10', 'mm', '', 'res', '0.0', 'phi_wn')
# Estribo só quando a conta pede (Jose, 13/10; planilha 05 do Carini: "Dispensa Estribos" se fvd ≥ τvd, que é o
# mesmo Vd ≤ Va daqui; o mínimo ρw·bw só vale do lado "com armadura"). Em alvenaria não se põe estribo sem
# necessidade: com Asw_c = 0 o muro sai SEM estribo — Asw,ef, Vrd3 = Va, nº de estribos 0 — e o app não desenha nenhum.
Lc('Asw/s efetivo', '=IF(Asw_c=0,0,ramos_est*PI()*phi_est^2/400/s_est*100)', 'cm²/m', 'Zero sem estribo (dispensa pela conta).', 'res', '0.00', 'Asw_e')
Lc('Vrd3 = Va + 0,75·fywd·d·Asw/s', '=Va_cf+0.75*fywd/10*d_cf*Asw_e/100', 'kN', '', 'res', '0.00', 'Vrd3_cf')
Lc('Estribo fechado (sugestão): largura × altura', '=IF(Asw_c=0,"Sem estribo (dispensa pela conta)",FIXED(eenr-7,0)&" × "&FIXED(h_cf-9,0)&" cm")', '', 'Largura = eenr − 7; altura = tenr − 9.', 'res')
Lc('Perímetro do estribo (sem ganchos)', '=IF(Asw_c=0,0,2*((eenr-7)+(h_cf-9)))', 'cm', 'Somar os ganchos do detalhe.', 'res', '0')
Lc('Nº de estribos na altura', '=IF(Asw_c=0,0,ROUNDUP(H_muro*100/s_est,0))', '', 'Um por junta de assentamento a cada s, na altura do muro; zero sem estribo (dispensa pela conta).', 'res', '0', 'n_est')
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
Lc('d horizontal', '=IF(LEFT(pos_ph,4)="Cent",t_bloco/2,t_bloco-c_pv)', 'cm', 'Centralizada na canaleta → d = t/2; encostada na face externa → d = t − c.', 'key', '0.0', 'd_ph')
Lc('Momento horizontal de cálculo', '=IF(LEFT(pos_ph,4)="Cent",MAX(Mdx_p,Mdxe_p),Mdx_p)', 'kN·cm/m', 'Barra centralizada atende os dois sinais (vão e engaste lateral).', 'res', '0.0', 'M_ph')
C.cell(row=r, column=1, value='Arranjos (faixa bm = espaçamento das canaletas; última coluna = As com a barra encostada na face, d = t − c)').font = fB; r += 1
ph0, ph1 = arr_table('ph', 'd_ph', 'Kfd_ph', 'M_ph', ['20', '40', '60', '80'], 'phi_ph', extra_d=('As com d = t − c, fyd (cm²)', '(t_bloco-c_pv)'))
Lc('Espaçamento das canaletas adotado', f'=IF(ISNUMBER(s_ph_dir),s_ph_dir,SUMPRODUCT(MAX((F{ph0}:F{ph1}="OK")*A{ph0}:A{ph1})))', 'cm', 'Entradas ou automático.', 'key', '0', 's_ph')
Lc('Md da faixa', '=M_ph*s_ph/100', 'kN·cm', '', 'res', '0.0', 'Md_ph')
Lc('x', '=IFERROR(1.25*d_ph*(1-SQRT(1-Md_ph/(0.5*s_ph*d_ph^2*Kfd_ph/10))),"não resiste")', 'cm', '', 'res', '0.00', 'x_ph')
Lc('fsd da barra horizontal', '=fyk_/gama_s', 'MPa', '', 'res', '0.0', 'fsd_ph')
Lc('As horizontal', '=IFERROR(Md_ph/(fsd_ph/10*MIN(d_ph-0.4*x_ph,0.95*d_ph)),"não resiste")', 'cm²', '', 'res', '0.00', 'As_phc')
Lc('As,mín da faixa', '=IF(LEFT(AsMin_crit,4)="Viga",0.0015*s_ph*d_ph,0.001*s_ph*t_bloco)', 'cm²', '', 'res', '0.00', 'As_phm')
Lc('Área da barra horizontal', '=PI()*phi_ph^2/400', 'cm²', '', 'res', '0.000', 'a_ph')
Lc('Precisa de barra do lado do solo junto ao contraforte?', '=IF(AND(LEFT(pos_ph,4)<>"Cent",Mdxe_p>0),"SIM — laterais engastadas com barra encostada na face externa: Mdxe traciona a face do solo. Usar barra centralizada ou 2 barras na canaleta","Não")', '', '', 'res')
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
Lc('ftd,par = ftk∥/γm', '=ftk_par/gama_m', 'MPa', '', 'res', '0.000')
Lc('σtd,nor = Md,nor/W', '=Mnor_sp/(100*t_bloco^2/6)*10', 'MPa', '', 'res', '0.000', 'st_nsp')
Lc('ftd,nor = ftk⊥/γm', '=ftk_nor/gama_m', 'MPa', '', 'res', '0.000')
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
els_block('eh', 'bm_eh', 'bw_eh', 'a_ph', 'd_ph', '0', 'c_pv', 'Ma_eh', 'Mr_eh', 'Im_eh')
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
Lc('Contraforte', '=n_cf&"Ø"&'+fphi('phi_cf')+'&" na ponta (d = "&FIXED(d_cf,1)&" cm) + "&n_cc&"Ø"&'+fphi('phi_cc')+'&" construtivas; "&IF(Asw_c=0,"sem estribos (dispensa pela conta)","estribos Ø"&'+fphi('phi_est')+'&" c/"&FIXED(s_est,0)&" ("&ramos_est&" ramos) nas juntas")', '', '', 'key')
Lc('Painel — vertical', '=IF(nb_pv=2,"Ø"&'+fphi('phi_pv')+'&" c/"&FIXED(s_pv,0)&" em CADA face (2 barras por furo, a "&'+fphi('c_pv')+'&" cm das faces)","Ø"&'+fphi('phi_pv')+'&" c/"&FIXED(s_pv,0)&" centralizada")', '', '', 'key')
Lc('Painel — horizontal', '="Ø"&'+fphi('phi_ph')+'&" c/"&FIXED(s_ph,0)&" em canaleta grauteada, "&IF(LEFT(pos_ph,4)="Cent","centralizada","encostada na face externa")', '', '', 'key')
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
    ('Contraforte: estribos', '=IF(Asw_c=0,"Dispensa pela conta (Vd ≤ Va)",IF(Asw_e>=Asw_c-0.005,"OK ("&FIXED(Asw_e,2)&" ≥ "&FIXED(Asw_c,2)&" cm²/m)","NÃO OK — aumentar Ø, ramos ou reduzir s"))'),
    ('Estribo cabe na junta (Ø ≤ 6,3 mm)', '=IF(Asw_c=0,"— (sem estribo)",IF(phi_est<=6.3,"OK","NÃO OK — Ø > 6,3 não cabe na junta de assentamento"))'),
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
    ('POSIÇÃO DAS BARRAS DO PAINEL', '=IF(nb_pv=2,"ATENÇÃO — verticais: uma barra encostada em CADA face (a "&'+fphi('c_pv')+'&" cm), não centralizar. Horizontais: "&IF(LEFT(pos_ph,4)="Cent","centralizadas na canaleta.","encostadas na face externa."),"Verticais centralizadas.")'),
    ('Muro de cima e vento', '=res_mc'),
]
for lab, f in CHK:
    Lc(lab, f, '', '', 'key')
widths(C, {'A': 46, 'B': 24, 'C': 10, 'D': 72, 'E': 22, 'G': 16})
for _cc in 'LMNOPQ':
    C.column_dimensions[_cc].hidden = True
C.freeze_panes = 'A4'
