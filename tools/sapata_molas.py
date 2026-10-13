# Executado dentro de build_new.py (mesmo namespace), DEPOIS do fundacao.py. Aba "Sapata sobre molas".
#
# Por que existe (Jose, 10/10 e 13/10): pela NBR 6118 22.6.1 a sapata do muro quase sempre é FLEXÍVEL (h menor que
# 2/3 do balanço), e para a flexível a norma (22.6.2.3) pede três coisas que a aba Fundação não faz: verificar a
# distribuição plana de tensões no solo, avaliar a concentração de flexão junto ao "pilar" (aqui, o contraforte) e
# verificar a punção. A aba Fundação continua sendo a conta de projeto (pressão linear, como sapata rígida); esta aba
# refaz a faixa como viga sobre molas e CONFERE se a altura e a armadura de lá aguentam. Ela não muda nenhum número da
# Fundação — só verifica. Assim as duas contas ficam lado a lado para auditar, e a regressão da Fundação não mexe.
#
# Contas sem matriz inversa: as molas são resolvidas nó a nó (a linha elástica integrada trecho a trecho, partindo da
# borda aterrada com recalque e giro desconhecidos; o fim livre na borda da frente dá duas equações). Só + − × ÷ —
# o motor do app reproduz o Excel no último dígito, e cada nó se confere com a calculadora.
from openpyxl.styles import Alignment as _Al

SM = wb.create_sheet('Sapata sobre molas', wb.sheetnames.index('Fundação') + 1)
title(SM, 'Sapata sobre molas — rígida × flexível, molas, torção e punção',
      'NBR 6118 22.6 e 19.5. Confere a sapata da aba Fundação (que usa pressão linear) com o solo como molas. '
      'x medido a partir da borda aterrada, para a frente. Cargas características por metro de muro. kN, m, kPa.')
header(SM, 3, ['Item', 'Valor', 'Unid.', 'Observação', 'Fonte'])
r = 4
def Ls(label, f, unit='', note='', kind='res', fmt=None, nm=None, src=None):
    global r
    line(SM, r, label, f, unit, note, kind, fmt, nm, src); r += 1

def _cel(ref, value, fmt=None, bold=False, fill=None):
    c = SM[ref]; c.value = value; c.border = BOX; c.font = fB if bold else fN
    c.alignment = _Al(horizontal='center')
    if fill is not None: c.fill = fill
    if fmt: c.number_format = fmt
    return c

def _rot(row, col, text, bold=False):
    c = SM.cell(row=row, column=col, value=text); c.font = fB if bold else fN; c.border = BOX
    return c

def _nota(text):
    global r
    SM.cell(row=r, column=1, value=text).font = fS; r += 1

# Funções de Krylov (Hetényi): base da solução fechada da viga sobre base elástica. u = λ·x.
def Y1(u): return f'(COSH({u})*COS({u}))'
def Y2(u): return f'((COSH({u})*SIN({u})+SINH({u})*COS({u}))/2)'
def Y3(u): return f'(SINH({u})*SIN({u})/2)'
def Y4(u): return f'((COSH({u})*SIN({u})-SINH({u})*COS({u}))/4)'

CF, NCF = 'Tipo_muro="Contrafortes"', 'Tipo_muro<>"Contrafortes"'
ENT, NENT = 'LEFT(pos_cf,4)="Ente"', 'LEFT(pos_cf,4)<>"Ente"'   # o motor do app não tem NÃO()

# ---------------------------------------------------------------- 1. classificação
section(SM, r, '1. Rígida ou flexível (NBR 6118 22.6.1)'); r += 1
Ls('Maior balanço livre (ponta ou talão)', '=MAX(toe,heel)', 'm', 'Medido da face do muro.', 'res', '0.000', 'bal_max')
Ls('h para ser rígida: h ≥ 2/3 do maior balanço', '=2/3*bal_max', 'm',
   'NBR: h ≥ (a − ap)/3 nas duas direções (com o pilar no centro, a − ap = 2 balanços). Muro fora do centro: o maior balanço (dedução). Só a direção da largura: no comprimento a sapata é corrida.',
   'res', '0.000', 'h_rig', 'NBR 6118 22.6.1; Bastos, Sapatas, 1.4')
Ls('Altura da sapata', '=h_sap', 'm', '', 'res', '0.000')
Ls('Classificação', '=IF(h_sap>=h_rig-0.0005,"Rígida","Flexível")', '',
   'Flexível: verificar a distribuição de tensões no solo, a concentração de flexão junto ao contraforte e a punção (22.6.2.3) — seções 3 a 9.',
   'key', None, 'cls_sap', 'NBR 6118 22.6.2.3')
r += 1

# ---------------------------------------------------------------- 2. rigidez
section(SM, r, '2. Rigidez da sapata e do solo'); r += 1
Ls('Eci = αE·5600·√fck', '=5600*SQRT(fck_s)', 'MPa', 'αE = 1,0 (granito, gnaisse). Basalto seria 1,2: com o módulo menor a pressão concentra mais (a favor).', 'res', '0', 'Eci_sap', 'NBR 6118 8.2.8')
Ls('αi = 0,8 + 0,2·fck/80 ≤ 1', '=MIN(1,0.8+0.2*fck_s/80)', '', '', 'res', '0.000', 'ai_sap', 'NBR 6118 8.2.8')
Ls('Ecs = αi·Eci', '=ai_sap*Eci_sap', 'MPa', '', 'res', '0', 'Ecs_sap', 'NBR 6118 8.2.8')
Ls('EI da faixa de 1 m = Ecs·h³/12', '=Ecs_sap*1000*h_sap^3/12', 'kN·m²/m', 'Seção bruta (dedução).', 'res', '0', 'EI_sap')
# O k é a entrada mais incerta da aba: as fontes divergem até 6 vezes para o mesmo solo (tabela logo abaixo). Por isso
# a verificação é uma ENVOLVENTE: k pequeno deixa a sapata rígida — e isso já é a conta linear da aba Fundação —, k
# grande concentra a pressão junto ao muro e ao contraforte, que é o que as molas mostram. A sugestão é a do Bowles
# (cresce com o σadm, não pede o tipo do solo de apoio); ela fica do lado de cima das argilas de Terzaghi, que é o
# lado que concentra. A tabela do TQS (Morrison) dá cerca do dobro: quem quiser digita.
Ls('Sugestão de k: 120·σadm', '=120*s_adm', 'kN/m³',
   'Bowles: k ≈ 40·FS·σadm (σ de ruptura sobre um recalque de 25 mm), FS = 3. Ordem de grandeza: preferir prova de carga em placa (NBR 6489).',
   'sug', '0', 'k_sug', 'Bowles, Foundation Analysis and Design, 5ª ed., 9-6')
Ls('k do solo (usado)', '=IF(ISNUMBER(ks_dir),ks_dir,k_sug)', 'kN/m³', 'Digitado nas Entradas manda.', 'key', '0', 'k_mola')
Ls('λ = (k/(4·EI))^¼', '=(k_mola/(4*EI_sap))^0.25', '1/m', 'Para a faixa de 1 m.', 'res', '0.0000', 'lam_sap', 'Hetényi (1946)')
Ls('λ·B', '=lam_sap*B_sap', '', '', 'res', '0.000', 'lamB_sap')
Ls('Pela rigidez relativa', '=IF(lamB_sap<=PI()/4,"Rígida (λB ≤ π/4)",IF(lamB_sap<PI(),"Intermediária (π/4 < λB < π)","Flexível (λB ≥ π)"))', '',
   'Classificação de viga sobre base elástica. Só informa: quem manda é a NBR (seção 1).', 'res', None, None, 'Hetényi (1946)')
r += 1
# Tabela de consulta do k. Valores conferidos em reproduções (Strand7, Bentley RAM, LUSAS, GeoStru, tese UENF no padrão
# Velloso & Lopes, manual TQS "K30 Terzaghi"); os originais de Bowles e Terzaghi não foram vistos.
header(SM, r, ['k — referências (consulta)', 'k (kN/m³)', 'Nesta largura B (faixa longa)', 'Observação', 'Fonte'])
SM.row_dimensions[r].height = 30; r += 1
KREF = [
    ('Areia fofa', '4.800 – 16.000', None, '', 'Bowles, Tab. 9-1'),
    ('Areia média', '9.600 – 80.000', None, '', 'Bowles, Tab. 9-1'),
    ('Areia compacta', '64.000 – 128.000', None, '', 'Bowles, Tab. 9-1'),
    ('Areia argilosa, média', '32.000 – 80.000', None, '', 'Bowles, Tab. 9-1'),
    ('Areia siltosa, média', '24.000 – 48.000', None, '', 'Bowles, Tab. 9-1'),
    ('Argila, σadm ≤ 200 kPa', '12.000 – 24.000', None, '', 'Bowles, Tab. 9-1'),
    ('Argila, 200 < σadm ≤ 800 kPa', '24.000 – 48.000', None, '', 'Bowles, Tab. 9-1'),
    ('Argila, σadm > 800 kPa', '> 48.000', None, 'Tabela para conferir a ordem de grandeza; não usar a média da faixa.', 'Bowles, Tab. 9-1'),
    ('Argila rija (qu 96 a 192 kPa)', 23600, '=23600*0.305/(1.5*B_sap)', 'k1 da placa de 0,30 m. Argila: k = k1·0,305/(1,5·B).', 'Terzaghi (1955)'),
    ('Argila muito rija (qu 192 a 383 kPa)', 47100, '=47100*0.305/(1.5*B_sap)', 'qu ≈ 2·su = 20·NSPT (su = 10·N, aba Solo e Empuxo).', 'Terzaghi (1955)'),
    ('Argila dura (qu > 383 kPa)', 94300, '=94300*0.305/(1.5*B_sap)', '', 'Terzaghi (1955)'),
    ('Areia fofa — seca ou úmida (submersa 7.900)', 12600, '=12600*((B_sap+0.305)/(2*B_sap))^2', 'Areia: k = k1·[(B + 0,305)/(2B)]².', 'Terzaghi (1955)'),
    ('Areia média — seca ou úmida (submersa 25.100)', 40800, '=40800*((B_sap+0.305)/(2*B_sap))^2', '', 'Terzaghi (1955)'),
    ('Areia compacta — seca ou úmida (submersa 94.300)', 157000, '=157000*((B_sap+0.305)/(2*B_sap))^2', '', 'Terzaghi (1955)'),
]
for lab, kv, kb, obs, fonte in KREF:
    _rot(r, 1, lab)
    _cel(f'B{r}', kv, '#,##0')
    _cel(f'C{r}', kb if kb else '—', '#,##0')
    SM.cell(row=r, column=4, value=obs).font = fS
    SM.cell(row=r, column=5, value=fonte).font = fS
    r += 1
_nota('k pequeno → sapata rígida → é a conta linear da aba Fundação. k grande → concentra junto ao muro e ao contraforte → '
      'é o que as molas mostram. A seção 9 vale o pior dos dois.')
r += 1

# ---------------------------------------------------------------- 3. cargas da faixa
section(SM, r, '3. Cargas na faixa de 1 m (características) — as mesmas da aba Fundação, seção 2', 12); r += 1
_nota('Cada parcela da tabela da Fundação ÷ comprimento do módulo, espalhada na largura em que ela atua (centro = o x da Fundação). '
      'Os momentos das forças horizontais entram em relação à base da sapata. Colunas I a L: termos da solução fechada (seção 6).')
header(SM, r, ['Parcela', 'N (kN/m) ou momento (kN·m/m)', 'x (m)', 'Largura (m)', 'Início (m)', 'Fim (m)', 'q (kPa)', 'P (kN/m)',
               'M em B (fechada)', 'V em B (fechada)', 'M na face de trás (fechada)', 'M na face da frente (fechada)'])
SM.row_dimensions[r].height = 42; r += 1
# Largura em que cada parcela da Fundação atua. Rótulo novo na tabela da Fundação sem entrada aqui = o build para
# (melhor que espalhar errado). "Sapata + dente" é o rótulo antigo; "Sapata" e "Dente" (com x = B/2 + x_den), o novo.
LARG = {
    'Muro (peso próprio)': '0',
    'Contraforte': f'IF({CF},(tenr_adot-t_bloco)/100,0)',
    'Sapata + dente': 'B_sap',
    'Sapata': 'B_sap',
    'Dente': 'b_den',
    'Solo sobre o talão': 'heel',
    'Sobrecarga sobre o talão': 'heel',
    'Carga permanente no topo': '0',
    'Subpressão (água)': 'B_sap',
    'Aterro sobre a ponta': 'toe',
}
for _lab, _f, _x in VERT:
    assert _lab in LARG, f'aba Sapata sobre molas: parcela nova na Fundação sem largura definida: {_lab!r}'
X_TRAS, X_FRENTE = '(a_ater-t_m/2)', '(a_ater+t_m/2)'
def _termos_fechada(rr, kind):
    """Colunas I a L da linha rr: M e V na borda da frente (x = B) e M nas faces do muro, pela solução fechada.
    kind 'v' = parcela da Fundação (distribuída se tem largura, concentrada se não); 'c' = momento aplicado."""
    out = {}
    for col, xx, what in (('I', 'B_sap', 'M'), ('J', 'B_sap', 'V'), ('K', X_TRAS, 'M'), ('L', X_FRENTE, 'M')):
        ini, fim = ('E', 'F') if kind == 'v' else ('C', 'C')
        ua, ub = f'lam_sap*MAX(0,{xx}-{ini}{rr})', f'lam_sap*MAX(0,{xx}-{fim}{rr})'
        if kind == 'v':
            if what == 'M':
                dist = f'-G{rr}/lam_sap^2*({Y3(ua)}-{Y3(ub)})'
                pto = f'-H{rr}/lam_sap*{Y2(ua)}'
            else:
                dist = f'-G{rr}/lam_sap*({Y2(ua)}-{Y2(ub)})'
                pto = f'-H{rr}*IF({xx}>=E{rr},{Y1(ua)},0)'
            out[col] = f'=IF(D{rr}>0,{dist},{pto})'
        else:
            if what == 'M':
                out[col] = f'=IF({xx}>=C{rr},B{rr}*{Y1(ua)},0)'
            else:
                out[col] = f'=-4*B{rr}*lam_sap*{Y4(ua)}'
    return out
c0 = r
for i, (_lab, _f, _x) in enumerate(VERT):
    fr = v0 + i   # linha da parcela na aba Fundação
    _rot(r, 1, _lab)
    _cel(f'B{r}', f"='Fundação'!B{fr}/Lm", '0.000')
    _cel(f'C{r}', f"='Fundação'!C{fr}", '0.000')
    _cel(f'D{r}', '=' + LARG[_lab], '0.000')
    _cel(f'E{r}', f'=IF(D{r}>0,C{r}-D{r}/2,C{r})', '0.000')
    _cel(f'F{r}', f'=IF(D{r}>0,C{r}+D{r}/2,C{r})', '0.000')
    _cel(f'G{r}', f'=IF(D{r}>0,B{r}/D{r},0)', '0.000')
    _cel(f'H{r}', f'=IF(D{r}>0,0,B{r})', '0.000')
    for col, f in _termos_fechada(r, 'v').items(): _cel(f'{col}{r}', f, '0.000')
    r += 1
c1 = r - 1   # última parcela vertical
# Momentos: o do muro chega no eixo; o empuxo na altura da própria sapata age na face aterrada (x = 0). Sentido +
# = empurra a frente para baixo (o mesmo do "M no centro" da Fundação, + para o pé).
MOM = [('Muro: Mk + Vk·h (base do muro levada à base da sapata)', '=Mk_+Vk_*h_sap', '=a_ater'),
       ('Empuxo na altura da sapata: h²·(2σ1 + σ2)/6', '=h_sap^2*(2*sh_base+sh_b2)/6', '=0')]
m0 = r
for _lab, _f, _x in MOM:
    _rot(r, 1, _lab)
    _cel(f'B{r}', _f, '0.000'); _cel(f'C{r}', _x, '0.000')
    for col in 'DEFGH': _cel(f'{col}{r}', '—')
    for col, f in _termos_fechada(r, 'c').items(): _cel(f'{col}{r}', f, '0.000')
    r += 1
name('Cw_sap', SM, f'B{m0}'); name('xw_sap', SM, f'C{m0}')
name('Cs_sap', SM, f'B{m0 + 1}'); name('xs_sap', SM, f'C{m0 + 1}')
_rot(r, 1, 'Σ', True)
_cel(f'B{r}', f'=SUM(B{c0}:B{c1})', '0.000', True)
for col in 'IJKL': _cel(f'{col}{r}', f'=SUM({col}{c0}:{col}{m0 + 1})', '0.000', True)
name('A0_sap', SM, f'I{r}'); name('B0_sap', SM, f'J{r}'); name('Mbf_cg', SM, f'K{r}'); name('Mff_cg', SM, f'L{r}')
r += 1
Ls('Conferência com a Fundação: Σ N e momento no centro',
   f'=IF(AND(ABS(SUM(B{c0}:B{c1})-N_tot/Lm)<0.001,ABS(SUMPRODUCT(B{c0}:B{c1},C{c0}:C{c1})-SUM(B{c0}:B{c1})*B_sap/2+Cw_sap+Cs_sap-M_cen/Lm)<0.001),"OK — mesmas cargas","NÃO OK — cargas diferentes da Fundação")',
   '', 'Σ N = N total da Fundação ÷ L; Σ N·(x − B/2) + momentos = M no centro ÷ L.', 'key', None, 'conf_cg')
r += 1

# ---------------------------------------------------------------- 4. malha
# 5 trechos no talão e 5 na ponta; o muro tem 2 (face de trás, eixo, face da frente). Com 10 + 10 e 5 passadas a aba
# passava de 5.500 células — 3,5 vezes o resto da planilha — e o app recalculava 5 vezes mais devagar (o app recalcula a
# cada tecla). Com 5 + 5 as molas seguem batendo com a solução fechada (diferença na linha "Molas × solução fechada") e
# a aba fica mais curta para auditar.
NH, NT = 5, 5
NN = NH + 2 + NT + 1         # nós
I_TRAS, I_EIXO, I_FRENTE = NH, NH + 1, NH + 2
section(SM, r, '4. Nós, molas e cargas nodais', 12); r += 1
_nota('Mola = k × trecho de influência do nó (metade do trecho de cada lado). Carga nodal = cada carga distribuída × '
      'pedaço dela dentro da influência do nó; concentrada vai inteira para o nó onde cai.')
NV = len(VERT)
cols_v = [_gl(9 + j) for j in range(NV)]          # I, J, ... uma coluna por parcela
col_P, col_Cm, col_Cc = _gl(9 + NV), _gl(10 + NV), _gl(11 + NV)
col_fF, col_fT = _gl(12 + NV), _gl(13 + NV)   # fração da influência além da seção a d (cortante)
header(SM, r, ['Nó', 'x (m)', 'Trecho até o próximo (m)', 'Influência: início (m)', 'Influência: fim (m)', 'Influência (m)',
               'Mola K (kN/m por m)', 'Onde'] + [VERT[j][0] for j in range(NV)]
       + ['P no nó (kN/m)', 'Momento no nó — faixa média (kN·m/m)', 'Momento no nó — junto ao contraforte (kN·m/m)',
          'Fração da influência além de d da face da frente', 'Fração da influência aquém de d da face de trás'])
SM.row_dimensions[r].height = 54; r += 1
n0 = r
ONDE = {0: 'borda aterrada', I_TRAS: 'face de trás do muro', I_EIXO: 'eixo do muro', I_FRENTE: 'face da frente do muro', NN - 1: 'borda da frente'}
for i in range(NN):
    rr = n0 + i
    _cel(f'A{rr}', i)
    if i <= NH:
        xf = f'={i}*heel/{NH}'
    elif i == I_EIXO:
        xf = '=a_ater'
    else:
        xf = f'=a_ater+t_m/2+{i - I_FRENTE}*toe/{NT}'
    _cel(f'B{rr}', xf, '0.000')
    _cel(f'C{rr}', f'=B{rr + 1}-B{rr}' if i < NN - 1 else 0, '0.000')
    _cel(f'D{rr}', f'=B{rr}-C{rr - 1}/2' if i > 0 else f'=B{rr}', '0.000')
    _cel(f'E{rr}', f'=B{rr}+C{rr}/2', '0.000')
    _cel(f'F{rr}', f'=E{rr}-D{rr}', '0.000')
    _cel(f'G{rr}', f'=k_mola*F{rr}', '0.0')
    _rot(rr, 8, ONDE.get(i, ''))
    # Concentrada: no nó cuja influência a contém (o último nó fica com o que cair em x = B).
    def _dentro(xx):
        return f'AND({xx}>=D{rr},{xx}<E{rr})' if i < NN - 1 else f'{xx}>=D{rr}'
    for j in range(NV):
        cr = c0 + j
        _cel(f'{cols_v[j]}{rr}', f'=IF($D${cr}>0,$G${cr}*MAX(0,MIN($F${cr},E{rr})-MAX($E${cr},D{rr})),IF({_dentro(f"$C${cr}")},$B${cr},0))', '0.000')
    _cel(f'{col_P}{rr}', f'=SUM({cols_v[0]}{rr}:{cols_v[-1]}{rr})', '0.000', True)
    _cel(f'{col_Cm}{rr}', f'=IF({_dentro("xw_sap")},Cw_sap,0)+IF({_dentro("xs_sap")},Cs_sap,0)', '0.000')
    _cel(f'{col_Cc}{rr}', f'=IF({_dentro("xw_sap")},Cw_sap+dM_cf,0)+IF({_dentro("xs_sap")},Cs_sap,0)', '0.000')
    # Cortante a d da face: a seção cai no meio da influência de algum nó. Conta só o pedaço da influência que fica do
    # lado de fora da seção (reação e carga uniformes dentro da influência). Somar o nó inteiro ou nada fazia o
    # cortante pular ~20% conforme a malha (medido: 23 × 13 nós).
    _cel(f'{col_fF}{rr}', f'=IF(F{rr}>0,MAX(0,MIN(1,(E{rr}-({X_FRENTE}+d_s/100))/F{rr})),IF(B{rr}>{X_FRENTE}+d_s/100,1,0))', '0.000')
    _cel(f'{col_fT}{rr}', f'=IF(F{rr}>0,MAX(0,MIN(1,(({X_TRAS}-d_s/100)-D{rr})/F{rr})),IF(B{rr}<{X_TRAS}-d_s/100,1,0))', '0.000')
n1 = n0 + NN - 1
r = n1 + 1
Ls('Conferência: Σ cargas nodais = Σ N', f'=IF(ABS(SUM({col_P}{n0}:{col_P}{n1})-SUM(B{c0}:B{c1}))<0.001,"OK","NÃO OK — carga fora da sapata")', '', '', 'key', None)
wb.defined_names['fr_frente'] = DefinedName('fr_frente', attr_text=f"'{SM.title}'!${col_fF}${n0}:${col_fF}${n1}")
wb.defined_names['fr_tras'] = DefinedName('fr_tras', attr_text=f"'{SM.title}'!${col_fT}${n0}:${col_fT}${n1}")
r += 1

# ---------------------------------------------------------------- 5 e 8. passadas das molas
def passadas(rotulo, col_C, tag, npass, so_contrafortes=False, contato=None):
    """Faixa sobre molas: npass passadas. Na 1ª trabalham as molas onde o diagrama linear comprime (ou as do contato
    final de outra faixa, `contato` = (coluna, 1ª linha)); da 2ª em diante
    solta a mola que ficou tracionada (o solo não puxa a sapata) e devolve a que voltou a comprimir. Cada passada é a
    linha elástica integrada nó a nó em três soluções — só cargas (recalque e giro zero na borda aterrada), recalque
    unitário e giro unitário — e o fim livre na borda da frente (M = 0 e V = 0) dá o recalque w0 e o giro θ0 de verdade.

    Custo (o app recalcula a planilha a cada tecla): passada em que nenhuma mola mudou REPETE a anterior célula a
    célula (o SE do Excel e o do motor só calculam o ramo que vale), e a faixa junto ao contraforte nem calcula no muro
    em balanço. Sem isso a aba custava 5 vezes o resto da planilha."""
    global r
    prev_T = None
    def fx(rr, col, inner, p, q0, prev_q0, chg_prev):
        f = inner
        if p > 1:
            f = f'IF({chg_prev}=0,{col}{rr - (q0 - prev_q0)},{f})'
        if so_contrafortes:
            f = f'IF({NCF},"—",{f})'
        return '=' + f
    for p in range(1, npass + 1):
        SM.cell(row=r, column=1, value=f'{rotulo} — passada {p}' + ((' (molas onde o diagrama linear comprime)' if contato is None else ' (contato final da faixa média)') if p == 1 else ' (solta a mola tracionada, devolve a comprimida; se nenhuma mudou, repete a anterior)')).font = fB; r += 1
        header(SM, r, ['Nó', 'Mola ativa', 'w só cargas (m)', 'θ só cargas', 'M só cargas (kN·m/m)', 'V só cargas (kN/m)',
                       'w com w0 = 1', 'θ com w0 = 1', 'M com w0 = 1', 'V com w0 = 1',
                       'w com θ0 = 1', 'θ com θ0 = 1', 'M com θ0 = 1', 'V com θ0 = 1',
                       'w (mm)', 'Reação R (kN/m)', 'σ = R/influência (kPa)', 'M (kN·m/m)', 'R − P (kN/m)',
                       'Mola na próxima'])
        SM.row_dimensions[r].height = 42; r += 1
        q0 = r
        q1 = q0 + NN - 1
        f0 = q1 + 1          # rodapé: sistema 2×2 e resultados
        W0, TH0 = f'$B${f0 + 3}', f'$B${f0 + 4}'
        chg_prev = f'$C${prev_f0 + 5}' if p > 1 else None
        F = lambda rr, col, inner: fx(rr, col, inner, p, q0, prev_q0 if p > 1 else q0, chg_prev)
        for i in range(NN):
            rr, nr = q0 + i, n0 + i
            K_, P_, C_ = f'$G${nr}', f'${col_P}${nr}', f'${col_C}${nr}'
            _cel(f'A{rr}', i)
            ini = f'IF(ABS(e_f)<=B_sap/6,1,IF(IF(e_f>=0,B_sap-$B${nr},$B${nr})<c_len,1,0))' if contato is None else f'${contato[0]}${contato[1] + i}'
            _cel(f'B{rr}', F(rr, 'B', ini) if prev_T is None
                 else ('=' + (f'IF({NCF},"—",' if so_contrafortes else '') + f'{prev_T}{rr - (q0 - prev_q0)}' + (')' if so_contrafortes else '')), '0')
            for cw, ct, cm, cv, sol in (('C', 'D', 'E', 'F', 'L'), ('G', 'H', 'I', 'J', 'w'), ('K', 'L', 'M', 'N', 't')):
                if i == 0:
                    _cel(f'{cw}{rr}', 1 if sol == 'w' else 0, '0.000000')
                    _cel(f'{ct}{rr}', 1 if sol == 't' else 0, '0.000000')
                    _cel(f'{cm}{rr}', F(rr, cm, C_) if sol == 'L' else 0, '0.000')
                else:
                    D_ = f'$C${nr - 1}'
                    a = rr - 1
                    _cel(f'{cw}{rr}', F(rr, cw, f'{cw}{a}+{ct}{a}*{D_}-({cm}{a}*{D_}*{D_}/2+{cv}{a}*{D_}*{D_}*{D_}/6)/EI_sap'), '0.000000')
                    _cel(f'{ct}{rr}', F(rr, ct, f'{ct}{a}-({cm}{a}*{D_}+{cv}{a}*{D_}*{D_}/2)/EI_sap'), '0.000000')
                    _cel(f'{cm}{rr}', F(rr, cm, f'{cm}{a}+{cv}{a}*{D_}' + (f'+{C_}' if sol == 'L' else '')), '0.000')
                termos = ([f'{cv}{rr - 1}'] if i > 0 else []) + ([f'-{P_}'] if sol == 'L' else []) + [f'B{rr}*{K_}*{cw}{rr}']
                _cel(f'{cv}{rr}', F(rr, cv, '+'.join(termos).replace('+-', '-')), '0.000')
            _cel(f'O{rr}', F(rr, 'O', f'(C{rr}+{W0}*G{rr}+{TH0}*K{rr})*1000'), '0.000', True)
            _cel(f'P{rr}', F(rr, 'P', f'B{rr}*{K_}*O{rr}/1000'), '0.000')
            _cel(f'Q{rr}', F(rr, 'Q', f'IF($F${nr}>0,P{rr}/$F${nr},0)'), '0.0', True)
            _cel(f'R{rr}', F(rr, 'R', f'E{rr}+{W0}*I{rr}+{TH0}*M{rr}'), '0.000', True)
            _cel(f'S{rr}', F(rr, 'S', f'P{rr}-{P_}'), '0.000')
            _cel(f'T{rr}', F(rr, 'T', f'IF(O{rr}>0,1,0)'), '0')
        r = f0
        for lab, fM in (('Borda da frente: M (só cargas · w0 = 1 · θ0 = 1)', ('E', 'I', 'M')),
                        ('Borda da frente: V (só cargas · w0 = 1 · θ0 = 1)', ('F', 'J', 'N'))):
            _rot(r, 1, lab)
            for k, cc in enumerate(fM): _cel(f'{"BCD"[k]}{r}', f'={cc}{q1}', '0.000000')
            r += 1
        mL, m1, m2 = f'B{f0}', f'C{f0}', f'D{f0}'
        vL, v1, v2 = f'B{f0 + 1}', f'C{f0 + 1}', f'D{f0 + 1}'
        _rot(r, 1, 'det = M(w0)·V(θ0) − M(θ0)·V(w0)'); _cel(f'B{r}', f'={m1}*{v2}-{m2}*{v1}', '0.000000'); r += 1
        _rot(r, 1, 'w0 = recalque na borda aterrada (m)'); _cel(f'B{r}', f'=({m2}*{vL}-{mL}*{v2})/B{f0 + 2}', '0.0000000', True); r += 1
        _rot(r, 1, 'θ0 = giro na borda aterrada (rad, + = frente desce)'); _cel(f'B{r}', f'=({mL}*{v1}-{m1}*{vL})/B{f0 + 2}', '0.0000000', True); r += 1
        _rot(r, 1, 'Molas ativas / que mudam para a próxima passada'); _cel(f'B{r}', f'=SUM(B{q0}:B{q1})', '0'); _cel(f'C{r}', f'=SUMPRODUCT(ABS(T{q0}:T{q1}-B{q0}:B{q1}))', '0'); r += 1
        _rot(r, 1, 'Equilíbrio: Σ reações − Σ cargas (kN/m) · M na borda da frente (kN·m/m)')
        # Resto que deveria ser zero: abaixo de 1e-9 é arredondamento (o Excel e o app arredondam diferente no último
        # dígito de uma soma que se cancela) e aparece 0; erro de verdade passa disso de longe.
        _res = lambda f: f'IF(ABS({f})<0.000000001,0,{f})'
        _cel(f'B{r}', '=' + _res(f'SUM(P{q0}:P{q1})-SUM(${col_P}${n0}:${col_P}${n1})'), '0.000000'); _cel(f'C{r}', '=' + _res(f'R{q1}'), '0.000000'); r += 2
        prev_T, prev_q0, prev_f0 = 'T', q0, f0
        last = (q0, q1, f0)
    q0, q1, f0 = last
    # resultados da última passada, com nome
    name(f'conv_{tag}', SM, f'C{f0 + 5}')       # molas que ainda mudariam (0 = convergiu)
    wb.defined_names[f'sig_{tag}'] = DefinedName(f'sig_{tag}', attr_text=f"'{SM.title}'!$Q${q0}:$Q${q1}")
    wb.defined_names[f'RP_{tag}'] = DefinedName(f'RP_{tag}', attr_text=f"'{SM.title}'!$S${q0}:$S${q1}")
    return q0, q1, f0

section(SM, r, '5. Faixa média sobre molas', 20); r += 1
_nota('Convenção: w para baixo (recalque); M positivo traciona embaixo; V = soma das forças para cima à esquerda do nó; '
      'momento aplicado + empurra a frente para baixo. Cada nó: w, θ, M e V do nó anterior levados pelo trecho (viga sem carga), '
      'depois a carga, o momento e a mola do nó.')
qm0, qm1, fm0 = passadas('Faixa média', col_Cm, 'mm', 3)
Ls('Passadas convergiram?', '=IF(conv_mm=0,"Sim","NÃO — molas ainda mudando na última passada")', '', '', 'key', None, 'cvg_mm')
Ls('σ máx no solo — molas', '=MAX(sig_mm)', 'kPa', '', 'key', '0.0', 'sh_mm')
Ls('Molas soltas (sapata descolada)', f'=NN_sap-SUM(B{qm0}:B{qm1})', '', '', 'res', '0', 'solta_mm')
Ls('Mk na face da frente — ponta (traciona embaixo)', f'=R{qm0 + I_FRENTE}', 'kN·m/m', '', 'key', '0.00', 'Mt_mm')
Ls('Mk na face de trás — talão (traciona em cima)', f'=-R{qm0 + I_TRAS}', 'kN·m/m', '', 'key', '0.00', 'Mh_mm')
Ls('Vk ponta a d da face', '=SUMPRODUCT(fr_frente,RP_mm)', 'kN/m', 'Σ (R − P) × fração da influência além da seção (seção 4).', 'res', '0.00', 'Vt_mm')
Ls('Vk talão a d da face', '=-SUMPRODUCT(fr_tras,RP_mm)', 'kN/m', '', 'res', '0.00', 'Vh_mm')
r += 1

# ---------------------------------------------------------------- 6. solução fechada
section(SM, r, '6. Faixa média — solução fechada (viga sobre base elástica contínua, sapata toda apoiada)', 12); r += 1
_nota('Mesma faixa, sem nós: funções de Krylov Y1 = ch·cos, Y2 = (ch·sen + sh·cos)/2, Y3 = sh·sen/2, Y4 = (ch·sen − sh·cos)/4 '
      'de λx. Borda aterrada livre com recalque w0 e giro θ0; borda da frente livre: M(B) = 0 e V(B) = 0. Vale só se o solo comprimir a base toda.')
uB = 'lam_sap*B_sap'
Ls('Y1(λB) · Y2(λB) · Y3(λB) · Y4(λB)', f'=FIXED({Y1(uB)},5)&" · "&FIXED({Y2(uB)},5)&" · "&FIXED({Y3(uB)},5)&" · "&FIXED({Y4(uB)},5)', '', '', 'res')
Ls('M(B) = 4EIλ²·Y3·w0 + 4EIλ·Y4·θ0 + Σ cargas = 0: coef. de w0', f'=4*EI_sap*lam_sap^2*{Y3(uB)}', '', '', 'res', '0.000', 'a1_sap')
Ls('coef. de θ0', f'=4*EI_sap*lam_sap*{Y4(uB)}', '', '', 'res', '0.000', 'a2_sap')
Ls('V(B) = 4EIλ³·Y2·w0 + 4EIλ²·Y3·θ0 + Σ cargas = 0: coef. de w0', f'=4*EI_sap*lam_sap^3*{Y2(uB)}', '', '', 'res', '0.000', 'b1_sap')
Ls('coef. de θ0', f'=4*EI_sap*lam_sap^2*{Y3(uB)}', '', '', 'res', '0.000', 'b2_sap')
Ls('Σ cargas em M(B) · em V(B)', '=FIXED(A0_sap,4)&" · "&FIXED(B0_sap,4)', '', 'Tabela da seção 3, colunas I e J.', 'res')
Ls('w0 (m)', '=(a2_sap*B0_sap-A0_sap*b2_sap)/(a1_sap*b2_sap-a2_sap*b1_sap)', 'm', '', 'res', '0.0000000', 'w0_cf')
Ls('θ0 (rad)', '=(A0_sap*b1_sap-a1_sap*B0_sap)/(a1_sap*b2_sap-a2_sap*b1_sap)', 'rad', '', 'res', '0.0000000', 't0_cf')
r += 1
header(SM, r, ['Nó', 'x (m)', 'w0·Y1 + θ0/λ·Y2 (m)'] + [VERT[j][0] for j in range(NV)] + ['Muro: momento', 'Empuxo na sapata: momento', 'w (mm)', 'σ = k·w (kPa)'])
SM.row_dimensions[r].height = 54; r += 1
g0 = r
cw_m = [_gl(4 + j) for j in range(NV + 2)]          # termos de w de cada carga
col_w, col_s = _gl(6 + NV), _gl(7 + NV)
for i in range(NN):
    rr, nr = g0 + i, n0 + i
    _cel(f'A{rr}', i); _cel(f'B{rr}', f'=$B${nr}', '0.000')
    ux = f'lam_sap*B{rr}'
    _cel(f'C{rr}', f'=w0_cf*{Y1(ux)}+t0_cf/lam_sap*{Y2(ux)}', '0.0000000')
    for j in range(NV):
        cr = c0 + j
        ua, ub = f'lam_sap*MAX(0,B{rr}-$E${cr})', f'lam_sap*MAX(0,B{rr}-$F${cr})'
        dist = f'$G${cr}/k_mola*((1-{Y1(ua)})-(1-{Y1(ub)}))'
        pto = f'$H${cr}/(EI_sap*lam_sap^3)*{Y4(ua)}'
        _cel(f'{cw_m[j]}{rr}', f'=IF($D${cr}>0,{dist},{pto})', '0.0000000')
    for k, mr in enumerate((m0, m0 + 1)):
        ua = f'lam_sap*MAX(0,B{rr}-$C${mr})'
        _cel(f'{cw_m[NV + k]}{rr}', f'=-$B${mr}/(EI_sap*lam_sap^2)*{Y3(ua)}', '0.0000000')
    _cel(f'{col_w}{rr}', f'=SUM(C{rr}:{cw_m[-1]}{rr})*1000', '0.000', True)
    _cel(f'{col_s}{rr}', f'=k_mola*{col_w}{rr}/1000', '0.0', True)
g1 = g0 + NN - 1
r = g1 + 1
wb.defined_names['sig_cf'] = DefinedName('sig_cf', attr_text=f"'{SM.title}'!${col_s}${g0}:${col_s}${g1}")
ut, uf = f'lam_sap*{X_TRAS}', f'lam_sap*{X_FRENTE}'
Ls('Sapata toda apoiada (σ ≥ 0 em todos os nós)?', '=IF(MIN(sig_cf)>=0,"Sim","Não — parte descola: a solução fechada não vale, fica a das molas")', '', '', 'key', None, 'apoio_cf')
Ls('σ máx no solo — fechada', '=MAX(sig_cf)', 'kPa', '', 'res', '0.0', 'sh_cf')
Ls('Mk na face da frente — ponta', f'=4*EI_sap*lam_sap^2*w0_cf*{Y3(uf)}+4*EI_sap*lam_sap*t0_cf*{Y4(uf)}+Mff_cg', 'kN·m/m', 'Coluna L da seção 3 + parcelas de w0 e θ0.', 'res', '0.00', 'Mt_cf')
Ls('Mk na face de trás — talão (traciona em cima)', f'=-(4*EI_sap*lam_sap^2*w0_cf*{Y3(ut)}+4*EI_sap*lam_sap*t0_cf*{Y4(ut)}+Mbf_cg)', 'kN·m/m', 'Coluna K da seção 3.', 'res', '0.00', 'Mh_cf')
r += 1

# ---------------------------------------------------------------- 7. torção longitudinal
section(SM, r, '7. Entre contrafortes — concentração junto ao contraforte (torção sobre base elástica)'); r += 1
_nota('O momento do muro chega no contraforte e a sapata o espalha ao longo do módulo torcendo. Solo como molas de giro '
      'kθ = k·B³/12 por metro; GJ·φ″ = kθ·φ entre dois contrafortes iguais → φ = A·ch(β(x − L/2)), β = √(kθ/GJ).')
Ls('Momento que chega em cada contraforte: (Mk + Vk·h)·L', f'=IF({CF},(Mk_+Vk_*h_sap)*Lm,0)', 'kN·m',
   'Todo o momento do muro do módulo pelo contraforte (limite superior, como a aba Fundação, seção 8).', 'res', '0.00', 'Mc_cf')
Ls('kθ = k·B³/12', '=k_mola*B_sap^3/12', 'kN·m/rad por m', 'Base inteira comprimida (a favor: com descolamento seria menor e concentraria menos).', 'res', '0.0', 'kt_sap')
Ls('G = Ecs/2,4', '=Ecs_sap/2.4', 'MPa', '', 'res', '0', 'G_sap', 'NBR 6118 8.2.9')
Ls('J = a·b³·[1/3 − 0,21·(b/a)·(1 − (b/a)⁴/12)]', '=MAX(B_sap,h_sap)*MIN(B_sap,h_sap)^3*(1/3-0.21*MIN(B_sap,h_sap)/MAX(B_sap,h_sap)*(1-(MIN(B_sap,h_sap)/MAX(B_sap,h_sap))^4/12))', 'm⁴',
   'Retângulo maciço a × b (a ≥ b).', 'res', '0.000000', 'J_sap', 'Roark, Formulas for Stress and Strain')
Ls('GJ usado = 0,15·G·J', '=0.15*G_sap*1000*J_sap', 'kN·m²', 'Rigidez à torção reduzida pela fissuração. Menor GJ concentra mais (a favor).', 'res', '0', 'GJ_sap', 'NBR 6118 14.6.7.2')
Ls('β = √(kθ/GJ)', '=SQRT(kt_sap/GJ_sap)', '1/m', '', 'res', '0.0000', 'bet_sap')
Ls('β·L/2', '=bet_sap*Lm/2', '', '', 'res', '0.000', 'bL2_sap')
Ls('Fator de concentração junto ao contraforte = (βL/2)/th(βL/2)', f'=IF({CF},bL2_sap/TANH(bL2_sap),1)', '',
   '1 = espalha por igual no módulo (sapata rígida).', 'key', '0.000', 'fc_cf')
Ls('Momento por metro: média M/L · junto ao contraforte', f'=IF({CF},FIXED(Mc_cf/Lm,2)&" · "&FIXED(fc_cf*Mc_cf/Lm,2),"— (muro em balanço)")', 'kN·m/m', '', 'res')
Ls('ΔM a somar na faixa junto ao contraforte = (fator − 1)·M/L', f'=IF({CF},(fc_cf-1)*Mc_cf/Lm,0)', 'kN·m/m', 'Entra no eixo do muro (seção 8).', 'key', '0.000', 'dM_cf')
Ls('Torção na sapata junto ao contraforte', f'=IF({CF},"M/2 de cada lado, qualquer que seja β — a seção 8 da Fundação (TSd = Md/2) não muda","— (muro em balanço)")', '',
   'Equilíbrio do vão entre dois contrafortes iguais. No contraforte da ponta o momento é cerca da metade e o vão também: o pico por metro é o mesmo (dedução).', 'res')
header(SM, r, ['Posição no módulo', 'x/L', 'Momento por metro / média', '', ''])
r += 1
for fr_, lab in ((0, 'junto ao contraforte'), (0.125, ''), (0.25, ''), (0.375, ''), (0.5, 'meio do vão')):
    _rot(r, 1, lab); _cel(f'B{r}', fr_, '0.000')
    _cel(f'C{r}', f'=IF({CF},bL2_sap*COSH(bet_sap*Lm*(B{r}-0.5))/SINH(bL2_sap),1)', '0.000')
    r += 1
r += 1

# ---------------------------------------------------------------- 8. faixa junto ao contraforte
section(SM, r, '8. Faixa junto ao contraforte sobre molas (faixa média + ΔM no eixo do muro)', 20); r += 1
_nota('Só muda o momento no nó do eixo do muro (coluna "junto ao contraforte" da seção 4). Enterrado: o talão dessa faixa é '
      'a base do contraforte, vale a ponta; aparente: vale o talão.')
qc0, qc1, fc0_ = passadas('Junto ao contraforte', col_Cc, 'mc', 2, so_contrafortes=True, contato=('T', qm0))
Ls('Passadas convergiram?', f'=IF({CF},IF(conv_mc=0,"Sim","NÃO — molas ainda mudando na última passada"),"— (muro em balanço)")', '', '', 'key', None, 'cvg_mc')
Ls('σ máx no solo — junto ao contraforte', f'=IF({CF},MAX(sig_mc),"— (muro em balanço)")', 'kPa', '', 'key', '0.0', 'sh_mc')
Ls('Mk ponta (vale com contraforte enterrado)', f'=IF({CF},R{qc0 + I_FRENTE},"— (muro em balanço)")', 'kN·m/m', '', 'res', '0.00', 'Mt_mc')
Ls('Mk talão (vale com contraforte aparente)', f'=IF({CF},-R{qc0 + I_TRAS},"— (muro em balanço)")', 'kN·m/m', '', 'res', '0.00', 'Mh_mc')
Ls('Vk ponta a d da face', f'=IF({CF},SUMPRODUCT(fr_frente,RP_mc),"— (muro em balanço)")', 'kN/m', '', 'res', '0.00', 'Vt_mc')
Ls('Vk talão a d da face', f'=IF({CF},-SUMPRODUCT(fr_tras,RP_mc),"— (muro em balanço)")', 'kN/m', '', 'res', '0.00', 'Vh_mc')
r += 1

# ---------------------------------------------------------------- 9. comparação e verificação da armadura
section(SM, r, '9. Linear (Fundação) × molas — a altura e a armadura da Fundação aguentam?', 7); r += 1
header(SM, r, ['Grandeza', 'Linear (aba Fundação)', 'Molas — faixa média', 'Fechada — faixa média', 'Molas — junto ao contraforte', 'Maior', 'Unid.'])
SM.row_dimensions[r].height = 42; r += 1
def _num(x): return f'IF(ISNUMBER({x}),{x},0)'
CMP = [
    ('σ máx no solo', 's_hi', 'sh_mm', 'sh_cf', f'IF({CF},sh_mc,"—")', 'kPa', 'cmp_sig'),
    ('Mk ponta', 'Mk_toe', 'Mt_mm', 'Mt_cf', f'IF(AND({CF},{ENT}),Mt_mc,"—")', 'kN·m/m', 'cmp_Mt'),
    ('Mk talão', 'Mk_heel', 'Mh_mm', 'Mh_cf', f'IF(AND({CF},{NENT}),Mh_mc,"—")', 'kN·m/m', 'cmp_Mh'),
    ('Vk ponta a d', 'Vsd_t/1.4', 'Vt_mm', '"—"', f'IF(AND({CF},{ENT}),Vt_mc,"—")', 'kN/m', 'cmp_Vt'),
    ('Vk talão a d', 'Vsd_h/1.4', 'Vh_mm', '"—"', f'IF(AND({CF},{NENT}),Vh_mc,"—")', 'kN/m', 'cmp_Vh'),
]
for lab, a_, b_, c_, d_, un, nm_ in CMP:
    _rot(r, 1, lab)
    for k, f in enumerate((a_, b_, c_, d_)):
        _cel(f'{"BCDE"[k]}{r}', '=' + f, '0.00')
    # a fechada só entra se a sapata estiver toda apoiada (senão a conta dela não vale)
    _cel(f'F{r}', f'=MAX({_num(f"B{r}")},{_num(f"C{r}")},IF(apoio_cf="Sim",{_num(f"D{r}")},0),{_num(f"E{r}")})', '0.00', True)
    _rot(r, 7, un)
    name(nm_, SM, f'F{r}')
    r += 1
_nota('A pressão no solo (σ ≤ σadm) continua sendo verificada na Fundação, com o diagrama linear (NBR 6122 7.6): o pico '
      'das molas é para o concreto, não para o solo.')
r += 1
Ls('fyd', '=fyk_/gama_s/10', 'kN/cm²', '', 'res', '0.000', 'fyd_sm')
Ls('x com o As da Fundação = As·fyd/(0,68·b·fcd)', '=As_ps*fyd_sm/(0.68*100*fcd_s/10)', 'cm', 'As principal da Fundação, nas duas faces.', 'res', '0.00', 'x_sm')
Ls('MRd = As·fyd·(d − 0,4x)', '=As_ps*fyd_sm*(d_s-0.4*x_sm)/100', 'kN·m/m', '', 'key', '0.00', 'MRd_sm')
Ls('Md maior (ponta e talão, todas as contas) = 1,4·Mk', '=1.4*MAX(0,cmp_Mt,cmp_Mh)', 'kN·m/m', '', 'key', '0.00', 'Md_sm')
Ls('VSd maior = 1,4·Vk', '=1.4*MAX(0,cmp_Vt,cmp_Vh)', 'kN/m', 'Compara com o VRd1 da Fundação.', 'key', '0.00', 'Vd_sm')
r += 1

# ---------------------------------------------------------------- 10. punção e compressão diagonal
section(SM, r, '10. Punção e compressão diagonal (NBR 6118 19.5)'); r += 1
# K da Tabela 19.2 interpolado (C1/C2 abaixo de 0,5 fica 0,45; acima de 3, 0,80) — interpolar é dedução.
def Ktab(rz): return f'IF({rz}<=0.5,0.45,IF({rz}<=1,0.45+({rz}-0.5)*0.3,IF({rz}<=2,0.6+({rz}-1)*0.1,IF({rz}<=3,0.7+({rz}-2)*0.1,0.8))))'
Ls('τRd2 = 0,27·αv·fcd, αv = 1 − fck/250', '=0.27*(1-fck_s/250)*fcd_s', 'MPa', '', 'res', '0.000', 'tRd2_sm', 'NBR 6118 19.5.3.1')
SM.cell(row=r, column=1, value='Contorno C na face do muro (faixa de 1 m)').font = fB; r += 1
_iv = {lab: v0 + j for j, (lab, _, _) in enumerate(VERT)}   # linha de cada parcela na aba Fundação
Ls('FSd = 1,4·(peso do muro + carga no topo)/L', f"=1.4*('Fundação'!B{_iv['Muro (peso próprio)']}+'Fundação'!B{_iv['Carga permanente no topo']})/Lm", 'kN/m', 'Sem descontar a reação do solo (a favor), como Bastos, Ex. 6 e 7.', 'res', '0.00', 'Fw_sm', 'Bastos, Sapatas, 1.7.2')
Ls('MSd = 1,4·Mk na base do muro', '=1.4*Mk_', 'kN·m/m', '', 'res', '0.00', 'Mw_sm')
Ls('u0 = 2·(t + 100) · Wp0 = t²/2 + 100·t (C1 = t, C2 = 100 cm)', '=FIXED(2*(t_bloco+100),0)&" cm · "&FIXED(t_bloco^2/2+100*t_bloco,0)&" cm²"', '', 'K = 0,45 (C1/C2 < 0,5). Com o momento do muro (dedução, a favor).', 'res')
Ls('τSd = FSd/(u0·d) + K·MSd/(Wp0·d)', '=(Fw_sm/(2*(t_bloco+100)*d_s)+0.45*Mw_sm*100/((t_bloco^2/2+100*t_bloco)*d_s))*10', 'MPa', '', 'key', '0.000', 'tw_sm', 'NBR 6118 19.5.2.2 e 19.5.3.1')
SM.cell(row=r, column=1, value='Junto ao contraforte (pilar C1 = comprimento do contraforte, C2 = espessura)').font = fB; r += 1
Ls('C1 · C2', f'=IF({CF},FIXED(tenr_adot,0)&" · "&FIXED(t_bloco,0)&" cm","—")', 'cm', 'C1 na direção do momento (perpendicular ao muro).', 'res')
Ls('K = Tabela 19.2 por C1/C2 (interpolado)', '=' + Ktab('tenr_adot/t_bloco'), '', '', 'res', '0.000', 'K_pun', 'NBR 6118 Tab. 19.2')
Ls('FSd = 1,4·peso do contraforte', f"=IF({CF},1.4*'Fundação'!B{_iv['Contraforte']},0)", 'kN', 'Sem descontar a reação do solo dentro do contorno (a favor).', 'res', '0.00', 'Fc_pun')
Ls('MSd = Md do contraforte', f'=IF({CF},Md_cf,0)', 'kN·m', 'Aba Contrafortes.', 'res', '0.00', 'Mc_pun')
Ls('Contorno C: τSd = FSd/(u0·d) + K·MSd/(Wp0·d), u0 = 2(C1 + C2), Wp0 = C1²/2 + C1·C2',
   f'=IF({CF},(Fc_pun/(2*(tenr_adot+t_bloco)*d_s)+K_pun*Mc_pun*100/((tenr_adot^2/2+tenr_adot*t_bloco)*d_s))*10,0)', 'MPa', '', 'key', '0.000', 'tc_sm', 'NBR 6118 19.5.3.1')
Ls('Distância da ponta do contraforte à borda', f'=IF({CF},IF({ENT},heel,toe)*100-(tenr_adot-t_bloco),0)', 'cm', '', 'res', '0.0', 'e1_pun')
Ls('Distância da face do muro à borda do outro lado', f'=IF({CF},IF({ENT},toe,heel)*100,0)', 'cm', '', 'res', '0.0', 'e2_pun')
Ls('Contorno C\' a 2d', f'=IF({NCF},"— (muro em balanço)",IF(AND(e1_pun>=2*d_s,e2_pun>=2*d_s),"Interno",IF(OR(e1_pun>=2*d_s,e2_pun>=2*d_s),"De borda","Cortado nos dois lados")))', '',
   'Cortado nos dois lados: o contraforte cruza a sapata de borda a borda; o momento entra como torção (Fundação, seção 8).', 'key', None, 'cas_pun')
Ls('e0 = distância à borda cortada', '=IF(cas_pun="De borda",MIN(e1_pun,e2_pun),0)', 'cm', '', 'res', '0.0', 'e0_pun')
Ls("u (interno: 2C1 + 2C2 + 4πd) · u* (borda: 2·mín(1,5d; 0,5C1) + C2 + 2πd)",
   '=IF(cas_pun="Interno",2*tenr_adot+2*t_bloco+4*PI()*d_s,2*MIN(1.5*d_s,0.5*tenr_adot)+t_bloco+2*PI()*d_s)', 'cm', '', 'res', '0.0', 'u_pun', 'NBR 6118 19.5.2.2 e 19.5.2.3')
Ls('Wp (interno) · Wp1 (borda: (e0 + C1/2)² + C1²/4 + C1·C2/2 + 2·C2·d + π·d·C1 + 8d²)',
   '=IF(cas_pun="Interno",tenr_adot^2/2+tenr_adot*t_bloco+4*t_bloco*d_s+16*d_s^2+2*PI()*d_s*tenr_adot,(e0_pun+tenr_adot/2)^2+tenr_adot^2/4+tenr_adot*t_bloco/2+2*t_bloco*d_s+PI()*d_s*tenr_adot+8*d_s^2)',
   'cm²', 'Borda: ∫|e|dℓ no perímetro u, eixo pelo centro do pilar (o mesmo cálculo dá a fórmula do pilar interno). Com e0 > 0, dedução.', 'res', '0', 'Wp_pun', 'NBR 6118 19.5.2.2')
Ls("τSd no contorno C'", '=IF(OR(cas_pun="Interno",cas_pun="De borda"),(Fc_pun/(u_pun*d_s)+K_pun*Mc_pun*100/(Wp_pun*d_s))*10,"—")', 'MPa',
   'Borda: MSd1 = MSd (o MSd* = FSd·e* foi desprezado, a favor).', 'key', '0.000', 'tp_sm', 'NBR 6118 19.5.2.3')
Ls('ρ = √(ρx·ρy) ≤ 0,02', '=MIN(0.02,SQRT(As_ps/(100*d_s)*As_ss/(100*d_s)))', '', 'Armaduras principal e secundária da Fundação.', 'res', '0.00000', 'rho_pun')
Ls('ke = 1 + √(20/d) ≤ 2', '=MIN(2,1+SQRT(20/d_s))', '', 'd em cm.', 'res', '0.000', 'ke_pun')
Ls('τRd1 = 0,13·ke·(100·ρ·fck)^⅓', '=0.13*ke_pun*(100*rho_pun*fck_s)^(1/3)', 'MPa', 'Sem armadura de punção.', 'key', '0.000', 'tRd1_sm', 'NBR 6118 19.5.3.2')
r += 1

# ---------------------------------------------------------------- 11. verificações
section(SM, r, '11. Verificações'); r += 1
CHKS = [
    ('Sapata (NBR 6118 22.6.1)', '=cls_sap&IF(cls_sap="Rígida"," — pressão linear permitida"," — verificações abaixo")', 'chk_sm_cls'),
    ('Mesmas cargas da Fundação', '=conf_cg', None),
    ('Molas: passadas convergiram', '=IF(AND(cvg_mm="Sim",OR(cvg_mc="Sim",LEFT(cvg_mc,1)="—")),"OK","NÃO OK — aumentar as passadas")', 'chk_sm_cvg'),
    ('Flexão com as molas: 1,4·Mk ≤ MRd da armadura da Fundação', '=IF(Md_sm<=MRd_sm,"OK ("&FIXED(Md_sm,2)&" ≤ "&FIXED(MRd_sm,2)&" kN·m/m)","NÃO OK ("&FIXED(Md_sm,2)&" > "&FIXED(MRd_sm,2)&" kN·m/m) — aumentar a armadura ou a altura")', 'chk_sm_flex'),
    ('Cortante com as molas: VSd ≤ VRd1', '=IF(Vd_sm<=VRd1_s,"OK ("&FIXED(Vd_sm,1)&" ≤ "&FIXED(VRd1_s,1)&" kN/m)","NÃO OK ("&FIXED(Vd_sm,1)&" > "&FIXED(VRd1_s,1)&" kN/m) — aumentar a altura")', 'chk_sm_cort'),
    ('Compressão diagonal na face do muro', '=IF(tw_sm<=tRd2_sm,"OK ("&FIXED(tw_sm,3)&" ≤ "&FIXED(tRd2_sm,3)&" MPa)","NÃO OK ("&FIXED(tw_sm,3)&" > "&FIXED(tRd2_sm,3)&" MPa)")', 'chk_sm_bw'),
    ('Compressão diagonal junto ao contraforte', f'=IF({NCF},"— (muro em balanço)",IF(tc_sm<=tRd2_sm,"OK ("&FIXED(tc_sm,3)&" ≤ "&FIXED(tRd2_sm,3)&" MPa)","NÃO OK ("&FIXED(tc_sm,3)&" > "&FIXED(tRd2_sm,3)&" MPa)"))', 'chk_sm_bc'),
    ('Punção junto ao contraforte', f'=IF({NCF},"— (muro em balanço)",IF(cas_pun="Cortado nos dois lados","— contraforte de borda a borda: vale a torção (Fundação, seção 8)",IF(tp_sm<=tRd1_sm,"OK ("&FIXED(tp_sm,3)&" ≤ "&FIXED(tRd1_sm,3)&" MPa, "&IF(cas_pun="Interno","interno","de borda")&")","NÃO OK ("&FIXED(tp_sm,3)&" > "&FIXED(tRd1_sm,3)&" MPa) — aumentar a altura")))', 'chk_sm_pun'),
    ('Molas × solução fechada (σ máx)', '=IF(apoio_cf="Sim","diferença de "&FIXED(100*(sh_mm/sh_cf-1),1)&"% (discretização em "&NN_sap&" nós)","— sapata descola: só molas")', None),
]
for lab, f, nm_ in CHKS:
    Ls(lab, f, '', '', 'key', None, nm_)
r += 1
name_ref = SM.cell(row=r, column=2, value=NN); name('NN_sap', SM, f'B{r}')
SM.cell(row=r, column=1, value='Número de nós da malha').font = fS
widths(SM, {'A': 46, 'B': 16, 'C': 14, 'D': 16, 'E': 16, 'F': 14, 'G': 14, 'H': 16})
for _cc in range(9, 23): SM.column_dimensions[_gl(_cc)].width = 13
SM.freeze_panes = 'B4'

# Resultado com erro vira "—" (como nas abas Contrafortes e Fundação): geometria inválida não espalha #VALOR!.
for _row in SM.iter_rows(min_row=4):
    for _c in _row:
        if isinstance(_c.value, str) and _c.value.startswith('=') and not _c.value.startswith('=IFERROR('):
            _c.value = '=IFERROR(' + _c.value[1:] + ',"—")'
