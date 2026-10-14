"""Gerador da planilha "Arrimo Alvenaria — base Carini" (aulas 12.1–12.3 do Prof. Carini + manual ABCP/NBR 16868-1).
Uso: python tools/build_new.py saida.xlsx   (ver CLAUDE.md)
Módulos executados no mesmo namespace: tools/contrafortes.py (aula 12.3), tools/fundacao.py (sapata corrida) e
tools/sapata_molas.py (sapata sobre molas, NBR 6118 22.6 e 19.5).
"""
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment

OUT = sys.argv[1]
wb = Workbook()
F = 'Arial'
NAVY = PatternFill('solid', fgColor='1F3864')
INP = PatternFill('solid', fgColor='FFF2CC')
SUG = PatternFill('solid', fgColor='E2EFDA')
RES = PatternFill('solid', fgColor='DDEBF7')
GRY = PatternFill('solid', fgColor='F2F2F2')
thin = Side(style='thin', color='BFBFBF')
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
fH = Font(name=F, bold=True, color='FFFFFF', size=11)
fT = Font(name=F, bold=True, size=14, color='1F3864')
fB = Font(name=F, bold=True, size=10)
fN = Font(name=F, size=10)
fI = Font(name=F, size=10, color='0000FF')
fS = Font(name=F, size=9, italic=True, color='595959')
fOK = Font(name=F, size=10, bold=True)

def name(nm, ws, ref):
    col = ''.join(ch for ch in ref if ch.isalpha()); row = ''.join(ch for ch in ref if ch.isdigit())
    wb.defined_names[nm] = DefinedName(nm, attr_text=f"'{ws.title}'!${col}${row}")

def title(ws, text, sub=None):
    ws['A1'] = text; ws['A1'].font = fT
    if sub: ws['A2'] = sub; ws['A2'].font = fS

def header(ws, row, labels, start=1):
    for i, l in enumerate(labels):
        c = ws.cell(row=row, column=start + i, value=l); c.font = fH; c.fill = NAVY
        c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True); c.border = BOX

def line(ws, row, label, value, unit='', note='', kind='res', fmt=None, nm=None, src=None):
    a = ws.cell(row=row, column=1, value=label); a.font = fN; a.border = BOX
    b = ws.cell(row=row, column=2, value=value); b.border = BOX
    b.font = fI if kind == 'inp' else (fB if kind == 'key' else fN)
    b.fill = {'inp': INP, 'sug': SUG, 'res': RES, 'key': RES, 'txt': GRY}[kind]
    b.alignment = Alignment(horizontal='center')
    if fmt: b.number_format = fmt
    u = ws.cell(row=row, column=3, value=unit); u.font = fN; u.border = BOX
    n = ws.cell(row=row, column=4, value=note); n.font = fS; n.border = BOX
    n.alignment = Alignment(wrap_text=True, vertical='top')
    if src: ws.cell(row=row, column=5, value=src).font = fS
    if nm: name(nm, ws, f'B{row}')
    return f'B{row}'

def section(ws, row, text, ncol=5):
    for i in range(1, ncol + 1):
        c = ws.cell(row=row, column=i); c.fill = NAVY
    c = ws.cell(row=row, column=1, value=text); c.font = fH

def widths(ws, w):
    for col, v in w.items(): ws.column_dimensions[col].width = v

# ================= ENTRADAS =================
E = wb.active; E.title = 'Entradas'
title(E, 'Muro de arrimo em alvenaria estrutural — Entradas',
      'Abre com o exemplo da aula 12.2 (bate com o professor com Somar σsg = Não e peso da parede 3,0 kN/m²). Para o seu muro, troque os amarelos — atenção a d, K, As,mín e M2d. Amarelo = entrada; verde = sugestão; azul = resultado. kN, m, kPa, MPa.')
E.merge_cells('A3:E3')
E['A3'] = ('AVISO — Os parâmetros do solo (γ, φ\', c\', Ka, sobrecarga, nível d\'água) e o empuxo são ESCOLHA DO PROJETISTA. '
           'Recomenda-se obtê-los por ensaio (cisalhamento direto e/ou triaxial). A coesão, mesmo em argila coesiva, a aula recomenda desprezar. '
           'Esta planilha só auxilia o cálculo: o engenheiro responsável deve conferir e validar toda a memória de cálculo antes de assinar.')
E['A3'].font = Font(name=F, bold=True, size=10, color='C00000'); E['A3'].alignment = Alignment(wrap_text=True, vertical='center')
E['A3'].fill = PatternFill('solid', fgColor='FCE4D6'); E.row_dimensions[3].height = 58
header(E, 4, ['Item', 'Valor', 'Unid.', 'Observação', 'Figura'])

# Montagens fechadas (decisão do Jose, 09/10): as entradas que definem a geometria e as barras só aceitam valores
# da LISTA. As listas ficam na aba Referências (colunas AJ em diante) e muitas dependem de outra entrada (a altura
# depende do tipo de muro; o vão e o contraforte, do bloco) — por isso são intervalos com fórmula, e não listas
# literais: lista literal com vírgula decimal quebra no Excel pt-BR. Validação de lista do Excel só confere no momento
# em que se digita: trocar o bloco depois não reconfere o contraforte. Quem acusa isso é a linha "Entradas nas listas"
# (lim_lst), e o app troca sozinho para a opção mais próxima. allow_blank=False em todas: com "ignorar em branco"
# ligado e célula vazia no intervalo, o Excel passa a aceitar qualquer valor (o branco do "automático" fica no
# intervalo de propósito; apagar a célula com Delete continua valendo, o Excel não valida a exclusão).
def lista(ref, celula, ws=None):
    dv = DataValidation(type='list', formula1=f"='Referências'!{ref}", allow_blank=False)
    (ws or E).add_data_validation(dv); dv.add(celula)
LST = {  # nome definido → intervalo da lista na aba Referências (preenchido lá, na seção "Listas das Entradas")
    'lst_H': '$AJ$5:$AJ$22', 'lst_lcf': '$AK$5:$AK$21', 'lst_tenr': '$AL$5:$AL$6', 'lst_s': '$AM$5:$AM$11',
    'lst_hpan': '$AN$5:$AN$12', 'lst_sph': '$AO$5:$AO$13', 'lst_phi_est': '$AP$5:$AP$6',
    'lst_phi_sap': '$AQ$5:$AQ$11', 'lst_phi_sap2': '$AR$5:$AR$9', 'lst_phi_esp': '$AS$5:$AS$10',
    'lst_gr': '$BB$5:$BB$9',
}
PHI_BARRAS = (6.3, 8, 10, 12.5, 16, 20)   # Ø de furo e canaleta: Referências L5:L10 e a lista das esperas (AS)
LST_PHI = '$L$5:$L$10'   # Ø 6,3 a 20 (barras em furo e canaleta): a mesma lista das tabelas de arranjos


def h_dobra(ph):
    """Altura de sapata (cm) que a dobra do pé da espera de Ø `ph` (mm) pede: 2c + malha + D + 2φ.

    Por que existe (Jose, 09/10, modelando o "nó de cachorro" no Revit): "sapata corrida de 20 cm não comporta nó de
    cachorro com barra de 20 mm; dá problema a partir de 16 mm". O Ø da barra que tem espera passa a ser lista que
    depende da sapata. D = pino de dobra da NBR 6118 Tab. 9.1 (CA-50): 5φ com φ < 20 mm, 8φ com φ ≥ 20 — a mesma regra
    que o app usa para desenhar a dobra (app/src/modulacao/barras.ts, pino). O resto é DEDUÇÃO nossa: a dobra inteira
    (D + 2φ) entre o cobrimento de baixo e o de cima (2c), e o pé apoiado nas duas camadas da malha da sapata (Ø
    transversal + Ø longitudinal), que é onde o app põe a espera (armaduras.ts, zPeBase; detalhe d03). Com a malha
    a conta reproduz o que o Jose disse: em 20 cm (c = 4, malha 10 + 6,3) o Ø12,5 cabe (18,4) e o Ø16 não (20,8).
    Uma função só para a lista (Referências) e para as linhas da aba Fundação: é a mesma conta nos dois lugares, e o
    app herda as duas pelo motor."""
    return f'2*cob_sap+phi_sap/10+phi_sap2/10+IF({ph}<20,5,8)*{ph}/10+2*{ph}/10'
r = 5
section(E, r, 'Geometria'); r += 1
# Duas alturas desde 09/10 (pedido do Jose): o MURO (lista de fiadas) e o SOLO contido (livre, até o topo do muro).
# Antes a mesma altura servia às duas coisas e o muro desenhado subia sozinho até fechar a fiada. Agora quem diz até
# onde vai o muro é ele, e cada fórmula lê a altura que lhe cabe: empuxo, pressões, Mk/Vk e fundação leem o SOLO;
# peso da parede, esbeltez, flecha no topo, painel e limites leem o MURO (mapa completo no relatório de 09/10).
# Com h solo = h muro tudo dá o mesmo número de antes — é a prova de que nada mudou sem querer.
line(E, r, 'Altura do muro (h muro)', 1.6, 'm', 'Do topo da sapata ao topo do muro. Lista: fiadas inteiras de 20 cm, 0,60 a 3,00 m no balanço e até 4,00 m com contrafortes.', 'inp', '0.00', 'H_muro'); r += 1
lista(LST['lst_H'], f'B{r-1}')
line(E, r, 'Altura de solo contido (h solo)', 1.6, 'm', 'Do topo do solo à base do muro (topo da sapata). Maior que 0 e no máximo a altura do muro.', 'inp', '0.00', 'H_solo'); r += 1
# Validação por fórmula (não lista): número > 0 e ≤ altura do muro. Esta, ao contrário das listas, BARRA o valor errado
# (showErrorMessage): solo acima do topo do muro não é um arrimo que a conta saiba fazer. Como toda validação do Excel,
# só confere na hora de digitar — baixar a altura do muro depois não reconfere; quem acusa é a linha lim_Hs abaixo, e
# o app traz o solo para o topo do muro sozinho ("→").
_dv_hs = DataValidation(type='custom', formula1=f'AND(ISNUMBER(B{r-1}),B{r-1}>0,B{r-1}<=H_muro)', allow_blank=False,
                        showErrorMessage=True, errorTitle='Altura de solo', error='Entre 0 e a altura do muro.')
E.add_data_validation(_dv_hs); _dv_hs.add(f'B{r-1}')
# Fiadas de 20 cm (19 de bloco + 1 de junta). Com a altura do muro em lista de fiadas inteiras, n·20 cm é a própria
# altura do muro; as duas linhas ficam porque o desenho e o quantitativo do app as leem pelo nome — nenhuma conta lê.
# ARRED.PARA.CIMA de H·100/20 (e não de H/0,2): o Excel arredonda a 15 dígitos antes de subir, então
# 2,2·100/20 = 11,000…02 dá 11 e não 12; o motor do app faz igual. Mínimo de 1 fiada: com a altura em branco o desenho
# ainda tem um muro (o app também nunca desenha menos de uma).
line(E, r, 'Nº de fiadas (20 cm)', '=MAX(1,ROUNDUP(H_muro*100/20,0))', '', 'Fiadas de 20 cm na altura do muro. Só desenho e quantitativo.', 'sug', '0', 'n_fiadas'); r += 1
# n·20/100 (inteiro dividido por 100) dá o double mais próximo do valor redondo; n·0,2 daria 0,6000000000000001 com n = 3.
line(E, r, 'Altura do muro desenhado', '=n_fiadas*20/100', 'm', 'Nº de fiadas × 20 cm (com a altura da lista, é a própria altura do muro).', 'sug', '0.00', 'H_muro_des'); r += 1
line(E, r, 'Espessura do bloco (t)', 19, 'cm', '14 ou 19.', 'inp', '0', 't_bloco'); r += 1
dv_t = DataValidation(type='list', formula1='"14,19"', allow_blank=False); E.add_data_validation(dv_t); dv_t.add(f'B{r-1}')
# Só a família 39 (decisão do Jose, 09/10): 14×39 e 19×39. Deixou de ser entrada — o 14×29 só existia para
# reproduzir a aula 12.3 em bloco cerâmico, e o cerâmico saiu da planilha. O nome fica porque a conta o usa
# (módulo, alma da seção I, área de graute do furo).
line(E, r, 'Comprimento do bloco', 39, 'cm', 'Família 39 (14×39 e 19×39), fixo. Define o módulo, a alma da seção I e a área de graute do furo.', 'res', '0', 'L_bloco'); r += 1
# Meio módulo: os furos do bloco caem a cada (L + 1 cm de junta)/2. É a grade em que barra, contraforte e comprimento
# têm de cair para o 3D desenhar o mesmo muro que a conta calcula (decisão do Jose: a conta usa o valor ajustado).
line(E, r, 'Meio bloco (módulo m)', '=(L_bloco+1)/2', 'cm', '(L + 1 cm de junta)/2 = 20 cm. Barras e contrafortes caem em múltiplos de m.', 'sug', '0', 'm_mod'); r += 1
# GRAUTE EM GRADE (Jose, 13/10): a parede é grauteada a cada X cm — 20 = todos os furos (seção cheia), 40 = furo
# sim, furo não, 60 = um sim dois não… até 6t (bloco 19: 100; bloco 14: 80). A barra tem de cair num furo da
# grade: o espaçamento das barras (balanço e painel) só pode ser múltiplo de X (lista lst_s). Vale para o balanço e
# para o painel entre contrafortes; o contraforte é sempre todo grauteado. A mesma grade dá o peso (fração dos
# furos = m/X), as almas da flexão (100/X furos por metro) e as almas do ELS (s/X por faixa).
line(E, r, 'Graute a cada', 40, 'cm', '20 = todos os furos (seção cheia, fpk*); 40 = furo sim, furo não; 60 = um sim, dois não; … até 6t. Nos parciais a seção é I: alma = furo grauteado + septos, mesas = paredes do bloco, fpk do bloco vazado. O espaçamento das barras é múltiplo deste (a barra cai num furo grauteado). Balanço e painel entre contrafortes; o contraforte é sempre todo grauteado. Aula 12.2: barras a 40 com graute nos furos delas = 40.', 'inp', '0', 'Graute'); r += 1
lista(LST['lst_gr'], f'B{r-1}')
line(E, r, 'Todos os furos grauteados (seção cheia)?', '=IF(Graute<=m_mod,"Sim","Não")', '', 'Graute a cada m (20 cm) = todos os furos.', 'res', None, 'gr_tot'); r += 1
line(E, r, 'Largura da alma da seção I — opcional', None, 'cm', 'Em branco = furo grauteado + 2 septos = (L − 3·parede)/2 + 2·parede (19×39 → 21,25 cm, igual ao da aula). Preencha se quiser outro valor.', 'inp', '0.00', 'bw_dir'); r += 1
line(E, r, 'Tipo de muro', 'Balanço', '', 'Balanço (aula 12.2, aba Muro em balanço) ou Contrafortes (aula 12.3, aba Contrafortes).', 'inp', None, 'Tipo_muro'); r += 1
dv_m = DataValidation(type='list', formula1='"Balanço,Contrafortes"'); E.add_data_validation(dv_m); dv_m.add(f'B{r-1}')
# Limites do app gratuito (decisão do Jose, 08/10): o app é básico e fechado; fora disso quem quiser faz a própria
# conta. A planilha calcula assim mesmo — a linha só sinaliza (o app lê lim_H e não calcula fora dele). A lista da
# altura já para em 3,0/4,0 m; a linha fica porque trocar o tipo de muro depois não reconfere a altura.
# (Contraforte com bloco 14 foi liberado em 09/10: o Jose modelou no Revit o 14×39 com contraforte de 34 e de 54.)
# O limite é da altura do MURO (09/10, com as duas alturas separadas): o solo nunca passa do muro, então limitar o muro
# limita os dois — e é o muro que define esbeltez, peso e flecha no topo.
line(E, r, 'Limite de altura do app', '=IF(H_muro<=IF(Tipo_muro="Contrafortes",4,3),"OK",IF(Tipo_muro="Contrafortes","fora do limite: máx 4,0 m","fora do limite: máx 3,0 m"))', '', 'App gratuito: altura do muro até 3,0 m no balanço e 4,0 m com contrafortes (o solo fica abaixo do topo do muro).', 'key', None, 'lim_H'); r += 1
line(E, r, 'Solo até o topo do muro', '=IF(AND(H_solo>0,H_solo<=H_muro),"OK","fora: 0 < h solo ≤ h muro")', '', 'A validação só confere ao digitar: baixar a altura do muro depois não reconfere o solo.', 'key', None, 'lim_Hs'); r += 1
# As listas que dependem de outra entrada (ver LST) só valem no momento da digitação: com tenr 79 e o bloco trocado
# para 14 depois, o 79 fica. Esta linha diz quais ficaram fora. CORRESP exato (0): a lista é do mesmo número que se
# digita (n·20/100 dá o mesmo double que "1,6" digitado).
_fora = [('H_muro', 'lst_H', 'altura', False), ('l_cf', 'lst_lcf', 'eixo a eixo', False),
         ('tenr_', 'lst_tenr', 'contraforte', False), ('s_dir', 'lst_s', 'espaçamento das barras', True),
         ('s_pv_dir', 'lst_s', 'espaçamento vertical do painel', True), ('Graute', 'lst_gr', 'graute', False)]
_conds = [(f'IF(ISNUMBER({n}),ISNUMBER(MATCH({n},{l},0)),TRUE)' if opc else f'ISNUMBER(MATCH({n},{l},0))', rot)
          for n, l, rot, opc in _fora]
# Ø com espera (lista pela altura da sapata, ver h_dobra): só se confere a barra que o muro escolhido tem — no balanço o
# Ø vertical; com contrafortes o do painel, o do contraforte e o das construtivas (se houver). Um Ø de contraforte
# esquecido num muro em balanço não desenha espera nenhuma e não deve acusar.
_esp = [('phi_v', 'Tipo_muro<>"Contrafortes"', 'Ø vertical (dobra da espera)'),
        ('phi_pv', 'Tipo_muro="Contrafortes"', 'Ø do painel (dobra da espera)'),
        ('phi_cf', 'Tipo_muro="Contrafortes"', 'Ø do contraforte (dobra da espera)'),
        ('phi_cc', 'AND(Tipo_muro="Contrafortes",n_cc>0)', 'Ø construtivas (dobra da espera)')]
_conds += [(f'IF({cnd},ISNUMBER(MATCH({n},lst_phi_esp,0)),TRUE)', rot) for n, cnd, rot in _esp]
line(E, r, 'Entradas nas listas', '=IF(AND(' + ','.join(c for c, _ in _conds) + '),"OK","fora da lista:' +
     '"&' + '&'.join(f'IF({c},""," {rot};")' for c, rot in _conds) + ')', '',
     'Altura, contraforte e espaçamentos dependem do tipo de muro e do bloco; os Ø com espera, da altura da sapata: trocar um deles depois não reconfere os outros.', 'key', None, 'lim_lst'); r += 1
line(E, r, 'Travamento lateral transversal?', 'Não', '', 'Não = he = 2h (aula 12.2). Sim = usa αv, αh e l abaixo (planilha 02 do curso, aba Altura Efetiva).', 'inp', None, 'Trav_lat'); r += 1
dv_tl = DataValidation(type='list', formula1='"Sim,Não"'); E.add_data_validation(dv_tl); dv_tl.add(f'B{r-1}')
line(E, r, 'αv', 2.5, '', '1,0 se travada no topo e na base; 2,5 se travada só numa extremidade.', 'inp', '0.0', 'alfa_v'); r += 1
line(E, r, 'αh', 1.0, '', '1,0 se travada dos dois lados; 2,5 se só de um lado.', 'inp', '0.0', 'alfa_h'); r += 1
line(E, r, 'l (distância entre travamentos)', 3.0, 'm', 'Só usada com travamento lateral = Sim. Balanço: comprimento do muro travado nas duas pontas (no app vem do comprimento do muro). Contrafortes: vale o espaçamento adotado dos contrafortes (este campo é ignorado).', 'inp', '0.00', 'l_trav'); r += 1
r += 1
section(E, r, 'Solo e cargas'); r += 1
line(E, r, 'Tipo de solo (para sugestões)', 'Argila', '', 'Areia, Argila ou Outro (usa a tabela de Gerscovich).', 'inp', None, 'Tipo_solo'); r += 1
dv_s = DataValidation(type='list', formula1='"Areia,Argila,Outro"'); E.add_data_validation(dv_s); dv_s.add(f'B{r-1}')
line(E, r, 'NSPT do solo contido', 5, 'golpes', 'Valor médio na altura de solo contido (julgamento seu).', 'inp', '0', 'NSPT'); r += 1
line(E, r, 'Condição de umidade (areia)', 'Úmida', '', 'Seca, Úmida ou Saturada — só para γ de areia (Godoy 1972).', 'inp', None, 'Umidade'); r += 1
dv_u = DataValidation(type='list', formula1='"Seca,Úmida,Saturada"'); E.add_data_validation(dv_u); dv_u.add(f'B{r-1}')
# As classes de Gerscovich não têm argila (09/10): com Tipo_solo = Argila a sugestão pela classe vira "—" (aba Solo e
# Empuxo) e "Não se aplica" é o padrão — o Excel não troca uma entrada sozinho; o app apaga e trava o campo nesse valor.
line(E, r, 'Classe de solo (Gerscovich, RJ)', 'Não se aplica', '', 'Só para sugestão de γ e φ (tabela de solos do Rio de Janeiro). Não cobre argila: com Argila, "Não se aplica".', 'inp', None, 'Classe_G'); r += 1
dv_g = DataValidation(type='list', formula1="='Solo e Empuxo'!$A$32:$A$39"); E.add_data_validation(dv_g); dv_g.add(f'B{r-1}')
line(E, r, 'γ adotado', 19, 'kN/m³', 'Peso específico adotado (ver sugestões na aba Solo e Empuxo).', 'inp', '0.0', 'gama_solo'); r += 1
line(E, r, "φ' adotado", 25, '°', 'Ângulo de atrito efetivo adotado.', 'inp', '0.0', 'phi_solo'); r += 1
line(E, r, 'Ka direto (opcional)', 0.4, '', "Se preencher, usa este Ka em vez de calcular por φ' (o exemplo da aula 12.2 dá Ka = 0,4). Em branco = calcula por φ'.", 'inp', '0.000', 'Ka_dir'); r += 1
line(E, r, "c' adotada", 0, 'kPa', 'Aula 12.1, slide 8: "desconsiderar a coesão". Valor fica a seu critério.', 'inp', '0.0', 'c_solo'); r += 1
# Coesão liberada com aviso curto (decisão do Jose, 08/10): sem prosa, só a marca de que o c' é escolha de quem assina.
# Vazio quando c' = 0 para o app não mostrar nada no caso normal.
line(E, r, 'Aviso da coesão', '=IF(c_solo>0,"c\' > 0: escolha do projetista","")', '', 'Aparece no app ao lado do campo e no memorial.', 'key', None, 'aviso_coesao'); r += 1
line(E, r, 'Sobrecarga no terreno (q)', 2, 'kPa', 'Uniforme sobre o terreno contido (entra como Ka·q).', 'inp', '0.0', 'q_sobre'); r += 1
line(E, r, 'Considerar água?', 'Não', '', 'Sim/Não. A aula soma o empuxo da água (Ew) ao do solo.', 'inp', None, 'Agua'); r += 1
dv_a = DataValidation(type='list', formula1='"Sim,Não"'); E.add_data_validation(dv_a); dv_a.add(f'B{r-1}')
line(E, r, 'Profundidade do NA (a partir do topo do solo)', 1.0, 'm', 'Só usada se "Considerar água?" = Sim.', 'inp', '0.00', 'z_NA'); r += 1
line(E, r, 'γw', 10, 'kN/m³', 'Aula 12.1, slide 6.', 'inp', '0.0', 'gama_w'); r += 1
r += 1
section(E, r, 'Alvenaria e aço'); r += 1
line(E, r, 'fbk', 8, 'MPa', 'Classe A (fbk ≥ 8 MPa) para bloco em contato com o solo — aula 12.1, slide 2.', 'inp', '0.0', 'fbk_'); r += 1
dv_f = DataValidation(type='list', formula1="='Referências'!$H$5:$H$16"); E.add_data_validation(dv_f); dv_f.add(f'B{r-1}')
line(E, r, 'Área de referência do fpk', 'Líquida (curso)', '', 'Líquida = fpk ÷ (Aliq/Abr), como na aula 12.2: fpk = 6/0,54 = 11,1 MPa na flexão (planilha 04, K = 1) e Em = 800·11,1 = 8889 MPa no ELS. Bruta = fpk da tabela (NBR/ABCP).', 'inp', None, 'fpk_ref'); r += 1
dv_fr = DataValidation(type='list', formula1='"Líquida (curso),Bruta (NBR)"'); E.add_data_validation(dv_fr); dv_fr.add(f'B{r-1}')
# Peso próprio CALCULADO (Jose, 12/10: "dado que a gente não precisa perder tempo fornecendo"). Sai do bloco (t, Aliq/Abr),
# do graute que o resto das entradas já define (total, ou os furos das barras + as fiadas de canaleta) e do reboco, a
# única entrada nova. Pesos específicos: 24 graute (NBR 6120, concreto simples), 21 reboco (NBR 6120, argamassa de
# cimento e areia), 22 concreto do bloco (DEDUÇÃO: bloco de catálogo ÷ volume de concreto — 19×19×39 ≈ 17 kg,
# 14×19×39 ≈ 13 kg). O campo de antes continua, opcional: digitado manda (arquivo antigo com o peso alterado fica igual).
line(E, r, 'Reboco', 'Nenhum', '', 'Entra no peso próprio da parede. Nenhum, só na frente (face aparente) ou nas duas faces.', 'inp', None, 'reb_fac'); r += 1
dv_rb = DataValidation(type='list', formula1='"Nenhum,Só na frente,Nas duas faces"'); E.add_data_validation(dv_rb); dv_rb.add(f'B{r-1}')
line(E, r, 'Reboco: espessura em cada face', 2.0, 'cm', 'Só com reboco.', 'inp', '0.0', 'reb_esp'); r += 1
line(E, r, 'Peso próprio da parede — opcional', None, 'kN/m²', 'Em branco = calculado logo abaixo (bloco + graute + reboco). Preencha só para forçar outro valor.', 'inp', '0.00', 'peso_par'); r += 1
# Grade do graute: fração dos furos grauteados numa fiada comum = m/X (X = 20 → todos). Contrafortes: o painel (o
# contraforte pesa à parte, na aba Fundação, sempre cheio).
line(E, r, 'Fração dos furos grauteados (fiada comum)', '=MIN(1,m_mod/Graute)', '', 'Um furo a cada X (graute a cada) em cada m = 20 cm de furo: m/X. Todos os furos = 1.', 'res', '0.000', 'f_furo'); r += 1
line(E, r, 'Fração dos furos grauteada', '=IF(gr_tot="Sim",1,1-(1-f_furo)*(1-IF(Tipo_muro="Contrafortes",IF(AND(ISNUMBER(s_ph),s_ph>0),MIN(1,20/s_ph),0),MIN(1,0.2/h_pan))))', '', 'Furos grauteados das fiadas comuns e fiadas de canaleta (fiada de 20 cm a cada espaçamento das canaletas), sem contar duas vezes o furo que cruza a canaleta: 1 − (1 − m/X)·(1 − 0,20/h). Todos os furos = 1.', 'res', '0.000', 'f_gr'); r += 1
line(E, r, 'Peso da alvenaria (bloco + graute)', '=t_bloco/100*(22*r_liq+24*(1-r_liq)*f_gr)', 'kN/m²', 't·[γbloco·Aliq/Abr + γgraute·(1 − Aliq/Abr)·fração]. γbloco = 22 kN/m³ (dedução: peso de catálogo ÷ volume de concreto); γgraute = 24 kN/m³ (NBR 6120, concreto simples).', 'res', '0.00', 'g_alv'); r += 1
line(E, r, 'Peso do reboco', '=21*reb_esp/100*IF(reb_fac="Nas duas faces",2,IF(reb_fac="Só na frente",1,0))', 'kN/m²', 'γ = 21 kN/m³ (NBR 6120, argamassa de cimento e areia) × espessura × nº de faces.', 'res', '0.00', 'g_reb'); r += 1
line(E, r, 'Peso próprio da parede (usado)', '=IF(ISNUMBER(peso_par),peso_par,g_alv+g_reb)', 'kN/m²', 'Entra no peso do muro na fundação (tombamento, deslizamento, tensões) e no σsg do momento de fissuração.', 'key', '0.00', 'peso_us'); r += 1
line(E, r, 'Peso com todos os furos grauteados (só no M2d)', '=IF(ISNUMBER(peso_par),peso_par,t_bloco/100*(22*r_liq+24*(1-r_liq))+g_reb)', 'kN/m²', 'O M2d usa o muro todo grauteado: a favor da segurança, e evita a conta circular (o espaçamento automático das barras depende do Md, que depende do M2d). Efeito pequeno (dedução nossa).', 'res', '0.00', 'peso_ch'); r += 1
line(E, r, 'fyk (CA-50)', 500, 'MPa', '', 'inp', '0', 'fyk_'); r += 1
line(E, r, 'fgk do graute — opcional', None, 'MPa', 'Em branco = tabela do curso pelo fbk (fbk 8 → 20 MPa). Entra no estribo mínimo do contraforte (ρw de 0,07% a 0,14%).', 'inp', '0.0', 'fgk_dir'); r += 1
line(E, r, 'Ø armadura vertical', 10, 'mm', 'Barra no furo grauteado. A aba Arranjos mostra qual Ø serve para cada espaçamento. Lista: só os Ø cuja dobra da espera cabe na sapata (aba Fundação, seção 10).', 'inp', '0.0', 'phi_v'); r += 1
lista(LST['lst_phi_esp'], f'B{r-1}')
line(E, r, 'Espaçamento das barras — opcional', 40, 'cm', 'Em branco = automático: maior múltiplo do meio bloco (m) que atende o As de cálculo, até 6t (NBR 16868-1 11.3.5). Lista: múltiplos de m até 6t (aula 12.2: 40). A aba Muro em balanço avisa se As,ef ficar abaixo do As de cálculo.', 'inp', '0', 's_dir'); r += 1
lista(LST['lst_s'], f'B{r-1}')
line(E, r, 'd (altura útil) — opcional', 14, 'cm', 'Em branco = t/2 (barra no meio do furo). Aula 12.2: barra a 5 cm da face do solo no bloco de 19 → d = 14 cm (lado do solo = lado tracionado no balanço). Só use d maior que t/2 se garantir a posição da barra na obra (espaçador/gabarito).', 'inp', '0.0', 'd_dir'); r += 1
line(E, r, 'K (compressão na flexão) — opcional', 1, '', 'Em branco = NBR 16868-1: 1,5 (grauteamento parcial) ou 2,0 (total, flexão fora do plano). A planilha 04 do curso vem com K = 1 (a favor da segurança).', 'inp', '0.00', 'K_dir'); r += 1
line(E, r, 'Critério de As,mín', 'Curso', '', 'Curso = 0,15%·b·d (planilha 04 e aula 12.2). NBR = 0,10%·b·t, dispensável se MRd ≥ 1,4·MSd (NBR 16868-1).', 'inp', None, 'AsMin_crit'); r += 1
dv_am = DataValidation(type='list', formula1='"Curso,NBR"'); E.add_data_validation(dv_am); dv_am.add(f'B{r-1}')
line(E, r, 'Somar M2d (2ª ordem) no Md?', 'Não', '', 'Sim = Md = γf·Mk + M2d (ABCP 3.6.3.2). A aula 12.2 não somou (Md = 1,4·Mk). Efeito pequeno em muro baixo.', 'inp', None, 'M2d_on'); r += 1
dv_m2 = DataValidation(type='list', formula1='"Sim,Não"'); E.add_data_validation(dv_m2); dv_m2.add(f'B{r-1}')
r += 1
section(E, r, 'Ancoragem na fundação'); r += 1
line(E, r, 'Concreto da fundação', 'C25', '', 'C20, C25 ou C30 (tabela da aula 12.2, baseada em Araújo 2014; CA-50).', 'inp', None, 'fck_fund'); r += 1
dv_fc = DataValidation(type='list', formula1='"C20,C25,C30"'); E.add_data_validation(dv_fc); dv_fc.add(f'B{r-1}')
line(E, r, 'Zona de aderência', 'Boa', '', 'Boa ou Má.', 'inp', None, 'zona_ad'); r += 1
dv_za = DataValidation(type='list', formula1='"Boa,Má"'); E.add_data_validation(dv_za); dv_za.add(f'B{r-1}')
line(E, r, 'Gancho na ponta da espera?', 'Sim', '', 'Sim = tabela com gancho (0,7·lb); Não = ancoragem reta.', 'inp', None, 'gancho_'); r += 1
dv_gc = DataValidation(type='list', formula1='"Sim,Não"'); E.add_data_validation(dv_gc); dv_gc.add(f'B{r-1}')
r += 1
section(E, r, 'Painel entre barras (alvenaria não armada)'); r += 1
line(E, r, 'Espaçamento das canaletas (h do painel)', 0.80, 'm', 'Aula 12.2: canaletas com Ø10 a cada 80 cm. A largura do painel é o espaçamento das barras verticais. Lista: 0,20 a 1,60 m (fiadas inteiras).', 'inp', '0.00', 'h_pan'); r += 1
lista(LST['lst_hpan'], f'B{r-1}')
line(E, r, 'Argamassa (resistência média à compressão)', '3,5 a 7,0 MPa', '', 'Define ftk (NBR 16868-1, Tabela 3) e fvk do painel. Aula 12.2: 3,5 a 7,0 MPa.', 'inp', None, 'arg_cls'); r += 1
dv_ar = DataValidation(type='list', formula1="='Referências'!$L$16:$L$18"); E.add_data_validation(dv_ar); dv_ar.add(f'B{r-1}')
line(E, r, 'Caso de vinculação do painel', 13, '', '13 = 4 bordas apoiadas (painel entre barras e canaletas, aula 12.2); 18 = topo livre; 11 = uma lateral livre. Tabelas da planilha 11_Painéis Fletidos do curso (NBR 16868-1).', 'inp', '0', 'caso_pan'); r += 1
dv_cp = DataValidation(type='list', formula1='"13,18,11"'); E.add_data_validation(dv_cp); dv_cp.add(f'B{r-1}')
line(E, r, 'βf manual — opcional', None, '', 'Em branco = interpolado na tabela do caso (h/l e μ). Preencha só para forçar outro valor.', 'inp', '0.0000', 'beta_dir'); r += 1
line(E, r, 'Pré-compressão no painel (cisalhamento)', 0, 'MPa', '0 = a favor da segurança (padrão da planilha 05 do curso).', 'inp', '0.000', 'sig_pan'); r += 1
r += 1
section(E, r, 'ELS — fissuração e deslocamento'); r += 1
line(E, r, 'Ma/Mk (combinação do ELS)', 1.0, '', 'Aula 12.2: carga de serviço inteira, sobrecarga sem redução (0,32 → 5,18 kN/m na faixa de 40 cm). O slide fala em combinação frequente (ψ1 = 0,4 na acidental) — reduzir aqui se quiser.', 'inp', '0.00', 'psi_els'); r += 1
line(E, r, 'Limite de deslocamento: vão /', 250, '', 'Slide da aula: menor vão/250.', 'inp', '0', 'div_adm'); r += 1
line(E, r, 'Vão de referência do balanço', '2h', '', 'h = altura do muro (a flecha é a do topo do muro). Aula 12.2: balanço com vão 2L → δadm = 2·1600/250 = 12,8 mm.', 'inp', None, 'vao_ref'); r += 1
dv_vr = DataValidation(type='list', formula1='"h,2h"'); E.add_data_validation(dv_vr); dv_vr.add(f'B{r-1}')
line(E, r, 'Δξ (fluência)', 1.0, '', 'Flecha final δ∞ = δ0·(1 + Δξ/(1 + 50ρ\')). Slide da aula (NBR 16868-1): Δξ = 1.', 'inp', '0.00', 'dxi'); r += 1
line(E, r, 'Somar σsg no momento de fissuração?', 'Sim', '', 'Padrão Sim (Jose, 12/10: o peso do muro existe e ajuda). Aula 12.2: Mr = ftk·Im/yt, sem σsg (para reproduzir a aula, Não). Sim = soma σsg = 0,9·Psg/Ae (roteiro da parede esbelta).', 'inp', None, 'sg_on'); r += 1
dv_sg = DataValidation(type='list', formula1='"Sim,Não"'); E.add_data_validation(dv_sg); dv_sg.add(f'B{r-1}')
r += 1
section(E, r, 'Contrafortes (aula 12.3)'); r += 1
line(E, r, 'Espaçamento entre contrafortes (eixo a eixo)', 1.60, 'm', 'lenr. Também é o vão l do painel. Lista: os vãos que amarram com o bloco (19×39: t + 1 + n·20; 14×39: só n par), 0,80 a 4,00 m.', 'inp', '0.00', 'l_cf'); r += 1
lista(LST['lst_lcf'], f'B{r-1}')
# Eixo a eixo que fecha na grade: t + 1 cm (o contraforte e uma junta) + n meios blocos — 19×39: 0,40/0,60…;
# 14×39: 0,35/0,55… Para CIMA: o vão maior dá mais carga no contraforte e no painel (a favor da segurança). n ≥ 1:
# com n = 0 os contrafortes se encostam. A lista já só oferece os vãos que amarram (14×39: n par); esta linha é a
# garantia para valor digitado fora dela.
line(E, r, 'Eixo a eixo adotado (módulo do bloco)', '=(t_bloco+1+MAX(1,ROUNDUP((l_cf*100-t_bloco-1)/m_mod,0))*m_mod)/100', 'm', 't + 1 cm + n·m, para cima. É o que a conta e o desenho usam; com o valor da lista, é o próprio.', 'sug', '0.00', 'l_cf_adot'); r += 1
line(E, r, 'Comprimento do contraforte (tenr)', 59, 'cm', 'Da face externa do muro até a ponta, contando a espessura do muro. Lista (montagens do Revit): bloco 19 → 59 ou 79; bloco 14 → 34 ou 54.', 'inp', '0', 'tenr_'); r += 1
lista(LST['lst_tenr'], f'B{r-1}')
# Comprimento que fecha na grade: o muro (t) + n meios blocos deitados na haste. Para cima: o contraforte fica pelo
# menos do tamanho pedido; d, o δ da esbeltez, o peso e o talão exigido saem todos do adotado.
line(E, r, 'Comprimento do contraforte adotado', '=t_bloco+MAX(1,ROUNDUP((tenr_-t_bloco)/m_mod,0))*m_mod', 'cm', 't + n·m, para cima. É o que a conta e o desenho usam; com o valor da lista, é o próprio.', 'sug', '0', 'tenr_adot'); r += 1
# Espessura do contraforte = largura do bloco (montagem fechada, decisão do Jose 09/10): deixou de ser entrada.
line(E, r, 'Posição do contraforte', 'Enterrado (lado do solo)', '', 'Enterrado: muro comprimido → seção T (aula 12.3). Aparente (lado de fora): muro tracionado → seção retangular só da alma.', 'inp', None, 'pos_cf'); r += 1
dv_pc = DataValidation(type='list', formula1='"Enterrado (lado do solo),Aparente (lado de fora)"'); E.add_data_validation(dv_pc); dv_pc.add(f'B{r-1}')
line(E, r, 'Contraforte calculado', 'Intermediário', '', 'Intermediário: largura de influência = l. Extremidade: l/2 + balanço do muro além dele.', 'inp', None, 'tipo_cf'); r += 1
dv_tc = DataValidation(type='list', formula1='"Intermediário,Extremidade"'); E.add_data_validation(dv_tc); dv_tc.add(f'B{r-1}')
line(E, r, 'Balanço do muro além do contraforte de extremidade', 0, 'm', 'Só para "Extremidade".', 'inp', '0.00', 'bal_cf'); r += 1
line(E, r, 'Ø da armadura principal do contraforte', 10, 'mm', 'Na ponta do contraforte (furo da ponta). Aula 12.3: 3Ø10. Lista: só os Ø cuja dobra da espera cabe na sapata (aba Fundação, seção 10).', 'inp', '0.0', 'phi_cf'); r += 1
lista(LST['lst_phi_esp'], f'B{r-1}')
line(E, r, 'Nº de barras do contraforte — opcional', None, '', 'Em branco = automático.', 'inp', '0', 'n_cf_dir'); r += 1
line(E, r, 'Cobrimento ao eixo das barras (da face tracionada) — opcional', None, 'cm', 'Em branco = medido na montagem do Revit (furo onde a barra passa reta): da ponta, 9,5 cm no bloco 14 e 10,0 no 19.', 'inp', '0.0', 'c_cf_dir'); r += 1
line(E, r, 'K do contraforte — opcional', 1.0, '', 'Em branco = NBR (1,5 sem graute; 2,0 grauteado). Aula 12.3: K = 1.', 'inp', '0.00', 'K_cf'); r += 1
line(E, r, 'Barras construtivas (lado comprimido): Ø', 10, 'mm', 'Aula 12.3: 2Ø10 construtivas. Lista: só os Ø cuja dobra da espera cabe na sapata (aba Fundação, seção 10).', 'inp', '0.0', 'phi_cc'); r += 1
lista(LST['lst_phi_esp'], f'B{r-1}')
line(E, r, 'Barras construtivas: quantidade', 2, '', '', 'inp', '0', 'n_cc'); r += 1
line(E, r, 'Estribo: Ø', 6.3, 'mm', 'Vai na junta de assentamento: Ø ≤ 6,3 (lista: 5 ou 6,3). Aula 12.3: Ø6,3.', 'inp', '0.0', 'phi_est'); r += 1
lista(LST['lst_phi_est'], f'B{r-1}')
line(E, r, 'Estribo: nº de ramos', 2, '', '', 'inp', '0', 'ramos_est'); r += 1
line(E, r, 'Estribo: espaçamento', 20, 'cm', 'Múltiplo da altura da fiada (20 cm). Aula 12.3: c/20.', 'inp', '0', 's_est'); r += 1
r += 1
section(E, r, 'Painel entre contrafortes (aula 12.3)'); r += 1
line(E, r, 'Bordas laterais do painel (nos contrafortes)', 'Apoiadas', '', 'Base sempre engastada na sapata corrida; topo livre. Apoiadas = Tipo 21 (aula 12.3); Engastadas = Tipo 22.', 'inp', None, 'lat_pan'); r += 1
dv_lp = DataValidation(type='list', formula1='"Apoiadas,Engastadas"'); E.add_data_validation(dv_lp); dv_lp.add(f'B{r-1}')
line(E, r, 'Ø vertical do painel', 10, 'mm', 'Aula 12.3: Ø10. Lista: só os Ø cuja dobra da espera cabe na sapata (aba Fundação, seção 10).', 'inp', '0.0', 'phi_pv'); r += 1
lista(LST['lst_phi_esp'], f'B{r-1}')
line(E, r, 'Espaçamento vertical — opcional', None, 'cm', 'Em branco = automático (múltiplo do espaçamento dos furos). Lista: múltiplos de m até 6t.', 'inp', '0', 's_pv_dir'); r += 1
lista(LST['lst_s'], f'B{r-1}')
line(E, r, 'Posição das barras verticais', '2 barras (uma em cada face)', '', 'Aula 12.3: barras excêntricas simétricas a 5 cm das faces (o momento troca de sinal: base traciona o lado do solo, vão traciona o lado de fora).', 'inp', None, 'pos_pv'); r += 1
dv_pv = DataValidation(type='list', formula1='"2 barras (uma em cada face),1 barra centralizada"'); E.add_data_validation(dv_pv); dv_pv.add(f'B{r-1}')
line(E, r, 'Cobrimento ao eixo das barras do painel', 5, 'cm', 'Distância da face ao eixo da barra. Aula 12.3: 5 → d = 14 − 5 = 9.', 'inp', '0.0', 'c_pv'); r += 1
line(E, r, 'Ø horizontal do painel (canaletas)', 12.5, 'mm', 'Aula 12.3: Ø12,5 c/80.', 'inp', '0.0', 'phi_ph'); r += 1
lista(LST_PHI, f'B{r-1}')
line(E, r, 'Espaçamento das canaletas — opcional', None, 'cm', 'Em branco = automático (20/40/60/80). Lista: 20 a 160 cm (fiadas inteiras). Aula 12.3: 80.', 'inp', '0', 's_ph_dir'); r += 1
lista(LST['lst_sph'], f'B{r-1}')
line(E, r, 'Posição da barra horizontal', 'Centralizada (d = t/2)', '', 'Aula 12.3: Ø12,5 centralizada na canaleta (d = 7).', 'inp', None, 'pos_ph'); r += 1
dv_ph = DataValidation(type='list', formula1='"Centralizada (d = t/2),Encostada na face externa"'); E.add_data_validation(dv_ph); dv_ph.add(f'B{r-1}')
line(E, r, 'K na flexão vertical do painel', 1.0, '', 'Aula 12.3: 1,0.', 'inp', '0.00', 'K_pv'); r += 1
line(E, r, 'K na flexão horizontal do painel — opcional', None, '', 'Em branco = 0,5 (fk horizontal = 0,5·fk se a seção horizontal não for toda grauteada, manual ABCP; aula 12.3: 0,5) ou 1,0 com grauteamento total.', 'inp', '0.00', 'K_ph'); r += 1
line(E, r, 'ELS vertical: alma da seção I — opcional', None, 'cm', 'Em branco = furo grauteado + 2 septos.', 'inp', '0.00', 'bwv_dir'); r += 1
line(E, r, 'ELS horizontal: altura da canaleta grauteada (alma)', 20, 'cm', 'Aula 12.3: 20.', 'inp', '0.0', 'bwh_els'); r += 1
r += 1
section(E, r, 'Fundação — sapata corrida (roteiro do Eng. Gilberto, adaptado)'); r += 1
line(E, r, 'Largura da sapata (B)', 1.40, 'm', 'Na direção perpendicular ao muro.', 'inp', '0.00', 'B_sap'); r += 1
line(E, r, 'Altura da sapata', 0.30, 'm', '', 'inp', '0.00', 'h_sap'); r += 1
line(E, r, 'Distância da borda aterrada ao eixo do muro', 0.95, 'm', 'Define a posição: ≈ t/2 → sapata toda para fora (divisa); ≈ B − t/2 → toda sob o aterro; no meio → mista. O solo sobre o talão sai daqui. Aba do Gilberto: 35 cm em B = 100.', 'inp', '0.00', 'a_ater'); r += 1
line(E, r, 'Dente: largura média', 0.25, 'm', '0 = sem dente. Com atrito só (sem adesão), o deslizamento costuma pedir dente.', 'inp', '0.00', 'b_den'); r += 1
line(E, r, 'Dente: altura', 0.50, 'm', 'Aumenta o passivo (altura da sapata + dente).', 'inp', '0.00', 'h_den'); r += 1
# Posição do dente (Jose, 13/10: "cabe ao projetista determinar"; "referenciando ao centro da sapata"). Do centro
# para trás (talão) o passivo do dente vale sempre: "para escavar até a metade da sapata o cara tem que ser um tatu".
line(E, r, 'Dente: posição do eixo, do centro da sapata (+ para o pé)', 0, 'm', '0 = no centro. Do centro para o talão (≤ 0) o passivo do dente conta sempre — o solo debaixo da sapata não é escavado; para a ponta (> 0) só com o solo da frente garantido. Fica dentro da sapata: |x| ≤ (B − b)/2.', 'inp', '0.00', 'x_den'); r += 1
line(E, r, 'γ do concreto', 25, 'kN/m³', 'Aba do Gilberto: 24.', 'inp', '0.0', 'gama_c'); r += 1
line(E, r, 'γ do contraforte grauteado — opcional', None, 'kN/m³', 'Em branco = calculado logo abaixo (bloco com todos os furos grauteados). Preencha só para forçar outro valor.', 'inp', '0.0', 'gama_cf'); r += 1
line(E, r, 'γ do contraforte grauteado (usado)', '=IF(ISNUMBER(gama_cf),gama_cf,22*r_liq+24*(1-r_liq))', 'kN/m³', 'γbloco·Aliq/Abr + γgraute·(1 − Aliq/Abr), com 22 e 24 kN/m³ como no peso da parede.', 'key', '0.00', 'gama_cf_us'); r += 1
line(E, r, 'Carga vertical permanente no topo do muro', 0, 'kN/m', 'Estrutura apoiada no muro. A aba do Gilberto usa 2 m × sobrecarga (mínimo 2 tf/m²).', 'inp', '0.0', 'P_topo'); r += 1
line(E, r, 'Sobrecarga sobre o talão estabiliza?', 'Sim', '', 'Sim = como a aba do Gilberto (decisão sua). Não = carga logo atrás do talão: empurra mas não pesa (combinação dos livros).', 'inp', None, 'q_est'); r += 1
dv_qe = DataValidation(type='list', formula1='"Sim,Não"'); E.add_data_validation(dv_qe); dv_qe.add(f'B{r-1}')
line(E, r, "φ' do solo de apoio — opcional", None, '°', "Em branco = φ' adotado do solo contido. A aba do Gilberto usava o solo de cima.", 'inp', '0.0', 'phi_base'); r += 1
line(E, r, "δ/φ' na base", 0.67, '', 'Atrito sapata-solo: tg δ. 2/3 é o usual; 1,0 = aba do Gilberto (areia).', 'inp', '0.00', 'dphi'); r += 1
line(E, r, 'Adesão na base — opcional', 0, 'kPa', 'ATENÇÃO: resistência de curto prazo. A aba do Gilberto usa 0,5·SPT tf/m² em argila. Coerente com desprezar a coesão no empuxo: deixar 0.', 'inp', '0.0', 'ades_b'); r += 1
# Aterro sobre a ponta (Jose, 12/10): o projetista embute o muro, compacta terra na frente e garante que ninguém mexe
# nela — o peso sobre a ponta e o passivo mais alto ajudam. Mesma garantia do passivo: sem ela, o aterro não conta.
line(E, r, 'Aterro sobre a ponta (altura acima do topo da sapata)', 0.0, 'm', 'Solo compactado do lado de fora, sobre a ponta. Só conta com a garantia abaixo = Sim: peso sobre a ponta (tombamento, deslizamento, tensões, flexão da ponta) e altura do passivo.', 'inp', '0.00', 'h_fr'); r += 1
line(E, r, 'Solo da frente: há garantia de que jamais será escavado/removido?', 'Não', '', 'Sim = conta o aterro sobre a ponta e o empuxo passivo do solo da frente, Kp·γ·(h aterro + h sapata + dente)²/2, dividido por 2,0 (NBR 6122 7.6.3). Marcar Sim só se nenhuma escavação futura (vala, rede, calçada, jardim, terraplenagem) puder tirar esse solo durante a vida útil. Na dúvida, Não (Bastos: o passivo pode ser desprezado).', 'inp', None, 'pass_on'); r += 1
dv_po = DataValidation(type='list', formula1='"Sim,Não"'); E.add_data_validation(dv_po); dv_po.add(f'B{r-1}')
line(E, r, 'Aviso do passivo', '=IF(pass_on="Sim","Garantir que o solo da frente da sapata jamais seja escavado/removido (NBR 6122 7.6.3)","")', '', 'Aparece no app ao lado do campo e no memorial.', 'key', None, 'aviso_passivo'); r += 1
line(E, r, 'SPT abaixo da sapata', 10, 'golpes', 'Só para a sugestão de σadm (2·SPT tf/m² = N/5 kgf/cm², regra da aba do Gilberto).', 'inp', '0', 'SPT_b'); r += 1
line(E, r, 'σadm do solo — opcional', None, 'kPa', 'Em branco = 20·SPT kPa. Preferir valor de ensaio/projeto geotécnico.', 'inp', '0', 'sig_adm_dir'); r += 1
line(E, r, 'Coeficiente de reação vertical do solo (k) — opcional', None, 'kN/m³', 'Em branco = sugestão da aba Sapata sobre molas (120·σadm). Preferir prova de carga em placa.', 'inp', '0', 'ks_dir'); r += 1
line(E, r, 'FS mínimo ao tombamento', 2.0, '', 'Pelo que sei, NBR 11682 — conferir. Junto vale e ≤ B/4 (critério do Gilberto); fica o pior.', 'inp', '0.00', 'FS_tomb'); r += 1
line(E, r, 'FS mínimo ao deslizamento', 1.5, '', 'Aba do Gilberto: resistências ÷ 1,5.', 'inp', '0.00', 'FS_desl'); r += 1
line(E, r, 'Cobrimento da sapata', 4, 'cm', '', 'inp', '0.0', 'cob_sap'); r += 1
line(E, r, 'Ø principal (transversal)', 10, 'mm', '', 'inp', '0.0', 'phi_sap'); r += 1
lista(LST['lst_phi_sap'], f'B{r-1}')
line(E, r, 'Ø secundária (longitudinal)', 6.3, 'mm', '', 'inp', '0.0', 'phi_sap2'); r += 1
lista(LST['lst_phi_sap2'], f'B{r-1}')
line(E, r, 'Ø do estribo de torção (contrafortes)', 6.3, 'mm', '', 'inp', '0.0', 'phi_tor'); r += 1
lista(LST['lst_phi_sap2'], f'B{r-1}')
r += 1
section(E, r, 'Coeficientes'); r += 1
line(E, r, 'γf', 1.4, '', 'Majoração das ações.', 'inp', '0.00', 'gama_f'); r += 1
line(E, r, 'γm', 2.0, '', 'Alvenaria, combinações normais (NBR 16868-1; ABCP 3.1).', 'inp', '0.00', 'gama_m'); r += 1
line(E, r, 'γs', 1.15, '', 'Aço.', 'inp', '0.00', 'gama_s'); r += 1
widths(E, {'A': 36, 'B': 20, 'C': 9, 'D': 70, 'E': 14})
E.freeze_panes = 'A5'

# ================= REFERÊNCIAS (tabela fpk precisa existir) =================
R = wb.create_sheet('Referências')
title(R, 'Referências e tabelas', 'Cada resultado das outras abas aponta para cá. Aula = PDF "Muros de Arrimo, Piscinas e Reservatórios" (Prof. Matheus Carini).')
header(R, 3, ['Item', 'Fonte', 'O que diz / como foi usado'])
refs = [
    ('Rankine ativo com coesão', 'Aula 12.1, slide 8', "σ'ha = Ka·σ'v − 2c·√Ka; Ka = tg²(45° − φ'/2). Observação no slide: desconsiderar a coesão."),
    ('Passivo', 'Aula 12.1, slide 8', "σ'hp = Kp·σ'v + 2c·√Kp; Kp = tg²(45° + φ'/2)."),
    ('Sobrecarga', 'Aula 12.1, slide 8', 'Parcela Ka·q uniforme na altura.'),
    ('Água e tensões efetivas', 'Aula 12.1, slides 6, 7 e 11', "u = γw·zw; σ'v = σv − u; σh = K·σ'v + u. Empuxo da água somado ao do solo; drenagem obrigatória."),
    ('γ de areia por NSPT', 'Aula 12.1, slide 10 (Godoy, 1972)', 'Tabela reproduzida na aba Solo e Empuxo.'),
    ('φ de areia por NSPT', 'Aula 12.1, slide 10 (Alonso, 2010)', 'Tabela reproduzida na aba Solo e Empuxo.'),
    ('γ de argila por NSPT', 'Aula 12.1, slide 10 (Godoy, 1972)', 'Tabela reproduzida na aba Solo e Empuxo.'),
    ('σadm da sapata pelo SPT', 'Cintra, Aoki e Albiero, "Fundações diretas" (2011); Mello (1975)',
     'Regras práticas, só sugestão (aba Fundação, seção 6): σadm = 20·N kPa (N/50 MPa; a mesma da aba do Gilberto), para '
     '5 ≤ N ≤ 20; Mello: σadm = 100·(√N − 1) kPa, para 4 ≤ N ≤ 16. N = SPT médio no bulbo abaixo da base. Livro não '
     'visto aqui; as duas fórmulas e faixas como aparecem nas reproduções. Preferir ensaio/projeto geotécnico.'),
    ('γ e φ por tipo de solo', 'Aula 12.1, slide 10 (Gerscovich)', 'Solos do Rio de Janeiro — referência regional.'),
    ('Bloco em contato com o solo', 'Aula 12.1, slide 2', 'Classe A, fbk ≥ 8 MPa.'),
    ('Modelo do muro em balanço', 'Aula 12.1, slide 12', 'Engastado na base, carga σh,topo → σh,base.'),
    ('Modelo com contrafortes', 'Aula 12.1, slide 13 / aula 12.3', 'Painel h × l entre contrafortes; contraforte intermediário recebe σh·l. Detalhes da aula 12.3 na tabela da linha 82 em diante.'),
    ('fpk e fpk* a partir do fbk', 'Manual ABCP 2ª ed., Tab. 3.2', 'Tabela ao lado (bloco 14×19×39; indicativa — confirmar com ensaio de prisma).'),
    ('fk = 0,7·fpk; γm = 2,0', 'Manual ABCP 3.1 e 3.2', ''),
    ('Compressão na flexão', 'Manual ABCP 3.5', 'Fora do plano: 1,5·fk em região não grauteada; 2,0·fk em região grauteada.'),
    ('Flexão simples no ELU', 'Manual ABCP 3.4', 'Bloco 0,8x com fd; εc ≤ 0,30%; x ≤ 0,45d; z = d − 0,4x ≤ 0,95d; As = Md/(fyd·z).'),
    ('Armadura mínima de parede', 'Manual ABCP 3.6 / 6.2 (NBR 16868-1, 12.2)', '0,10% da seção, dispensável se a armadura disposta der MRd ≥ 1,4·MSd.'),
    ('Altura efetiva', 'Aula 12.2 (slide Altura efetiva, NBR 16868-1)', 'Sem travamento lateral transversal: he = h (travada no topo e na base) ou he = 2h (livre no topo). Com travamento lateral: he = mín(αv·h; 0,7·√(αv·h·αh·l)) — planilha 02_Compressao_Simples, aba Altura Efetiva.'),
    ('Esbeltez', 'Aula 12.2 (slide Índice de esbeltez)', 'Parede não armada ≤ 24 (30 em casa térrea com γm = 3,0); armada ≤ 30; muito esbelta sem limite (Anexo C).'),
    ('Deformação e tensão no aço', 'Planilha 04_Flexão_Simples do curso', 'εc = 0,30% na borda; εs ≤ 1%; σs = 21000·εs (kN/cm²) ≤ fyd. Domínio 2/3 em x = 3/13·d; ductilidade x ≤ 0,45d.'),
    ('Armadura mínima na planilha do curso', 'Planilha 04_Flexão_Simples / aula 12.2', 'Usa 0,15%·b·d (critério de viga), também no arrimo da aula 12.2. A NBR 16868-1 (item 12.2) pede 0,10% da seção para parede. Escolha nas Entradas.'),
    ('Arranjos de armadura', 'Aula 12.2', 'Calcula As por faixa bm = 20/40/60/80 cm (um furo armado por faixa), compara com As,mín e escolhe a barra. Exemplo: Ø10 c/40. Reproduzido na aba Arranjos; a coluna da grade marca as faixas que o graute a cada X aceita (13/10).'),
    ('Altura útil no arrimo', 'Aula 12.2', 'Barra a 5 cm da face do solo no bloco de 19 → d = 14 cm (lado tracionado = lado do solo). ABCP: cobrimento de graute ≥ 15 mm.'),
    ('Seção para o ELS', 'Aula 12.2 + planilha 06_Vigas_ELS (aba I)', 'Faixa bm com furo grauteado no centro: seção I, mesas = paredes do bloco (hf), alma bw = 21,25 cm no 19×39. Im = bm·h³/12 − (bm − bw)·(h − 2hf)³/12; Mr = ftk·Im/yt; LN na mesa (retangular) ou na alma (T); Ieq de Branson; heq = (12·Ieq/bm)^(1/3) para o Ftool.'),
    ('Módulo da alvenaria no ELS', 'Aula 12.2', 'fpk,liq = fpk/(Aliq/Abr) = 6/0,54 = 11,1 MPa; Em = 800·fpk,liq = 8889 MPa; n = 210000/8889 = 23,6. Explica o E = 8889 do Ftool.'),
    ('Flecha', 'Aula 12.2 (slides ELS)', 'Limite menor vão/250; flecha final δ∞ = δ0·(1 + Δξ/(1 + 50ρ\')), Δξ = 1 (NBR 16868-1); ρ\' = As\'/(b·d).'),
    ('Detalhamento do exemplo', 'Aula 12.2', 'Ø10 c/40 vertical com gancho na fundação (lb,nec); canaletas a cada 80 cm com Ø10.'),
    ('Ancoragem', 'Aula 12.2 (tabela baseada em Araújo, 2014)', 'lb,nec = lb·As,calc/As,ef. As,calc = As do momento fletor (ou al·Vsd/(d·fyd) em extremidades de viga). lb,mín = máx(0,3·lb; 10Ø; 10 cm) — NBR 6118 9.4.2.5.'),
    ('Painel não armado entre armaduras', 'Aula 12.2', 'Painel l × h entre barras verticais (l = bm) e canaletas (h = 80 cm). Pior = painel inferior; carga média do trapézio (exemplo: 6,88 → 12,96, média 9,92 kN/m²; pd = 1,4·9,92). Método: aguardando prints.'),
    ('K na compressão da flexão (curso)', 'Planilha 04_Flexão_Simples (aba T) — aula 12.2', 'Kfd = K·0,7·fpk/2. Na aula 12.2: fpk = 1,111 kN/cm² (11,1 MPa, área líquida) e K = 1,0 → Kfd = 0,389 kN/cm² (print da planilha). Na aba T, x e As1 são achados pelo Solver (ΣFx = 0 e ΣM − Md = 0).'),
    ('Taxa de grauteamento μ', 'Planilha 01_Materiais do curso', 'μ = (fpk,nec − fpk)/(fpk* − fpk): fração de furos grauteados para atingir o fpk necessário (interpolação entre prisma oco e cheio).'),
    ('Cisalhamento (curso)', 'Planilha 05_Cisalhamento', 'Não armada: fvk pela classe da argamassa + 0,5σ, τ = Vd/(b·h). Armada: fvk = 0,35 + 17,5ρ (ρ ≤ 2%), τ = Vd/(b·d). Igual ao usado aqui.'),
    ('Modelos Ftool do professor', 'Arquivos F10/F11 do curso + aula 12.2', 'F10 (balanço): barra de 1,60 m, carga de serviço na faixa de 40 cm (0,32 → 5,18 kN/m = Ka·(q + γz)·0,40 com Ka 0,4, q 2, γ 19). Seção "40 x 9.3" = retângulo com a Ieq de Branson (2687 cm⁴) e E = 8889 MPa = 800·fpk,liq (medido na aula).'),
    ('Momento de 2ª ordem', 'Manual ABCP 3.6.3.2', 'M2d = Nd·he²/(3600·t).'),
    ('Cisalhamento', 'Manual ABCP 3.3', 'τvd = Vd/(b·d) (armada); fvk = 0,35 + 17,5ρ ≤ 0,7 MPa com armadura de flexão em furo grauteado; fvd = fvk/γm.'),
]
for i, (a, b, c) in enumerate(refs):
    rr = 4 + i
    for col, v in zip('ABC', (a, b, c)):
        cell = R[f'{col}{rr}']; cell.value = v; cell.font = fN; cell.border = BOX
        cell.alignment = Alignment(wrap_text=True, vertical='top')
R['A40'] = 'βf — painéis não armados (planilha 11_Painéis Fletidos do curso, aba Ábacos NBR). Linhas = μ; colunas = h/l. Laranja = valor suspeito de digitação na planilha do curso (mantido como está).'; R['A40'].font = fB
PAN = {13: [(1, [0.011, 0.02, 0.026, 0.037, 0.045, 0.06, 0.075, 0.091, 0.106, 0.122, 0.123]), (0.9, [0.012, 0.022, 0.028, 0.038, 0.048, 0.064, 0.08, 0.096, 0.113, 0.122, 0.123]), (0.8, [0.014, 0.024, 0.029, 0.04, 0.052, 0.069, 0.086, 0.103, 0.118, 0.122, 0.123]), (0.7, [0.016, 0.025, 0.031, 0.042, 0.057, 0.075, 0.093, 0.112, 0.118, 0.122, 0.123]), (0.6, [0.019, 0.027, 0.033, 0.044, 0.063, 0.082, 0.102, 0.113, 0.118, 0.122, 0.123]), (0.5, [0.022, 0.029, 0.035, 0.049, 0.07, 0.092, 0.104, 0.113, 0.118, 0.122, 0.123]), (0.4, [0.025, 0.032, 0.038, 0.056, 0.08, 0.104, 0.113, 0.113, 0.118, 0.122, 0.123]), (0.35, [0.027, 0.034, 0.04, 0.061, 0.087, 0.113, 0.113, 0.113, 0.118, 0.122, 0.123]), (0.3, [0.029, 0.36, 0.042, 0.067, 0.095, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125])], 18: [(1, [0.031, 0.038, 0.045, 0.075, 0.106, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125]), (0.9, [0.032, 0.04, 0.048, 0.08, 0.113, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125]), (0.8, [0.034, 0.042, 0.052, 0.086, 0.12, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125]), (0.7, [0.035, 0.044, 0.057, 0.093, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125]), (0.6, [0.038, 0.047, 0.063, 0.102, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125]), (0.5, [0.04, 0.053, 0.07, 0.113, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125]), (0.4, [0.043, 0.061, 0.08, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125]), (0.35, [0.046, 0.066, 0.087, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125]), (0.3, [0.051, 0.073, 0.095, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125])], 11: [(1, [0.011, 0.02, 0.031, 0.07, 0.106, 0.127, 0.146, 0.164, 0.18, 0.24, 0.301]), (0.9, [0.013, 0.022, 0.035, 0.078, 0.111, 0.132, 0.152, 0.152, 0.193, 0.256, 0.321]), (0.8, [0.014, 0.025, 0.039, 0.088, 0.116, 0.139, 0.159, 0.159, 0.208, 0.276, 0.344]), (0.7, [0.016, 0.029, 0.045, 0.097, 0.123, 0.156, 0.167, 0.167, 0.227, 0.299, 0.373]), (0.6, [0.019, 0.033, 0.052, 0.103, 0.13, 0.155, 0.176, 0.176, 0.25, 0.329, 0.408]), (0.5, [0.023, 0.04, 0.063, 0.111, 0.14, 0.165, 0.195, 0.195, 0.28, 0.366, 0.454]), (0.4, [0.028, 0.05, 0.078, 0.122, 0.152, 0.179, 0.225, 0.225, 0.321, 0.418, 0.515]), (0.35, [0.032, 0.057, 0.089, 0.128, 0.16, 0.194, 0.244, 0.244, 0.347, 0.451, 0.556]), (0.3, [0.038, 0.067, 0.098, 0.137, 0.169, 0.214, 0.269, 0.269, 0.381, 0.493, 0.606])]}
HL = [0.3, 0.4, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]
from openpyxl.utils import get_column_letter as _gl
SUS = PatternFill('solid', fgColor='F8CBAD')
for k, (case, tab) in enumerate([(13, PAN[13]), (18, PAN[18]), (11, PAN[11])]):
    r0 = 42 + k * 12
    R.cell(row=r0, column=1, value=f'Caso {case}').font = fB
    R.cell(row=r0, column=2, value={13: '4 bordas apoiadas', 18: 'topo livre', 11: 'lateral direita livre'}[case]).font = fS
    R.cell(row=r0 + 1, column=1, value='μ \\ h/l').font = fH; R.cell(row=r0 + 1, column=1).fill = NAVY
    for j, hl in enumerate(HL):
        c = R.cell(row=r0 + 1, column=2 + j, value=hl); c.font = fH; c.fill = NAVY; c.alignment = Alignment(horizontal='center')
    for i, (mu, vals) in enumerate(tab):
        c = R.cell(row=r0 + 2 + i, column=1, value=mu); c.font = fB; c.border = BOX; c.alignment = Alignment(horizontal='center')
        for j, v in enumerate(vals):
            c = R.cell(row=r0 + 2 + i, column=2 + j, value=v); c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center'); c.number_format = '0.000'
    name(f'tabB{case}', R, f'B{r0+2}')
    wb.defined_names[f'tabela_{case}'] = DefinedName(f'tabela_{case}', attr_text=f"'Referências'!$B${r0+2}:$L${r0+10}")
wb.defined_names['mu_col'] = DefinedName('mu_col', attr_text="'Referências'!$A$44:$A$52")
wb.defined_names['hl_row'] = DefinedName('hl_row', attr_text="'Referências'!$B$43:$L$43")
for addr in ('C52',):            # caso 13, μ 0,3, h/l 0,4 = 0,36
    R[addr].fill = SUS
for rr in range(57, 65):         # caso 18? não — caso 11 está em 66+; marcado abaixo
    pass
for rr in range(69, 77):         # caso 11, coluna h/l 1,75 igual à 1,5 (μ 0,9 a 0,3)
    R[f'I{rr}'].fill = SUS
R['A79'] = 'Suspeitas (dedução nossa): caso 13 μ 0,3 h/l 0,4 = 0,36 (provável 0,036); caso 11 coluna h/l 1,75 repete a de 1,5 de μ 0,9 para baixo. Conferir no Anexo E da NBR 16868-1. Com as argamassas da tabela, μ = 0,5 sempre — essas células não entram no cálculo.'; R['A79'].font = fS
# Tab 3.2 ABCP
R['H3'] = 'Tab. 3.2 ABCP'; R['H3'].font = fB
for col, h_ in zip('HIJ', ['fbk', 'fpk', 'fpk*']):
    c = R[f'{col}4']; c.value = h_; c.font = fH; c.fill = NAVY; c.alignment = Alignment(horizontal='center')
TAB = [(3, 2.4, 4.8), (4, 3.2, 6.4), (6, 4.5, 7.9), (8, 6.0, 10.5), (10, 7.0, 12.3), (12, 8.4, 13.4), (14, 9.8, 15.7),
       (16, 10.4, 16.6), (18, 11.7, 18.7), (20, 12.0, 19.2), (22, 12.1, 19.4), (24, 13.2, 21.1)]
for i, row in enumerate(TAB):
    for col, v in zip('HIJ', row):
        c = R[f'{col}{5+i}']; c.value = v; c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center')
R['H18'] = 'MPa. fpk* = prisma cheio (2 furos grauteados).'; R['H18'].font = fS
# O resto da linha do fbk na planilha 01 do curso (Jose, 13/10: "não está tão completa quanto a do Carini"): fa e as
# duas eficiências. Ficam em E:G, encostadas na Tab. 3.2, porque H:K já é lido por VLOOKUP e pelo app pelo endereço.
# As eficiências vão DIGITADAS como no curso (0,75; 1,75; 1,6), não fpk/fbk dividido: a divisão dos valores
# arredondados dá 1,76 onde o curso diz 1,75, e quem confere lado a lado com o Carini veria número diferente.
# Nenhuma conta lê estas colunas: são consulta (tabela da Fig. 23 no app).
R['E3'] = 'Planilha 01 do curso'; R['E3'].font = fB
for col, h_ in zip('EFG', ['fa', 'fpk/fbk', 'fpk*/fpk']):
    c = R[f'{col}4']; c.value = h_; c.font = fH; c.fill = NAVY; c.alignment = Alignment(horizontal='center')
TAB01 = [(4, 0.8, 2), (4, 0.8, 2), (6, 0.75, 1.75), (6, 0.75, 1.75), (8, 0.7, 1.75), (8, 0.7, 1.6), (12, 0.7, 1.6),
         (12, 0.65, 1.6), (14, 0.65, 1.6), (14, 0.6, 1.6), (18, 0.55, 1.6), (18, 0.55, 1.6)]
for i, row in enumerate(TAB01):
    for col, v, fm in zip('EFG', row, ('0', '0.00', '0.00')):
        c = R[f'{col}{5+i}']; c.value = v; c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center'); c.number_format = fm
R['E18'] = 'fa em MPa (resistência da argamassa). Mesmas linhas de fbk da Tab. 3.2.'; R['E18'].font = fS
R['L3'] = 'Barras CA-50'; R['L3'].font = fB
R['L14'] = 'Argamassa — NBR 16868-1 (ftk: Tabela 3; fvk: planilha 05 do curso)'; R['L14'].font = fB
for j, h_ in enumerate(['Argamassa', 'ftk ⊥ fiada', 'ftk ∥ fiada', 'fvk0', 'fvk máx']):
    c = R.cell(row=15, column=12 + j, value=h_); c.font = fH; c.fill = NAVY; c.alignment = Alignment(horizontal='center', wrap_text=True)
for i, row_ in enumerate([('1,5 a 3,4 MPa', 0.10, 0.20, 0.10, 1.0), ('3,5 a 7,0 MPa', 0.20, 0.40, 0.15, 1.4), ('acima de 7,0 MPa', 0.25, 0.50, 0.35, 1.7)]):
    for j, v in enumerate(row_):
        c = R.cell(row=16 + i, column=12 + j, value=v); c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center')
R['L19'] = 'MPa. fvk = fvk0 + 0,5·σ ≤ fvk máx (não armada).'; R['L19'].font = fS
R['L21'] = 'Blocos de concreto — aula (dimensões, Aliq/Abr, graute)'; R['L21'].font = fB
for j, h_ in enumerate(['Bloco', 'parede (cm)', 'Aliq/Abr', 'graute (cm²)']):
    c = R.cell(row=22, column=12 + j, value=h_); c.font = fH; c.fill = NAVY; c.alignment = Alignment(horizontal='center', wrap_text=True)
for i, row_ in enumerate([('14x39', 2.7, 0.57, 117), ('19x39', 3.5, 0.54, 170)]):
    for j, v in enumerate(row_):
        c = R.cell(row=23 + i, column=12 + j, value=v); c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center')
R['O2'] = 'lb (cm) — aula 12.2, baseado em Araújo (2014). Reta: O–U; com gancho: W–AC.'; R['O2'].font = fB
LB_R = [(6.3, 27.5, 39.3, 23.7, 33.9, 21.0, 30.0), (8, 35.0, 50.0, 30.1, 43.0, 26.7, 38.1), (10, 43.7, 62.4, 37.7, 53.8, 33.4, 47.7),
        (12.5, 54.6, 78.1, 47.1, 67.3, 41.7, 59.6), (16, 69.9, 99.9, 60.3, 86.1, 53.4, 76.2), (20, 87.4, 124.9, 75.3, 107.6, 66.7, 95.3),
        (22, 96.2, 137.4, 82.9, 118.4, 73.4, 104.8), (25, 109.3, 156.1, 94.2, 134.5, 83.4, 119.1)]
LB_G = [(6.3, 19.3, 27.5, 16.6, 23.7, 14.7, 21.0), (8, 24.5, 35.0, 21.1, 30.1, 18.7, 26.7), (10, 30.6, 43.7, 26.4, 37.7, 23.4, 33.4),
        (12.5, 38.2, 54.7, 33.0, 47.1, 29.2, 41.7), (16, 48.9, 69.9, 42.2, 60.3, 37.4, 53.3), (20, 61.2, 87.4, 52.7, 75.3, 46.7, 66.7),
        (22, 67.3, 96.2, 58.0, 82.9, 51.4, 73.4), (25, 76.5, 109.3, 65.9, 94.2, 58.4, 83.4)]
from openpyxl.utils import get_column_letter as _gcl
for c0, tab, lab in ((15, LB_R, 'Reta'), (23, LB_G, 'Gancho')):
    R.cell(row=3, column=c0, value=lab).font = fB
    for j, h_ in enumerate(['Ø', 'C20 Boa', 'C20 Má', 'C25 Boa', 'C25 Má', 'C30 Boa', 'C30 Má']):
        c = R.cell(row=4, column=c0 + j, value=h_); c.font = fH; c.fill = NAVY; c.alignment = Alignment(horizontal='center', wrap_text=True)
        R.column_dimensions[_gcl(c0 + j)].width = 8
    for i, row_ in enumerate(tab):
        for j, v in enumerate(row_):
            c = R.cell(row=5 + i, column=c0 + j, value=v); c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center')
for col, h_ in zip('LM', ['Ø (mm)', 'As (cm²)']):
    c = R[f'{col}4']; c.value = h_; c.font = fH; c.fill = NAVY; c.alignment = Alignment(horizontal='center')
for i, ph in enumerate(PHI_BARRAS):
    R[f'L{5+i}'] = ph; R[f'M{5+i}'] = f'=PI()*L{5+i}^2/400'; R[f'M{5+i}'].number_format = '0.000'
    for cc in 'LM':
        R[f'{cc}{5+i}'].font = fN; R[f'{cc}{5+i}'].border = BOX; R[f'{cc}{5+i}'].alignment = Alignment(horizontal='center')

# ---- Listas das Entradas (validação de dados; ver LST no começo das Entradas) ----
# As que dependem de outra entrada são fórmula: a lista muda com o bloco ou com o tipo de muro. Valores como n·20/100
# (inteiro ÷ 100): dá o mesmo double que o número digitado ("1,6"), e a validação e o CORRESP exato reconhecem.
R['AJ2'] = 'Listas das Entradas (montagens fechadas, decisão do Jose 09/10). Branco no topo = automático.'; R['AJ2'].font = fB
_lst_cab = {'AJ': 'Altura (m)', 'AK': 'Eixo a eixo (m)', 'AL': 'Contraforte (cm)', 'AM': 'Barras (cm)',
            'AN': 'Canaletas balanço (m)', 'AO': 'Canaletas contraf. (cm)', 'AP': 'Ø estribo (mm)',
            'AQ': 'Ø sapata (mm)', 'AR': 'Ø sapata secund./torção (mm)', 'AS': 'Ø com espera (mm)',
            'BB': 'Graute a cada (cm)'}
_lst_col = {}
for col, h_ in _lst_cab.items():
    c = R[f'{col}4']; c.value = h_; c.font = fH; c.fill = NAVY; c.alignment = Alignment(horizontal='center', wrap_text=True)
    R.column_dimensions[col].width = 11
# altura: fiadas inteiras de 20 cm, de 0,60 m até o limite do app (3,0 m no balanço, 4,0 m com contrafortes)
_lst_col['AJ'] = [f'=IF({n * 20}<=IF(Tipo_muro="Contrafortes",400,300),{n * 20}/100,"")' for n in range(3, 21)]
# eixo a eixo = t + 1 cm + n·m. 19×39: todo n amarra (0,80 a 4,00 m). 14×39: só n PAR amarra com o contraforte de
# 34/54 (encaixes do Revit; a modulação do app prova montando as fiadas — modulacao/fiadas.ts vaoAmarra) — 0,95 a 3,75.
_lst_col['AK'] = [f'=IF(t_bloco=19,(t_bloco+1+{k + 3}*m_mod)/100,' + (f'(t_bloco+1+{2 * (k + 2)}*m_mod)/100' if k < 8 else '""') + ')'
                  for k in range(17)]
# contraforte: as montagens que o Jose modelou no Revit (19 → 59/79; 14 → 34/54)
_lst_col['AL'] = ['=IF(t_bloco=19,59,34)', '=IF(t_bloco=19,79,54)']
# barras (balanço e painel vertical): múltiplos do GRAUTE A CADA até 6t (NBR 16868-1 11.3.5, o mesmo teto do
# automático) — a barra cai num furo grauteado (Jose, 13/10)
_lst_col['AM'] = [None] + [f'=IF({n}*Graute<=6*t_bloco,{n}*Graute,"")' for n in range(1, 7)]
# graute a cada: múltiplos de m até 6t (bloco 19: 20 a 100; bloco 14: 20 a 80)
_lst_col['BB'] = [f'=IF({n}*m_mod<=6*t_bloco,{n}*m_mod,"")' for n in range(1, 6)]
_lst_col['AN'] = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6]
_lst_col['AO'] = [None] + [20 * n for n in range(1, 9)]
_lst_col['AP'] = [5, 6.3]
_lst_col['AQ'] = [6.3, 8, 10, 12.5, 16, 20, 25]
_lst_col['AR'] = [5, 6.3, 8, 10, 12.5]
# Ø das barras que nascem de uma espera na sapata (balanço, painel, contraforte e construtivas): só os que a dobra do
# pé cabe na altura da sapata (h_dobra, acima). Espera sem gancho é reta, não dobra: aí valem todos. A conta cresce
# com o Ø, então a lista é sempre do 6,3 até o maior que cabe — e o app, quando o Ø sai dela, fica com esse maior.
_lst_col['AS'] = [f'=IF(OR(gancho_<>"Sim",{h_dobra(b)}<=h_sap*100),{b},"")' for b in PHI_BARRAS]
for col, vals in _lst_col.items():
    for i, v in enumerate(vals):
        c = R[f'{col}{5 + i}']; c.value = v; c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center')
for nm, ref in LST.items():
    assert int(ref.split('$')[-1]) - int(ref.split('$')[2].rstrip(':')) + 1 == len(_lst_col[ref.split('$')[1]]), nm
    wb.defined_names[nm] = DefinedName(nm, attr_text=f"'Referências'!{ref}")
R['AJ24'] = ('Eixo a eixo: 0,80 a 4,00 m. Abaixo disso o vão livre entre contrafortes tem 2 a 3 blocos (melhor engrossar o '
             'muro); acima de 4,00 m a tabela de δ já está no fim (lenr/eenr ≥ 20 → δ = 1: o contraforte não enrijece mais a '
             'parede) e o painel só cai na tabela de Libânio (γ = h/l ≥ 0,30) com h ≥ 1,20 m. Canaletas: até 1,60 m (8 fiadas).')
R['AJ24'].font = fS
R['AJ25'] = ('Ø com espera: só os Ø cuja dobra do pé da espera cabe na sapata — 2c + Ø transversal + Ø longitudinal + D + 2φ '
             '≤ h da sapata; D = 5φ (φ < 20 mm) ou 8φ (φ ≥ 20 mm), NBR 6118 Tab. 9.1 (CA-50). Cobrimento em cima e embaixo '
             'e pé apoiado na malha: dedução (é como o app desenha a espera). Espera sem gancho (reta): todos. Conta por '
             'espera na aba Fundação, seção 10.')
R['AJ25'].font = fS
widths(R, {'A': 30, 'B': 34, 'C': 80, 'H': 8, 'I': 8, 'J': 8, 'L': 16, 'M': 10, 'N': 10, 'O': 8, 'P': 8})

# ================= SOLO E EMPUXO =================
# Argila por consistência (09/10): tabela de REFERÊNCIA para c', φ' e su. Só entra o que foi conferido em fonte (página
# e URL na aba Referências); onde as fontes divergem, a célula mostra a faixa. Linhas = as mesmas faixas de NSPT da
# tabela de Godoy (γ de argila), que a NBR 6484 chama de consistência.
# Pesquisa de 09/10 (fontes conferidas em página aberta; o livro do Joppert e o capítulo de Teixeira & Godoy NÃO foram
# vistos no original — os números vêm de três reproduções que concordam entre si):
#   c', φ'  Joppert Jr. (2007): faixa = menor e maior valor entre as três argilas da tabela dele (porosa vermelha/
#           amarela, siltosa pouco arenosa, arenosa pouco siltosa), t/m² × 10 ≈ kPa como na reprodução da UFV.
#   su      Teixeira & Godoy (1996): su = 10·NSPT kPa, resistência NÃO drenada (curto prazo) — não é o c' do Rankine.
#   γ       Godoy (1972), o mesmo da tabela J:K (a aula).
#   consistência: NBR 7250 / NBR 6484 (≥ 20 = dura; a 6484:2020 separa 20–30 muito rija e > 30 dura).
ARG_TITULO = "Argila por consistência — c' e φ' (Joppert, 2007); su = 10·N (Teixeira e Godoy, 1996)"
ARG_TAB = [  # NSPT ≥, consistência, γ (kN/m³), c' (kPa), φ' (°), su = 10·N (kPa)
    (0, 'muito mole (≤ 2)', 13, '7,5 a 10', '15 a 20', '0 a 20'),
    (3, 'mole (3–5)', 15, '15 a 20', '15 a 23', '30 a 50'),
    (6, 'média (6–10)', 17, '20 a 35', '18 a 25', '60 a 100'),
    (11, 'rija (11–19)', 19, '30 a 70', '20 a 25', '110 a 190'),
    (20, 'dura (≥ 20)', 21, '30 a 70', '25', '≥ 200'),
]
ARG_NOTA = ("Referência, não valor de projeto: ensaios publicados deram c' bem menor que estas faixas (aba Referências). "
            "su é resistência não drenada (curto prazo), não entra no empuxo de Rankine. 1 tf/m² ≈ 10 kPa.")
# (rótulo, coluna da tabela, unidade, nome definido) — as linhas verdes de sugestão no topo da aba. su não vem da faixa
# da tabela: é a própria fórmula 10·NSPT com o NSPT digitado (coluna None).
ARG_SUG = [('Consistência da argila (NSPT)', 'O', '', 'cons_arg'), ("c' argila (Joppert 2007)", 'Q', 'kPa', 'c_arg'),
           ("φ' argila (Joppert 2007)", 'R', '°', 'phi_arg'), ('su argila = 10·NSPT (não drenada)', None, 'kPa', 'su_arg')]
ARG_FONTE = {'O': 'NBR 7250 / NBR 6484', 'Q': 'Joppert Jr. (2007)', 'R': 'Joppert Jr. (2007)', None: 'Teixeira & Godoy (1996)'}
_URL_UFU = 'https://repositorio.ufu.br/bitstream/123456789/28056/1/Aplicac%CC%A7a%CC%83oPo%CC%81Pedra.pdf'
_URL_FACIG = 'https://pensaracademico.unifacig.edu.br/index.php/repositoriotcc/article/download/3081/2132/10605'
_URL_UFV = 'https://spgeotecnia.pt/wp-content/uploads/2024/08/pdfW186sX.pdf'
_URL_TITO = 'https://www.maxwell.vrac.puc-rio.br/24688/24688_4.PDF'
ARG_REFS = [   # (item, fonte, o que diz) — vão para a aba Referências, linha 154 em diante
    ("c' e φ' de argila por NSPT",
     'Joppert Jr., I. (2007). Fundações e contenções de edifícios. Pini. Original não visto; conferido em três reproduções: '
     'Pereira (TCC UFU, 2019) Tab. 6 p. 17; Leal (TCC UniFacig, 2019) Tab. 4 p. 11; Carneiro et al. (UFV) Quadro 1 p. 4.',
     "Faixa da planilha = menor e maior valor entre argila porosa, argila siltosa pouco arenosa e argila arenosa pouco "
     "siltosa; t/m² × 10 ≈ kPa. As reproduções chamam c' e φ' de efetivos. Divergência: UniFacig traz 0,75 t/m² onde UFU e "
     f"UFV trazem 0,8 (daí 7,5 a 10 kPa na 1ª linha). {_URL_UFU} · {_URL_FACIG} · {_URL_UFV}"),
    ('su (coesão não drenada) de argila',
     'Teixeira, A. H.; Godoy, N. S. (1996), in Hachich et al., Fundações: teoria e prática. Pini. Conferido em Tito (dissertação '
     'PUC-Rio, 2014) p. 82, eq. 3.14.',
     'su = 10·NSPT (kPa), NÃO drenada (curto prazo) — não é o c\' do Rankine. Terzaghi & Peck / Hunt (su = qu/2) dão cerca '
     f'de 2/3 disso para o mesmo N (Tito, Tab. 3.9 p. 84). {_URL_TITO}'),
    ('Consistência da argila pelo NSPT',
     'NBR 7250 / NBR 6484 (texto da norma não visto; apostila FSP TAB 1 p. 82; Silva et al., PUC Goiás 2021, Tab. 2 p. 3).',
     '≤ 2 muito mole; 3–5 mole; 6–10 média; 11–19 rija; ≥ 20 dura. A NBR 6484:2020 separa 20–30 muito rija e > 30 dura. '
     'São as mesmas faixas da tabela de γ de Godoy (1972).'),
    ('Correlação × ensaio (argila)',
     'Oliveira & Porto, XXI COBRAMSEG (2024) Tab. 4 e 5 p. 7; Carneiro et al. (UFV) Quadro 3 p. 7.',
     "Triaxial CIU em Cascavel-PR: c' 9,3 e 21,4 kPa contra 15–30 e 30–70 de Joppert (o φ' bateu); 10·N superestimou a "
     "coesão em 60 a 80 %. Viçosa: c' 0,7 kPa no cisalhamento direto inundado contra 10 kPa de Joppert. Por isso a tabela é "
     'referência; o c\' de projeto sai de ensaio (aviso no topo das Entradas).'),
]
S = wb.create_sheet('Solo e Empuxo', 1)
title(S, 'Solo e empuxo (Rankine) — aula 12.1', 'Sugestões das tabelas da aula (verde) e diagrama de pressões calculado em 40 fatias.')
header(S, 3, ['Item', 'Valor', 'Unid.', 'Observação', 'Fonte'])
r = 4
section(S, r, 'Sugestões das tabelas (você adota na aba Entradas)'); r += 1
# tables placed lower, referenced here
line(S, r, 'γ areia (Godoy 1972)', "=INDEX($B$25:$D$29,MATCH(NSPT,$A$25:$A$29,1),MATCH(Umidade,$B$24:$D$24,0))", 'kN/m³', 'Pelo NSPT e pela umidade.', 'sug', '0', None, 'Slide 10'); r += 1
line(S, r, 'φ areia (Alonso 2010)', '=INDEX($G$25:$G$29,MATCH(NSPT,$F$25:$F$29,1))', '°', 'Faixa pelo NSPT.', 'sug', None, None, 'Slide 10'); r += 1
line(S, r, 'γ argila (Godoy 1972)', '=INDEX($K$25:$K$29,MATCH(NSPT,$J$25:$J$29,1))', 'kN/m³', 'Pelo NSPT.', 'sug', '0', None, 'Slide 10'); r += 1
# Argila por consistência (09/10): a aula só traz γ de argila. c', φ' e su vêm da tabela em N23:S29 (fontes conferidas,
# coluna S e Referências). É SUGESTÃO, como as de areia: nada vai sozinho para a conta. Os nomes existem para a
# calculadora da Fig. 22 do app ler o MESMO número da planilha.
for _lab, _col, _un, _nm in ARG_SUG:
    if _col:
        line(S, r, _lab, f'=INDEX(${_col}$25:${_col}$29,MATCH(NSPT,$N$25:$N$29,1))', _un, 'Faixa pela consistência (NSPT).', 'sug', None, _nm, ARG_FONTE[_col]); r += 1
    else:   # su: a correlação é contínua no NSPT; a tabela só mostra a faixa de cada consistência
        line(S, r, _lab, '=10*NSPT', _un, 'Curto prazo (não drenada): não é o c\' do empuxo.', 'sug', '0', _nm, ARG_FONTE[_col]); r += 1
# Gerscovich não tem argila: com Argila a sugestão pela classe é "—" mesmo que a classe digitada seja outra (o Excel
# não troca a entrada sozinho). "Não se aplica" está na lista com "—" na tabela.
line(S, r, 'γ pela classe (Gerscovich)', '=IF(Tipo_solo="Argila","—",INDEX($B$32:$B$39,MATCH(Classe_G,$A$32:$A$39,0)))', 'kN/m³', 'Faixa — solos do RJ. Não cobre argila.', 'sug', None, None, 'Slide 10'); r += 1
line(S, r, 'φ pela classe (Gerscovich)', '=IF(Tipo_solo="Argila","—",INDEX($C$32:$C$39,MATCH(Classe_G,$A$32:$A$39,0)))', '°', 'Faixa — solos do RJ. Não cobre argila.', 'sug', None, None, 'Slide 10'); r += 1
section(S, r, 'Coeficientes e resultados'); r += 1
line(S, r, 'Ka', '=IF(ISNUMBER(Ka_dir),Ka_dir,TAN(RADIANS(45-phi_solo/2))^2)', '', "tg²(45° − φ'/2), ou o Ka digitado nas Entradas", 'res', '0.000', 'Ka_', 'Slide 8'); r += 1
# Ka digitado = 0 dava 1/0 → #DIV/0! em Kp, que derrubava o passivo e o FS ao deslizamento da Fundação. Com erro,
# Kp = 0: o passivo sai da conta (a favor da segurança) e o resto da Fundação continua calculando.
line(S, r, 'Kp', '=IFERROR(IF(ISNUMBER(Ka_dir),1/Ka_dir,TAN(RADIANS(45+phi_solo/2))^2),0)', '', "tg²(45° + φ'/2); com Ka digitado, Kp = 1/Ka (Rankine, terreno horizontal). Ka digitado = 0 → Kp = 0 (passivo desprezado)", 'res', '0.000', 'Kp_', 'Slide 8'); r += 1
line(S, r, 'σh no topo', '=G44', 'kPa', 'Pressão horizontal total no topo.', 'res', '0.00', 'sh_topo'); r += 1
line(S, r, 'σh na base', '=G84', 'kPa', 'Pressão horizontal total na base.', 'res', '0.00', 'sh_base'); r += 1
line(S, r, 'Ea (solo)', '=SUM(H44:H83)', 'kN/m', "∫σ'h dz", 'res', '0.00', 'Ea_', 'Slide 8'); r += 1
line(S, r, 'Ew (água)', '=SUM(I44:I83)', 'kN/m', '∫u dz', 'res', '0.00', 'Ew_', 'Slide 8'); r += 1
line(S, r, 'Vk na base (Ea + Ew)', '=SUM(J44:J83)', 'kN/m', 'Força horizontal total por metro.', 'key', '0.00', 'Vk_'); r += 1
line(S, r, 'Mk na base', '=SUM(L44:L83)', 'kN·m/m', 'Momento na base do muro.', 'key', '0.00', 'Mk_'); r += 1
assert r <= 23, r          # a linha 23 é o título das tabelas da aula (coluna A; esta seção acaba na 22)
# --- tabelas da aula (linhas 18-33) ---
S['A23'] = 'Godoy 1972 — γ areia (kN/m³)'; S['A23'].font = fB
for col, h_ in zip('ABCD', ['NSPT ≥', 'Seca', 'Úmida', 'Saturada']):
    c = S[f'{col}24']; c.value = h_; c.font = fH; c.fill = NAVY
godoy_a = [(0, 16, 18, 19), (5, 16, 18, 19), (9, 17, 19, 20), (19, 18, 20, 21), (41, 18, 20, 21)]
for i, row in enumerate(godoy_a):
    for col, v in zip('ABCD', row): S[f'{col}{25+i}'] = v
S['E25'] = 'fofa (<5)'; S['E26'] = 'pouco compacta (5–8)'; S['E27'] = 'med. compacta (9–18)'; S['E28'] = 'compacta (19–40)'; S['E29'] = 'muito compacta (>40)'
S['F23'] = 'Alonso 2010 — φ areia'; S['F23'].font = fB
for col, h_ in zip('FG', ['NSPT ≥', 'φ (°)']):
    c = S[f'{col}24']; c.value = h_; c.font = fH; c.fill = NAVY
for i, (n_, ph) in enumerate([(0, '< 30'), (4, '30 a 35'), (10, '35 a 40'), (30, '40 a 45'), (51, '> 45')]):
    S[f'F{25+i}'] = n_; S[f'G{25+i}'] = ph
S['J23'] = 'Godoy 1972 — γ argila'; S['J23'].font = fB
for col, h_ in zip('JK', ['NSPT ≥', 'γ (kN/m³)']):
    c = S[f'{col}24']; c.value = h_; c.font = fH; c.fill = NAVY
for i, (n_, g_) in enumerate([(0, 13), (3, 15), (6, 17), (11, 19), (20, 21)]):
    S[f'J{25+i}'] = n_; S[f'K{25+i}'] = g_
# faixas da NBR 7250/6484 (≤ 2 … ≥ 20), as mesmas do NSPT ≥ da coluna J — antes "(<2)" e "(>20)", que deixavam o 2 e
# o 20 sem classe (09/10, conferido nas reproduções de Godoy 1972: TCC UFU Tab. 5 p. 16; Fabrin, UFSC 2017, Tab. 1 p. 35)
S['L25'] = 'muito mole (≤ 2)'; S['L26'] = 'mole (3–5)'; S['L27'] = 'média (6–10)'; S['L28'] = 'rija (11–19)'; S['L29'] = 'dura (≥ 20)'
S['A30'] = 'Gerscovich — solos do Rio de Janeiro'; S['A30'].font = fB
for col, h_ in zip('ABC', ['Classe', 'γ (kN/m³)', 'φ (°)']):
    c = S[f'{col}31']; c.value = h_; c.font = fH; c.fill = NAVY
ger = [('Aterro compactado (silte areno-argiloso)', '19 a 21', '32 a 42'), ('Solo residual maduro', '17 a 21', '30 a 38'),
       ('Colúvio in situ', '15 a 20', '27 a 35'), ('Areia densa', '18 a 21', '35 a 40'), ('Areia fofa', '17 a 19', '30 a 35'),
       ('Pedregulho uniforme', '18 a 21', '40 a 47'), ('Pedregulho arenoso', '19 a 21', '35 a 42'),
       ('Não se aplica', '—', '—')]       # argila (09/10): a classe não existe na tabela de Gerscovich
for i, row in enumerate(ger):
    for col, v in zip('ABC', row): S[f'{col}{32+i}'] = v
# Argila por consistência (09/10) — ao lado da de Godoy (mesmas faixas de NSPT). Referência, não conta: as sugestões das
# linhas de cima leem daqui. A fonte de cada coluna fica na linha 30 e na aba Referências.
S['N23'] = ARG_TITULO; S['N23'].font = fB
for col, h_ in zip('NOPQRS', ['NSPT ≥', 'Consistência', 'γ (kN/m³)', "c' (kPa)", "φ' (°)", 'su = 10·N (kPa)']):
    c = S[f'{col}24']; c.value = h_; c.font = fH; c.fill = NAVY; c.alignment = Alignment(horizontal='center', wrap_text=True)
for i, row in enumerate(ARG_TAB):
    for col, v in zip('NOPQRS', row):
        c = S[f'{col}{25+i}']; c.value = v; c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center')
S['N30'] = ARG_NOTA; S['N30'].font = fS
for rr in range(24, 40):
    for cc in 'ABCDEFGJKL':
        if S[f'{cc}{rr}'].font != fH and S[f'{cc}{rr}'].value is not None and rr != 31 and rr != 24:
            S[f'{cc}{rr}'].font = fN
# --- perfil (linhas 44-84) ---
# z vai do topo do SOLO à base do muro: o perfil inteiro (pressões, empuxo, Mk, Vk) é da altura de solo. A coluna M
# e a N servem à flecha no TOPO DO MURO (aba ELS), que fica acima do solo quando h muro > h solo:
#   viga em balanço engastada na base, força V a uma altura a da base (a = braço, coluna K):
#     flecha num ponto x ≥ a:  y(x) = V·a²·(3x − a)/(6·E·I)      rotação para x ≥ a:  θ = V·a²/(2·E·I) (constante)
#   todas as fatias estão abaixo do topo do solo (a ≤ h solo), então
#     y(h muro) = y(h solo) + θ·(h muro − h solo)
#   coluna M = V·a²·(3·h solo − a)/6   (flecha no nível do solo, × E·I)
#   coluna N = V·a²/2                  (rotação acima do solo, × E·I)
#   S_δ = ΣM + ΣN·(h muro − h solo)  — na aba ELS. Com h solo = h muro a parcela da rotação some e ΣM é a soma de antes.
S['A41'] = 'Perfil de pressões (40 fatias). z medido a partir do topo do solo contido, até a base do muro (h solo).'; S['A41'].font = fB
header(S, 42, ['i', 'z (m)', 'σv (kPa)', 'u (kPa)', "σ'v (kPa)", "σ'h (kPa)", 'σh (kPa)', 'Ea fatia (kN/m)', 'Ew fatia (kN/m)', 'V fatia (kN/m)', 'braço à base (m)', 'M fatia (kN·m/m)', 'V·a²(3hs−a)/6 (kN·m³/m)', 'V·a²/2 (kN·m²/m)'])
S['A43'] = 'Fórmulas: σv = q + γz; u = γw·máx(0; z − zNA) se houver água; σ\'v = σv − u; σ\'h = máx(0; Ka·σ\'v − 2c\'·√Ka); σh = σ\'h + u. Fatia: força e centroide exatos para variação linear. M e N: flecha no nível do solo e rotação (aba ELS).'
S['A43'].font = fS
for i in range(41):
    rr = 44 + i
    S[f'A{rr}'] = i
    S[f'B{rr}'] = f'=H_solo*A{rr}/40'
    S[f'C{rr}'] = f'=q_sobre+gama_solo*B{rr}'
    S[f'D{rr}'] = f'=IF(Agua="Sim",gama_w*MAX(0,B{rr}-z_NA),0)'
    S[f'E{rr}'] = f'=C{rr}-D{rr}'
    S[f'F{rr}'] = f'=MAX(0,Ka_*E{rr}-2*c_solo*SQRT(Ka_))'
    S[f'G{rr}'] = f'=F{rr}+D{rr}'
    if i < 40:
        n1 = rr + 1
        S[f'H{rr}'] = f'=(F{rr}+F{n1})/2*(B{n1}-B{rr})'
        S[f'I{rr}'] = f'=(D{rr}+D{n1})/2*(B{n1}-B{rr})'
        S[f'J{rr}'] = f'=(G{rr}+G{n1})/2*(B{n1}-B{rr})'
        S[f'K{rr}'] = f'=IF(G{rr}+G{n1}=0,0,H_solo-B{rr}-(B{n1}-B{rr})*(G{rr}+2*G{n1})/(3*(G{rr}+G{n1})))'
        S[f'L{rr}'] = f'=J{rr}*K{rr}'
        S[f'M{rr}'] = f'=J{rr}*K{rr}^2*(3*H_solo-K{rr})/6'
        S[f'N{rr}'] = f'=J{rr}*K{rr}^2/2'
    for cc in 'ABCDEFGHIJKLMN':
        c = S[f'{cc}{rr}']; c.font = fN; c.number_format = '0.000' if cc != 'A' else '0'
widths(S, {'A': 34, 'B': 14, 'C': 10, 'D': 40, 'E': 14, 'F': 9, 'G': 10, 'H': 12, 'I': 12, 'J': 12, 'K': 12, 'L': 14, 'M': 16, 'N': 12,
           'O': 14, 'P': 10, 'Q': 10, 'R': 10, 'S': 10})

# ================= MURO EM BALANÇO =================
B = wb.create_sheet('Muro em balanço', 2)
title(B, 'Muro em balanço — flexão vertical (faixa de 1 m)', 'Modelo da aula 12.1 (slide 12). Dimensionamento: manual ABCP / NBR 16868-1. Aula 12.2 vai conferir/ajustar esta aba.')
header(B, 3, ['Item', 'Valor', 'Unid.', 'Observação', 'Fonte'])
r = 4
section(B, r, 'Esforços'); r += 1
line(B, r, 'Mk (empuxo)', '=Mk_', 'kN·m/m', 'Da aba Solo e Empuxo.', 'res', '0.00', None); r += 1
line(B, r, 'Vk (empuxo)', '=Vk_', 'kN/m', '', 'res', '0.00', None); r += 1
line(B, r, 'he (altura efetiva)', '=IF(Trav_lat="Sim",MIN(alfa_v*H_muro,0.7*SQRT(alfa_v*H_muro*alfa_h*IF(Tipo_muro="Contrafortes",l_cf_adot,l_trav))),2*H_muro)', 'm', 'h = altura do muro (o balanço é o muro inteiro, não só o trecho com solo). Sem travamento lateral: he = 2h. Com travamento: mín(αv·h; 0,7·√(αv·h·αh·l)); com contrafortes, l = espaçamento adotado dos contrafortes (Jose, 12/10).', 'res', '0.00', 'he_', 'Aula 12.2 / NBR 16868-1'); r += 1
line(B, r, 'λ = he/t', '=he_/(t_bloco/100)', '', 'Não armada ≤ 24; armada ≤ 30.', 'res', '0.0', 'lambda_', 'Aula 12.2'); r += 1
line(B, r, 'Nd na base', '=gama_f*peso_ch*H_muro', 'kN/m', 'Peso próprio majorado (parede na altura do muro), com todos os furos grauteados (Entradas).', 'res', '0.00', 'Nd_'); r += 1
line(B, r, 'M2d', '=Nd_*he_^2/(3600*t_bloco/100)', 'kN·m/m', 'Nd·he²/(3600·t). A compressão de N, que ajudaria, é desprezada.', 'res', '0.000', 'M2d_', 'ABCP 3.6.3.2'); r += 1
line(B, r, 'Md', '=gama_f*Mk_+IF(M2d_on="Não",0,M2d_)', 'kN·m/m', 'γf·Mk + M2d (M2d só se "Somar M2d" = Sim nas Entradas).', 'key', '0.00', 'Md_'); r += 1
r += 1
section(B, r, 'Material'); r += 1
line(B, r, 'fpk do bloco vazado (bruto)', "=VLOOKUP(fbk_,'Referências'!$H$5:$J$16,2,FALSE)", 'MPa', 'Tab. 3.2 pelo fbk.', 'res', '0.0', 'fpk_oco', 'ABCP Tab. 3.2'); r += 1
line(B, r, 'fpk* (prisma cheio)', "=VLOOKUP(fbk_,'Referências'!$H$5:$J$16,3,FALSE)", 'MPa', '', 'res', '0.0', 'fpk_chei', 'ABCP Tab. 3.2'); r += 1
line(B, r, 'fpk da tabela (ou fpk*)', '=IF(gr_tot="Sim",fpk_chei,fpk_oco)', 'MPa', 'Área bruta (fpk* se grauteamento total).', 'res', '0.0', 'fpk_tab', 'ABCP Tab. 3.2'); r += 1
line(B, r, 'Parede do bloco (hf)', '=IF(t_bloco=19,3.5,2.7)', 'cm', '', 'res', '0.0', 'hf_bl', 'Aula (tabela de blocos)'); r += 1
line(B, r, 'Aliq/Abr', '=IF(t_bloco=19,0.54,0.57)', '', '19×39: 0,54; 14×39: 0,57.', 'res', '0.00', 'r_liq', 'Aula (tabela de blocos)'); r += 1
line(B, r, 'Em/fpk', 800, '', 'Bloco de concreto.', 'res', '0', 'Em_coef', 'Aula 12.2'); r += 1
line(B, r, 'fgk do graute', "=IF(ISNUMBER(fgk_dir),fgk_dir,VLOOKUP(fbk_,'Referências'!$H$5:$K$16,4,FALSE))", 'MPa', 'Entradas ou tabela do curso (planilha 01).', 'res', '0.0', 'fgk_', 'Planilha 01'); r += 1
line(B, r, 'Área de graute do furo', "=IFERROR(INDEX('Referências'!$O$23:$O$24,MATCH(t_bloco&\"x\"&L_bloco,'Referências'!$L$23:$L$24,0)),170)", 'cm²', '', 'res', '0', 'Ag_furo', 'Aula (tabela de blocos)'); r += 1
line(B, r, 'As,máx (fração do graute)', 0.08, '', '8% da área de graute, contando o traspasse.', 'res', '0.00', 'pAs_max', 'NBR 16868-1'); r += 1
line(B, r, 'Fator de traspasse na conta do As,máx', 2, '', 'Na região de traspasse o furo tem 2 barras.', 'res', '0', 'f_trasp'); r += 1
line(B, r, 'fpk,liq', '=IF(gr_tot="Sim",fpk_tab,fpk_tab/r_liq)', 'MPa', 'fpk ÷ Aliq/Abr (com grauteamento total a seção é cheia: fpk*).', 'res', '0.00', 'fpk_liq', 'Aula 12.2'); r += 1
line(B, r, 'fpk usado', '=IF(LEFT(fpk_ref,4)="Líqu",fpk_liq,fpk_tab)', 'MPa', 'Conforme "Área de referência do fpk" nas Entradas.', 'res', '0.00', 'fpk_', None); r += 1
line(B, r, 'fk = 0,7·fpk', '=0.7*fpk_', 'MPa', '', 'res', '0.00', 'fk_', 'ABCP 3.2'); r += 1
line(B, r, 'fd = fk/γm', '=fk_/gama_m', 'MPa', '', 'res', '0.000', 'fd_', 'ABCP 3.1'); r += 1
line(B, r, 'K (compressão na flexão)', '=IF(ISNUMBER(K_dir),K_dir,IF(gr_tot="Sim",2,1.5))', '', 'Digitado nas Entradas ou, em branco, NBR: 1,5 sem graute; 2,0 grauteado (flexão fora do plano).', 'res', '0.00', 'k_flex', 'ABCP 3.5 / planilha 04'); r += 1
line(B, r, 'ffd = k·fd', '=k_flex*fd_', 'MPa', '', 'res', '0.000', 'ffd_'); r += 1
line(B, r, 'fsd = fyd', '=fyk_/gama_s', 'MPa', 'Bloco de concreto: fsd = fyd para todo Ø.', 'res', '0.0', 'fyd_', 'NBR 16868-1'); r += 1
# FLEXÃO PELA GEOMETRIA REAL (Jose, 12/10: "o que eu quero é resistência real do negócio na conta pra faixa de 1
# metro"). A faixa comprimida fica junto da face externa. Até a profundidade hf ela está na PAREDE do bloco, que é
# contínua no metro inteiro e é concreto do bloco puro: vale a resistência do prisma vazado levada à área líquida
# (fpk/(Aliq/Abr), como a aula 12.2), com graute total ou parcial (a parede é a mesma). Passando de hf, só os FUROS
# GRAUTEADOS continuam (as almas): aí vale o prisma cheio (fpk*, ABCP tab. 3.2) na largura das almas que existem
# no metro. A escolha "área de referência" não entra mais na flexão: quem decide é a geometria. (O ELS continua com
# o fpk usado, que dá o Em.) DEDUÇÃO nossa: a alma com fpk* e a largura de alma = furo + septos (a da seção I do ELS).
line(B, r, 'fd da parede do bloco (mesa) = 0,7·fpk/(Aliq/Abr)/γm', '=0.7*fpk_oco/r_liq/gama_m', 'MPa', 'Concreto do bloco: o prisma vazado na área líquida. Vale com graute parcial ou total.', 'res', '0.000', 'fd_m', 'Aula 12.2 / NBR 16868-1 6.2.2'); r += 1
line(B, r, 'K·fd da mesa', '=k_flex*fd_m', 'MPa', '', 'res', '0.000', 'ffd_m'); r += 1
line(B, r, 'fd do furo grauteado (alma) = 0,7·fpk*/γm', '=0.7*fpk_chei/gama_m', 'MPa', 'Prisma cheio (bloco + graute). Só trabalha se a compressão passar da parede do bloco.', 'res', '0.000', 'fd_g', 'ABCP Tab. 3.2 (dedução)'); r += 1
line(B, r, 'K·fd da alma', '=k_flex*fd_g', 'MPa', '', 'res', '0.000', 'ffd_g'); r += 1
r += 1
section(B, r, 'Flexão (b = 100 cm)'); r += 1
line(B, r, 'd sugerido (barra do lado do solo)', '=t_bloco-IF(t_bloco=19,3.5,2.7)-1.5-phi_v/20', 'cm', 't − parede do bloco (3,5 no 19; 2,7 no 14) − 1,5 cm de graute − Ø/2. Só informativo; a aula 12.2 adota 14 cm no bloco de 19.', 'res', '0.00', 'd_sug', 'ABCP (cobrimento ≥ 15 mm) / aula 12.2'); r += 1
line(B, r, 'd (altura útil)', '=IF(ISNUMBER(d_dir),d_dir,t_bloco/2)', 'cm', 'd digitado nas Entradas ou, em branco, t/2 (barra no meio).', 'res', '0.00', 'd_util'); r += 1
line(B, r, 'Md/(0,5·b·d²·K·fd da mesa)', '=Md_*100/(0.5*100*d_util^2*ffd_m/10)', '', 'Compressão só na parede do bloco (b = 100). Se > 1, a mesa sozinha não resiste.', 'res', '0.000', 'arg_x'); r += 1
line(B, r, 'x com a compressão só na mesa', '=IF(arg_x<1,1.25*d_util*(1-SQRT(1-arg_x)),"não resiste")', 'cm', 'x = 1,25·d·[1 − √(1 − Md/(0,5·b·d²·K·fd))]', 'res', '0.00', 'x_r', 'ABCP 3.4'); r += 1
line(B, r, 'Compressão cabe na parede do bloco? (0,8x ≤ hf)', '=IF(ISNUMBER(x_r),IF(0.8*x_r<=hf_bl,"Sim","Não"),"Não")', '', 'Sim = só a mesa trabalha; Não = seção T: a mesa inteira + as almas grauteadas.', 'res', None, 'ln_mesa'); r += 1
line(B, r, 'Espaçamento dos furos grauteados (almas)', '=Graute', 'cm', 'A grade do graute (Entradas): as almas são os furos grauteados, a cada X, com ou sem barra.', 'res', '0', 's_web'); r += 1
line(B, r, 'Alma de cada furo grauteado (furo + septos)', '=IF(ISNUMBER(bw_dir),bw_dir,(L_bloco-3*hf_bl)/2+2*hf_bl)', 'cm', 'A mesma alma da seção I do ELS.', 'res', '0.00', 'bw_f'); r += 1
line(B, r, 'Largura das almas no metro', '=IF(gr_tot="Sim",100,MIN(100,100/s_web*bw_f))', 'cm/m', 'Todos os furos = o metro todo; senão (100/X) furos grauteados × alma.', 'res', '0.00', 'bw_m'); r += 1
line(B, r, 'Momento da mesa inteira comprimida', '=ffd_m/10*100*hf_bl*(d_util-hf_bl/2)', 'kN·cm/m', 'K·fd·b·hf·(d − hf/2).', 'res', '0.00', 'M_mesa'); r += 1
line(B, r, 'Momento que sobra para as almas', '=MAX(0,Md_*100-M_mesa)', 'kN·cm/m', '', 'res', '0.00', 'M_alma'); r += 1
line(B, r, 'Altura comprimida nas almas, abaixo da mesa', '=IF(ln_mesa="Sim",0,IFERROR((d_util-hf_bl)-SQRT((d_util-hf_bl)^2-2*M_alma/(ffd_g/10*bw_m)),"não resiste"))', 'cm', 'y = (d − hf) − √((d − hf)² − 2·M_alma/(K·fd_alma·b_alma)).', 'res', '0.00', 'y_alma'); r += 1
line(B, r, 'x', '=IF(ln_mesa="Sim",x_r,IF(ISNUMBER(y_alma),(hf_bl+y_alma)/0.8,"não resiste"))', 'cm', 'Na mesa: o de cima. Seção T: 0,8x = hf + y.', 'res', '0.00', 'x_ln', 'ABCP 3.4 / 11.3.4'); r += 1
line(B, r, 'Força de compressão C', '=IF(ln_mesa="Sim",ffd_m/10*100*0.8*x_r,IF(ISNUMBER(y_alma),ffd_m/10*100*hf_bl+ffd_g/10*bw_m*y_alma,"—"))', 'kN/m', 'Na mesa: K·fd·b·0,8x. Seção T: mesa inteira + almas.', 'res', '0.00', 'C_c'); r += 1
line(B, r, 'x/d', '=IFERROR(x_ln/d_util,"—")', '', 'Limite 0,45 (ductilidade).', 'key', '0.000', 'x_d', 'ABCP 3.4'); r += 1
line(B, r, 'z = Md/C ≤ 0,95d', '=IFERROR(MIN(Md_*100/C_c,0.95*d_util),"—")', 'cm', 'Na mesa Md/C = d − 0,4x; na seção T é o braço da resultante (mesa + almas).', 'res', '0.00', 'z_br', 'ABCP 3.4'); r += 1
line(B, r, 'εs = 0,30%·(d − x)/x ≤ 1%', '=IFERROR(MIN(1,0.3*(d_util-x_ln)/x_ln),"—")', '%', 'Deformação do aço (εc = 0,30% na borda).', 'res', '0.000', 'eps_s', 'Planilha 04 do curso / ABCP 3.4'); r += 1
line(B, r, 'σs = Es·εs ≤ fyd', '=IFERROR(MIN(210000*eps_s/100,fyd_),"—")', 'MPa', 'Es = 210 GPa. Com x/d ≤ 0,45 o aço escoa (σs = fyd).', 'res', '0.0', 'sig_s', 'Planilha 04 do curso'); r += 1
line(B, r, 'As,nec = Md/(σs·z)', '=IF(Md_<=0,0,IFERROR(Md_*100/(sig_s/10*z_br),"—"))', 'cm²/m', '', 'key', '0.00', 'As_nec', 'ABCP 3.4 / planilha 04'); r += 1
line(B, r, 'As para 1,4·Md', '=IFERROR(1.4*Md_*100/(fyd_/10*MIN(d_util-0.4*1.25*d_util*(1-SQRT(1-1.4*arg_x)),0.95*d_util)),0.001*100*t_bloco)', 'cm²/m', 'Critério que dispensa o mínimo.', 'res', '0.00', 'As_14'); r += 1
line(B, r, 'As,mín', '=IF(LEFT(AsMin_crit,5)="Curso",0.0015*100*d_util,MIN(0.001*100*t_bloco,As_14))', 'cm²/m', 'Pelo critério escolhido: NBR = mín(0,10%·b·t; As p/ 1,4·Md); Curso = 0,15%·b·d.', 'res', '0.00', 'As_min', 'ABCP 6.2 / planilha 04'); r += 1
line(B, r, 'As de cálculo', '=IF(ISNUMBER(As_nec),MAX(As_nec,As_min),"—")', 'cm²/m', '', 'key', '0.00', 'As_calc'); r += 1
line(B, r, 'Área da barra', '=PI()*phi_v^2/400', 'cm²', '', 'res', '0.000', 'As_barra'); r += 1
line(B, r, 'Espaçamento máximo pela conta', '=IFERROR(As_barra/As_calc*100,0)', 'cm', '', 'res', '0.0', 's_calc'); r += 1
# Espaçamento na grade dos furos (meio bloco m = 20 cm na família 39). Sempre PARA BAIXO: mais barra do que a conta pede, nunca menos. O digitado também
# cai na grade (decisão do Jose: a conta usa o ajustado, para o 3D desenhar o mesmo muro que a memória calcula).
# Teto do automático = 6t, NBR 16868-1 11.3.5: com armadura isolada (flexão fora do plano) a largura de alvenaria que
# cada barra arma não passa de 6t, área líquida. Até 6t a faixa de cada barra é o próprio espaçamento e a conta por
# metro desta aba vale como está (a linha neutra não depende da faixa quando b = s). Sem o teto, com coesão ou
# empuxo pequeno o automático chegava a 16 m entre barras. O digitado acima de 6t não é cortado: fica como o
# projetista pediu e a verificação "Largura por barra ≤ 6t" acusa.
line(B, r, 'Espaçamento adotado', '=IF(ISNUMBER(s_dir),ROUNDDOWN(s_dir/Graute,0)*Graute,MIN(ROUNDDOWN(s_calc/Graute,0),ROUNDDOWN(6*t_bloco/Graute,0))*Graute)', 'cm', 'Múltiplo do graute a cada X (a barra cai num furo grauteado), para baixo. Automático: o maior que atende o As de cálculo, até 6t (bloco 19: 100; bloco 14: 80). Se der 0, nem barra a cada X atende: diminuir o graute a cada ou aumentar o Ø.', 'key', '0', 's_adot'); r += 1
line(B, r, 'As efetiva', '=IF(s_adot>0,As_barra*100/s_adot,0)', 'cm²/m', '', 'res', '0.00', 'As_ef'); r += 1
r += 1
section(B, r, 'E se a barra for centralizada na obra? (d = t/2)'); r += 1
line(B, r, 'd com barra centralizada', '=t_bloco/2', 'cm', 'Costume de obra em alvenaria estrutural: barra no meio do furo.', 'res', '0.00', 'd_c'); r += 1
line(B, r, 'Md/(0,5·b·d²·K·fd da mesa)', '=Md_*100/(0.5*100*d_c^2*ffd_m/10)', '', 'Se > 1, a mesa sozinha não resiste (estimativa: não conta as almas).', 'res', '0.000', 'arg_c'); r += 1
line(B, r, 'x', '=IF(arg_c<1,1.25*d_c*(1-SQRT(1-arg_c)),"não resiste")', 'cm', '', 'res', '0.00', 'x_c'); r += 1
line(B, r, 'x/d', '=IFERROR(x_c/d_c,"—")', '', 'Limite 0,45.', 'res', '0.000', 'xd_c'); r += 1
line(B, r, 'As necessária com barra centralizada', '=IF(Md_<=0,As_min,IF(ISNUMBER(xd_c),IF(xd_c>0.45,"seção não dúctil (x/d > 0,45)",MAX(Md_*100/(MIN(210000*MIN(1,0.3*(d_c-x_c)/x_c)/100,fyd_)/10*MIN(d_c-0.4*x_c,0.95*d_c)),As_min)),"não resiste"))', 'cm²/m', 'Mesmo Md, mesmo fpk e K; só muda d. Inclui o As,mín.', 'key', '0.00', 'As_c'); r += 1
line(B, r, 'Arranjo adotado atende com barra centralizada?', '=IF(d_util<=t_bloco/2+0.01,"— (cálculo já está com a barra centralizada)",IF(AND(ISNUMBER(As_c),ISNUMBER(xd_c)),IF(AND(As_ef>=As_c-0.005,xd_c<=0.45),"SIM — o projeto tolera a barra no meio do furo","NÃO — o projeto DEPENDE da barra encostada no lado do solo: deixar explícito em planta, corte e notas"),"NÃO — com a barra no meio a seção não resiste: o projeto DEPENDE da barra encostada"))', '', 'Robustez contra o erro de obra mais comum. Se der NÃO, detalhar espaçador/gabarito e conferir antes do grauteamento.', 'key', None, 'rob_c'); r += 1
r += 1
section(B, r, 'Cisalhamento'); r += 1
line(B, r, 'τvd = γf·Vk/(b·d)', '=gama_f*Vk_/(100*d_util)*10', 'MPa', '', 'res', '0.000', 'tau_vd', 'ABCP 3.3'); r += 1
line(B, r, 'ρ = As,ef/(b·d)', '=As_ef/(100*d_util)', '', 'Limitado a 2%.', 'res', '0.0000', 'rho_v'); r += 1
line(B, r, 'fvd = (0,35 + 17,5ρ ≤ 0,7)/γm', '=MIN(0.35+17.5*MIN(rho_v,0.02),0.7)/gama_m', 'MPa', '', 'res', '0.000', 'fvd', 'ABCP 3.3 / planilha 05'); r += 1
line(B, r, 'Vsd = γf·Vk', '=gama_f*Vk_', 'kN/m', '', 'res', '0.00', 'Vsd_'); r += 1
line(B, r, 'Vrd = Va = fvd·b·d', '=fvd/10*100*d_util', 'kN/m', 'Resistência sem estribo (alvenaria).', 'res', '0.00', 'Va_', 'Planilha 05'); r += 1
line(B, r, 'Vrd2 (bielas) = Va + 0,4·√fpk/γm·b·d', '=Va_+0.4*SQRT(fpk_tab)/gama_m*100*d_util/10', 'kN/m', 'Na aula ele digitou fpk = 4,8 MPa nessa planilha (Vrd2 = 87,6 kN); aqui usa o fpk da tabela (bruto). Folga enorme nos dois casos.', 'res', '0.00', 'Vrd2_', 'Planilha 05'); r += 1
r += 1
section(B, r, 'Ancoragem na fundação'); r += 1
_lbidx = '(MATCH(fck_fund,{"C20","C25","C30"},0)-1)*2+IF(zona_ad="Boa",1,2)+1'
line(B, r, 'lb reta (tabela)', f"=IFERROR(INDEX('Referências'!$O$5:$U$12,MATCH(phi_v,'Referências'!$O$5:$O$12,0),{_lbidx}),\"Ø fora da tabela\")", 'cm', 'Pelo Ø, concreto e zona.', 'res', '0.0', 'lb_reta', 'Aula 12.2 / Araújo 2014'); r += 1
line(B, r, 'lb da tabela usada', f"=IF(gancho_=\"Sim\",IFERROR(INDEX('Referências'!$W$5:$AC$12,MATCH(phi_v,'Referências'!$W$5:$W$12,0),{_lbidx}),\"—\"),lb_reta)", 'cm', 'Com gancho ou reta, conforme Entradas.', 'res', '0.0', 'lb_tab'); r += 1
line(B, r, 'As,calc/As,ef', '=IFERROR(MIN(1,As_nec/As_ef),1)', '', 'As,calc = As do momento (não o mínimo). Sem As,ef válido, usa 1.', 'res', '0.000', 'r_anc'); r += 1
line(B, r, 'lb,nec = lb·As,calc/As,ef', '=IFERROR(lb_tab*r_anc,"—")', 'cm', '', 'res', '0.0', 'lb_nec'); r += 1
line(B, r, 'lb,mín = máx(0,3·lb; 10Ø; 10 cm)', '=IFERROR(MAX(0.3*lb_reta,phi_v,10),"—")', 'cm', 'NBR 6118 9.4.2.5 (10Ø em cm = Ø em mm).', 'res', '0.0', 'lb_min'); r += 1
line(B, r, 'Comprimento de ancoragem na fundação', '=IFERROR(CEILING(MAX(lb_nec,lb_min),1),"—")', 'cm', 'Medido a partir do topo da fundação.', 'key', '0', 'lb_adot'); r += 1
r += 1
section(B, r, 'Verificações'); r += 1
checks = [
    ('Posição da barra no projeto', '=IF(d_util>t_bloco/2+0.01,"ATENÇÃO — calculado com a barra ENCOSTADA no lado do solo (d = "&FIXED(d_util,1)&" cm). Indicar no projeto: não centralizar.","Barra centralizada (d = t/2)")', 'Ver Fig. 4'),
    ('Robustez: barra centralizada por erro de obra', '=rob_c', ''),
    ('Bloco Classe A (fbk ≥ 8 MPa)', '=IF(fbk_>=8,"OK","NÃO OK — trocar bloco")', 'Aula 12.1 slide 2'),
    ('Esbeltez λ ≤ 30', '=IF(lambda_<=30,"OK","NÃO OK")', 'ABCP 3.2'),
    ('Seção resiste (armadura simples)', '=IF(ISNUMBER(x_ln),"OK","NÃO OK — aumentar fbk, grautear ou mudar solução")', 'ABCP 3.4'),
    ('Ductilidade x/d ≤ 0,45', '=IF(ISNUMBER(x_d),IF(x_d<=0.45,"OK","NÃO OK — aumentar fbk ou grautear"),"NÃO OK")', 'ABCP 3.4'),
    ('Compressão na parede do bloco (0,8x ≤ hf)', '=IF(ln_mesa="Sim","OK — só a parede do bloco comprimida","Seção T — a compressão passa para os furos grauteados")', 'Informativo: escolhe mesa ou seção T'),
    # barra em todo furo = espaçamento igual ao meio bloco (20 cm)
    ('Seção coerente com o espaçamento', '=IF(OR(s_adot<=0,s_adot/Graute=INT(s_adot/Graute)),"OK","ATENÇÃO — barra fora da grade do graute")', ''),
    ('Armadura cabe (espaçamento ≥ graute a cada)', '=IF(s_adot>=Graute,"OK","NÃO OK — aumentar Ø ou diminuir o graute a cada")', ''),
    ('As,ef ≥ As de cálculo', '=IFERROR(IF(As_ef>=As_calc-0.005,"OK",IF(As_ef>=As_nec,"NÃO OK — abaixo do As,mín (atende o momento)","NÃO OK — abaixo do As do momento")),"—")', ''),
    ('Cisalhamento τvd ≤ fvd', '=IF(tau_vd<=fvd,"OK — dispensa estribos","NÃO OK")', 'ABCP 3.3 / planilha 05'),
    ('Bielas Vsd ≤ Vrd2', '=IF(Vsd_<=Vrd2_,"OK","NÃO OK — aumentar seção")', 'Planilha 05'),
    ('Painel entre barras', '=res_pan', 'Aba Painel não armado'),
    ('ELS (fissuração/deslocamento)', '=res_els', 'Aba ELS'),
    # no fim da lista de propósito: linhas acima têm endereço lido pelo app (memória de cálculo)
    ('Largura por barra ≤ 6t', '=IF(s_adot<=6*t_bloco,"OK","NÃO OK — espaçamento > 6t: a faixa de cada barra passa do limite")', 'NBR 16868-1 11.3.5'),
]
# Nome nas linhas que a memória do app lê (antes por endereço, B77…B89: a flexão pela geometria real, 12/10,
# acrescentou linhas acima e mudaria todos de lugar).
NOME_CHK_B = {'Bloco Classe A (fbk ≥ 8 MPa)': 'chk_classeA', 'Esbeltez λ ≤ 30': 'chk_esb',
              'Seção resiste (armadura simples)': 'chk_resiste', 'Ductilidade x/d ≤ 0,45': 'chk_ductil',
              'Compressão na parede do bloco (0,8x ≤ hf)': 'chk_mesa', 'Seção coerente com o espaçamento': 'chk_coerente',
              'Armadura cabe (espaçamento ≥ graute a cada)': 'chk_cabe', 'As,ef ≥ As de cálculo': 'chk_As',
              'Cisalhamento τvd ≤ fvd': 'chk_tau', 'Bielas Vsd ≤ Vrd2': 'chk_bielas', 'Largura por barra ≤ 6t': 'chk_6t'}
for lab, f, src in checks:
    line(B, r, lab, f, '', '', 'key', None, NOME_CHK_B.get(lab), src); r += 1
r += 1
B.cell(row=r, column=1, value='Escolha do arranjo de barras: aba Arranjos. Painel entre barras: aba Painel não armado. Fissuração e flecha: aba ELS.').font = fS
widths(B, {'A': 36, 'B': 44, 'C': 9, 'D': 60, 'E': 16})

# ================= ARRANJOS =================
A_ = wb.create_sheet('Arranjos', 3)
RM = "'Referências'!$M$5:$M$10"; RL = "'Referências'!$L$5:$L$10"
title(A_, 'Arranjos de armadura — como na aula 12.2',
      'Um furo armado a cada bm (múltiplos do meio bloco m). A linha neutra x não depende de bm, então As cresce proporcional a bm. Faixa acima de 6t não vale (NBR 16868-1 11.3.5).')
hdr = ['bm (cm)', 'Md da faixa (kN·cm)', 'As calc. (cm²)', 'As,mín (cm²)', 'As a adotar (cm²)', 'Ø sugerido (mm)', 'As do Ø (cm²)', 'As/m resultante (cm²/m)', 'Ø das Entradas atende?', 'bm ≤ 6t?', 'Na grade do graute?']
header(A_, 4, hdr)
A_.row_dimensions[4].height = 42
# Faixas na grade dos furos: m, 2m … 6m (20…120, como na aula 12.2). A coluna J marca a faixa maior que 6t: com armadura isolada
# a NBR não deixa cada barra armar mais que 6t (bloco 19: 114 cm; bloco 14: 84 cm).
for i in range(6):
    rr = 5 + i
    A_[f'A{rr}'] = f'=m_mod*{i + 1}'; A_[f'A{rr}'].fill = RES; A_[f'A{rr}'].font = fN
    A_[f'J{rr}'] = f'=IF(A{rr}<=6*t_bloco,"OK","não (> 6t)")'
    # a barra só cai num furo grauteado: a faixa tem de ser múltiplo do graute a cada X (Jose, 13/10). As faixas
    # continuam as da aula (m, 2m … 6m); a coluna só marca quais a lista do espaçamento aceita
    A_[f'K{rr}'] = f'=IF(A{rr}/Graute=INT(A{rr}/Graute),"sim","não (fora da grade)")'
    A_[f'B{rr}'] = f'=Md_*A{rr}'
    A_[f'C{rr}'] = f'=IF(ISNUMBER(As_nec),As_nec*A{rr}/100,"não resiste")'
    A_[f'D{rr}'] = f'=As_min*A{rr}/100'
    A_[f'E{rr}'] = f'=IF(ISNUMBER(C{rr}),MAX(C{rr},D{rr}),"—")'
    A_[f'F{rr}'] = (f'=IF(ISNUMBER(E{rr}),IF(SUMPRODUCT(({RM}<E{rr}-0.0005)*1)>=6,"> Ø20",'
                    f'INDEX({RL},SUMPRODUCT(({RM}<E{rr}-0.0005)*1)+1)),"—")')
    A_[f'G{rr}'] = f'=IFERROR(INDEX({RM},MATCH(F{rr},{RL},0)),"—")'
    A_[f'H{rr}'] = f'=IFERROR(G{rr}*100/A{rr},"—")'
    A_[f'I{rr}'] = f'=IF(ISNUMBER(E{rr}),IF(PI()*phi_v^2/400>=E{rr}-0.0005,"OK","não"),"—")'
    for cc, fm in zip('ABCDEFGHIJK', ['0', '0', '0.00', '0.00', '0.00', '0.0', '0.000', '0.00', None, None, None]):
        c = A_[f'{cc}{rr}']; c.border = BOX; c.alignment = Alignment(horizontal='center')
        c.font = fN; c.fill = RES
        if fm: c.number_format = fm
A_['A12'] = 'Parâmetros em uso (da aba Muro em balanço):'; A_['A12'].font = fB
params = [('Md (kN·m/m)', '=Md_', '0.00'), ('d (cm)', '=d_util', '0.00'), ('K', '=k_flex', '0.00'), ('fpk usado (MPa)', '=fpk_', '0.0'),
          ('K·fd (MPa)', '=ffd_', '0.000'), ('x/d', '=x_d', '0.000'), ('As,mín: critério', '=AsMin_crit', None), ('Ø das Entradas (mm)', '=phi_v', '0.0')]
for i, (lab, f, fm) in enumerate(params):
    rr = 13 + i
    A_[f'A{rr}'] = lab; A_[f'A{rr}'].font = fN; A_[f'A{rr}'].border = BOX
    A_[f'C{rr}'] = f; A_[f'C{rr}'].font = fN; A_[f'C{rr}'].fill = RES; A_[f'C{rr}'].border = BOX
    A_[f'C{rr}'].alignment = Alignment(horizontal='center')
    A_.merge_cells(f'A{rr}:B{rr}')
    if fm: A_[f'C{rr}'].number_format = fm
notes = [
    'Conferência com a aula 12.2 (resultado do professor: 0,30 / 0,61 / 0,91 / 1,22 cm² para bm = 20 / 40 / 60 / 80; adotou Ø10 c/40):',
    'Entradas: h = 1,6 m; t = 19 (19×39); Ka direto = 0,4; γ = 19; q = 2 kPa; c = 0; sem água; fbk = 8; Seção = Parcial (só onde tem barra); fpk líquido (6/0,54 = 11,1); d = 14; K = 1; As,mín = Curso; Somar M2d = Não; Somar σsg = Não; peso da parede 3,0 kN/m².',
    'Tudo medido nos prints da aula: d = 14 (barra a 5 cm da face do solo), fpk = 11,1 MPa (líquido, 6/0,54) e K = 1,0 na planilha 04 (Kfd = 0,389 kN/cm²). Resultado aqui: 0,304 / 0,608 / 0,913 / 1,217 → 0,30 / 0,61 / 0,91 / 1,22 como no caderno dele.',
    'Observação: com o critério do curso (0,15%·b·d), Ø10 c/40 dá 0,785 cm² < 0,84 cm² de As,mín da faixa. Pelo critério da NBR (0,10%·b·t = 0,76 cm² na faixa de 40) passa.',
]
for i, t_ in enumerate(notes):
    c = A_[f'A{22+i}']; c.value = t_; c.font = fB if i == 0 else fS
widths(A_, {'A': 12, 'B': 14, 'C': 14, 'D': 13, 'E': 14, 'F': 13, 'G': 12, 'H': 15, 'I': 15, 'J': 12})

# ================= PAINEL NÃO ARMADO =================
P = wb.create_sheet('Painel não armado', 4)
title(P, 'Painel entre barras e canaletas — alvenaria não armada (aula 12.2)', 'Painel l × h entre barras verticais (l = espaçamento adotado) e canaletas (h). Pior caso = painel de baixo, com a carga média do trapézio.')
header(P, 3, ['Item', 'Valor', 'Unid.', 'Observação', 'Fonte'])
r = 4
section(P, r, 'Geometria e carga'); r += 1
line(P, r, 'l (largura do painel)', '=s_adot/100', 'm', 'Espaçamento adotado das barras verticais.', 'res', '0.00', 'l_pan'); r += 1
# O painel é geometria do MURO (não passa do topo do muro); a carga é do SOLO. z_pan é profundidade a partir do topo
# do solo, e o índice no perfil de 40 fatias é z/h solo (o perfil cobre a altura de solo). Painel de baixo mais alto
# que o solo (h solo < espaçamento das canaletas): z = 0 e o painel inteiro leva o trapézio σh,topo do solo → σh,base,
# embora acima do solo não haja carga — DEDUÇÃO nossa, a favor da segurança (carga maior que a real em todo ponto).
line(P, r, 'h (altura do painel)', '=MIN(h_pan,H_muro)', 'm', 'Espaçamento das canaletas (no máximo a altura do muro).', 'res', '0.00', 'hp_'); r += 1
line(P, r, 't', '=t_bloco/100', 'm', '', 'res', '0.00', 't_pan'); r += 1
line(P, r, 'h/l', '=IFERROR(hp_/l_pan,"—")', '', 'Entra na tabela do βf.', 'res', '0.00', None); r += 1
line(P, r, 'z do topo do painel de baixo', '=MAX(0,H_solo-hp_)', 'm', 'Medido a partir do topo do solo. 0 se o painel passa do solo (trapézio do solo no painel inteiro: a favor da segurança).', 'res', '0.00', 'z_pan'); r += 1
_k = 'INT(z_pan/H_solo*40)'
line(P, r, 'σh no topo do painel', f"=INDEX('Solo e Empuxo'!$G$44:$G$84,{_k}+1)+(z_pan/H_solo*40-{_k})*(INDEX('Solo e Empuxo'!$G$44:$G$84,MIN({_k}+2,41))-INDEX('Solo e Empuxo'!$G$44:$G$84,{_k}+1))", 'kPa', 'Interpolado no perfil da aba Solo e Empuxo.', 'res', '0.00', 'sp_top'); r += 1
line(P, r, 'σh na base', '=sh_base', 'kPa', '', 'res', '0.00', 'sp_base'); r += 1
line(P, r, 'σh médio', '=(sp_top+sp_base)/2', 'kPa', 'Aula: 6,88 → 12,96, média 9,92.', 'res', '0.00', 'sp_med'); r += 1
line(P, r, 'fd = γf·σh médio', '=gama_f*sp_med', 'kN/m²', 'Aula: 13,89.', 'key', '0.00', 'fd_pan'); r += 1
r += 1
section(P, r, 'Flexão (tração na flexão)'); r += 1
line(P, r, 'ftk ⊥ fiada', "=INDEX('Referências'!$M$16:$M$18,MATCH(arg_cls,'Referências'!$L$16:$L$18,0))", 'MPa', 'Tração normal à fiada (fissura horizontal).', 'res', '0.00', 'ftk_nor', 'NBR 16868-1 Tab. 3'); r += 1
line(P, r, 'ftk ∥ fiada', "=INDEX('Referências'!$N$16:$N$18,MATCH(arg_cls,'Referências'!$L$16:$L$18,0))", 'MPa', 'Tração paralela à fiada (fissura vertical).', 'res', '0.00', 'ftk_par', 'NBR 16868-1 Tab. 3'); r += 1
line(P, r, 'μ = ftk⊥/ftk∥', '=ftk_nor/ftk_par', '', 'Coeficiente de ortogonalidade (aula: 0,50).', 'res', '0.00', 'mu_pan'); r += 1
_T = 'CHOOSE(MATCH(caso_pan,{13,18,11},0),tabela_13,tabela_18,tabela_11)'
line(P, r, 'h/l (limitado a 0,3–3,0)', '=MIN(3,MAX(0.3,hp_/l_pan))', '', 'Faixa da tabela.', 'res', '0.000', 'hl_p'); r += 1
line(P, r, 'μ (limitado a 0,3–1,0)', '=MIN(1,MAX(0.3,mu_pan))', '', '', 'res', '0.000', 'mu_p'); r += 1
line(P, r, 'coluna j (h/l inferior)', '=MATCH(hl_p,hl_row,1)', '', '', 'res', '0', 'jp'); r += 1
line(P, r, 'linha i (μ superior)', '=MATCH(mu_p,mu_col,-1)', '', 'Tabela em μ decrescente.', 'res', '0', 'ip'); r += 1
line(P, r, 'tx (interp. em h/l)', '=IF(jp>=11,0,(hl_p-INDEX(hl_row,jp))/(INDEX(hl_row,jp+1)-INDEX(hl_row,jp)))', '', '', 'res', '0.000', 'txp'); r += 1
line(P, r, 'ty (interp. em μ)', '=IF(ip>=9,0,(INDEX(mu_col,ip)-mu_p)/(INDEX(mu_col,ip)-INDEX(mu_col,ip+1)))', '', '', 'res', '0.000', 'typ'); r += 1
line(P, r, 'βf da tabela', f'=(1-typ)*((1-txp)*INDEX({_T},ip,jp)+txp*INDEX({_T},ip,MIN(11,jp+1)))+typ*((1-txp)*INDEX({_T},MIN(9,ip+1),jp)+txp*INDEX({_T},MIN(9,ip+1),MIN(11,jp+1)))', '', 'Interpolação linear em h/l e μ (a planilha do curso faz o mesmo). Aula: caso 13, h/l 2, μ 0,5 → 0,118.', 'res', '0.0000', 'beta_tab', 'Planilha 11 (Ábacos NBR)'); r += 1
line(P, r, 'βf usado', '=IF(ISNUMBER(beta_dir),beta_dir,beta_tab)', '', 'Manual (Entradas) ou da tabela.', 'key', '0.0000', 'beta_f'); r += 1
line(P, r, 'Limite de área (coef. × t²)', '=IF(caso_pan=13,2025,1350)', '', 'Planilha 11: 2025·t² no caso 13; 1350·t² nos outros.', 'res', '0', 'coef_area', 'Planilha 11'); r += 1
line(P, r, 'Md,par = βf·fd·l²', '=beta_f*fd_pan*l_pan^2', 'kN·m/m', '×100 = kN·cm/m (aula: 26,2 kN·cm/m).', 'res', '0.0000', 'Mpar'); r += 1
line(P, r, 'Md,nor = μ·Md,par', '=mu_pan*Mpar', 'kN·m/m', 'Aula: 13,1 kN·cm/m.', 'res', '0.0000', 'Mnor'); r += 1
line(P, r, 'W = t²/6 (seção bruta, por metro)', '=t_pan^2/6', 'm³/m', '', 'res', '0.000000', 'W_pan'); r += 1
line(P, r, 'σtd,par = Md,par/W', '=Mpar/W_pan/1000', 'MPa', 'Aula: 0,004 kN/cm² = 0,04 MPa.', 'res', '0.0000', 'st_par'); r += 1
line(P, r, 'ftd,par = ftk∥/γm', '=ftk_par/gama_m', 'MPa', 'Aula: 0,02 kN/cm².', 'res', '0.000', 'ftd_par'); r += 1
line(P, r, 'σtd,nor = Md,nor/W', '=Mnor/W_pan/1000', 'MPa', 'Aula: 0,002 kN/cm².', 'res', '0.0000', 'st_nor'); r += 1
line(P, r, 'ftd,nor = ftk⊥/γm', '=ftk_nor/gama_m', 'MPa', 'Aula: 0,01 kN/cm².', 'res', '0.000', 'ftd_nor'); r += 1
r += 1
section(P, r, 'Cisalhamento no painel'); r += 1
line(P, r, 'Vsd = fd·l/2', '=fd_pan*l_pan/2', 'kN/m', 'Hipótese nossa (faixa horizontal biapoiada nas barras). Trocar se o print mostrar outro Vsd.', 'res', '0.000', 'V_pan'); r += 1
line(P, r, 'τvd = Vsd/(b·t)', '=V_pan/t_pan/1000', 'MPa', 'b = 1 m, seção bruta (planilha 05).', 'res', '0.0000', 'tau_pan', 'Planilha 05'); r += 1
line(P, r, 'fvd = (fvk0 + 0,5σ ≤ máx)/γm', "=MIN(INDEX('Referências'!$O$16:$O$18,MATCH(arg_cls,'Referências'!$L$16:$L$18,0))+0.5*sig_pan,INDEX('Referências'!$P$16:$P$18,MATCH(arg_cls,'Referências'!$L$16:$L$18,0)))/gama_m", 'MPa', '', 'res', '0.000', 'fvd_pan', 'Planilha 05'); r += 1
r += 1
section(P, r, 'Verificações'); r += 1
line(P, r, 'Resumo', '=IF(AND(st_par<=ftd_par,st_nor<=ftd_nor,tau_pan<=fvd_pan,MAX(l_pan,hp_)<=50*t_pan,l_pan*hp_<=coef_area*t_pan^2),"OK","NÃO OK")', '', 'Usado na aba Muro em balanço.', 'key', None, 'res_pan'); r += 1
for lab, f in [('σtd,par ≤ ftd,par', '=IF(st_par<=ftd_par,"OK ("&TEXT(st_par/ftd_par,"0%")&")","NÃO OK")'),
               ('σtd,nor ≤ ftd,nor', '=IF(st_nor<=ftd_nor,"OK ("&TEXT(st_nor/ftd_nor,"0%")&")","NÃO OK")'),
               ('τvd ≤ fvd', '=IF(tau_pan<=fvd_pan,"OK ("&TEXT(tau_pan/fvd_pan,"0%")&")","NÃO OK")'),
               ('l e h ≤ 50·t', '=IF(MAX(l_pan,hp_)<=50*t_pan,"OK (máx "&FIXED(50*t_pan,2)&" m)","NÃO OK")'),
               ('h·l ≤ coef·t²', '=IF(l_pan*hp_<=coef_area*t_pan^2,"OK (máx "&FIXED(coef_area*t_pan^2,1)&" m²)","NÃO OK")')]:
    line(P, r, lab, f, '', '', 'key', None, None); r += 1
r += 1
P.cell(row=r, column=1, value='Conferência com a aula 12.2 (mesmas entradas do exemplo): βf 0,118; Md,par 26,2 e Md,nor 13,1 kN·cm/m; σtd,par 0,004 < 0,02 e σtd,nor 0,002 < 0,01 kN/cm² — OK. O βf sai da tabela do caso (planilha 11 do curso), interpolado em h/l e μ.').font = fS
widths(P, {'A': 36, 'B': 22, 'C': 9, 'D': 70, 'E': 16})

# ================= ELS =================
L_ = wb.create_sheet('ELS', 5)
title(L_, 'ELS — fissuração e deslocamento do balanço (aula 12.2 + planilha 06_Vigas_ELS, aba I)', 'Por faixa bm (uma barra por faixa), seção I: mesas = paredes do bloco, alma = furo grauteado + septos.')
header(L_, 3, ['Item', 'Valor', 'Unid.', 'Observação', 'Fonte'])
r = 4
section(L_, r, 'Seção da faixa'); r += 1
line(L_, r, 'Tipo de seção', '=IF(gr_tot="Sim","Retangular cheia (bm × h)",IF(n_alm>1,"Seção I ("&n_alm&" almas: furos grauteados da faixa + septos)","Seção I (alma = furo grauteado + septos)"))', '', 'Conforme o graute a cada X nas Entradas.', 'key', None, None); r += 1
line(L_, r, 'bm (largura da faixa)', '=s_adot', 'cm', 'Espaçamento adotado das barras.', 'res', '0.0', 'bm_els'); r += 1
line(L_, r, 'Furos grauteados na faixa', '=MAX(1,INT(bm_els/Graute+0.5))', '', 'Faixa de uma barra (bm = s, múltiplo do graute a cada X): s/X furos grauteados, cada um uma alma.', 'res', '0', 'n_alm'); r += 1
line(L_, r, 'bw (alma)', '=IF(gr_tot="Sim",bm_els,MIN(bm_els,n_alm*IF(ISNUMBER(bw_dir),bw_dir,(L_bloco-3*hf_bl)/2+2*hf_bl)))', 'cm', 'Aula: 21,25 (19×39). Uma alma por furo grauteado da faixa (s/X). Todos os furos → seção cheia.', 'res', '0.00', 'bw_els', 'Aula 12.2'); r += 1
line(L_, r, 'hf (parede do bloco)', '=hf_bl', 'cm', '', 'res', '0.0', None); r += 1
line(L_, r, 'h = t', '=t_bloco', 'cm', '', 'res', '0.0', None); r += 1
line(L_, r, 'd', '=d_util', 'cm', '', 'res', '0.0', None); r += 1
line(L_, r, 'As1 (uma barra)', '=As_barra', 'cm²', "As2 = 0 (sem armadura comprimida → ρ' = 0).", 'res', '0.000', None); r += 1
r += 1
section(L_, r, 'Momentos e módulos'); r += 1
line(L_, r, 'Ma = (Ma/Mk)·Mk·bm', '=psi_els*Mk_*bm_els', 'kN·cm', 'Momento no engaste na faixa. Aula: 6,22·0,4 = 248,8 kN·cm.', 'key', '0.0', 'Ma_', 'Aula 12.2'); r += 1
line(L_, r, 'Em = (Em/fpk)·fpk usado', '=Em_coef*fpk_', 'MPa', 'Aula: 800·11,1 = 8889 MPa (fpk líquido).', 'res', '0', 'Em_', 'Aula 12.2'); r += 1
line(L_, r, 'n = Es/Em', '=210000/Em_', '', 'Aula: 23,62.', 'res', '0.00', 'n_els'); r += 1
line(L_, r, 'ftk ⊥ fiada', '=ftk_nor', 'MPa', 'Fissura horizontal na base.', 'res', '0.00', None, 'NBR 16868-1 Tab. 3'); r += 1
line(L_, r, 'σsg = 0,9·Psg/Ae', '=IF(sg_on="Sim",0.9*peso_us*H_muro/(t_bloco/100)/1000,0)', 'MPa', 'Só se "Somar σsg" = Sim (padrão; a aula não soma). Peso da parede (usado) na altura do muro.', 'res', '0.0000', 'sig_sg'); r += 1
line(L_, r, 'Im = bm·h³/12 − (bm − bw)·(h − 2hf)³/12', '=bm_els*t_bloco^3/12-(bm_els-bw_els)*(t_bloco-2*hf_bl)^3/12', 'cm⁴', 'Aula: 20.163 cm⁴.', 'res', '0', 'Im_', 'Planilha 06 (aba I)'); r += 1
line(L_, r, 'Mr = (ftk + σsg)·Im/yt', '=(ftk_nor+sig_sg)/10*Im_/(t_bloco/2)', 'kN·cm', 'yt = h/2 (seção simétrica). Aula: 42,45 kN·cm.', 'key', '0.0', 'Mr_', 'Slide momento de fissuração'); r += 1
r += 1
section(L_, r, 'Estádio II'); r += 1
line(L_, r, 'x supondo LN na mesa (b = bm)', '=(-n_els*As_barra+SQRT((n_els*As_barra)^2+2*bm_els*n_els*As_barra*d_util))/bm_els', 'cm', 'bm·x²/2 − n·As·(d − x) = 0. Aula: 3,17 cm.', 'res', '0.00', 'x_rect'); r += 1
line(L_, r, 'x supondo LN na alma (T)', '=(-((bm_els-bw_els)*hf_bl+n_els*As_barra)+SQRT(((bm_els-bw_els)*hf_bl+n_els*As_barra)^2+2*bw_els*((bm_els-bw_els)*hf_bl^2/2+n_els*As_barra*d_util)))/bw_els', 'cm', 'bw·x²/2 + (bm − bw)·hf·(x − hf/2) − n·As·(d − x) = 0.', 'res', '0.00', 'x_T'); r += 1
line(L_, r, 'x adotado', '=IF(x_rect<=hf_bl,x_rect,x_T)', 'cm', 'Se x ≤ hf vale a hipótese da mesa (caso da aula).', 'key', '0.00', 'xII'); r += 1
line(L_, r, 'III', '=IF(x_rect<=hf_bl,bm_els*xII^3/3+n_els*As_barra*(d_util-xII)^2,bw_els*xII^3/3+(bm_els-bw_els)*hf_bl^3/12+(bm_els-bw_els)*hf_bl*(xII-hf_bl/2)^2+n_els*As_barra*(d_util-xII)^2)', 'cm⁴', 'Aula: 2.600 cm⁴.', 'res', '0', 'III_', 'Planilha 06 (aba I)'); r += 1
line(L_, r, '(Mr/Ma)³', '=IF(Ma_>0,MIN(1,Mr_/Ma_)^3,1)', '', '', 'res', '0.00000', 'br_3'); r += 1
line(L_, r, 'Ieq (Branson) ≤ Im', '=IF(Ma_<=Mr_,Im_,MIN(Im_,br_3*Im_+(1-br_3)*III_))', 'cm⁴', 'Aula: 2.687 cm⁴.', 'key', '0', 'Ieq_', 'Branson (1965)'); r += 1
line(L_, r, 'heq (retângulo bm × heq, para o Ftool)', '=(12*Ieq_/bm_els)^(1/3)', 'cm', 'Aula: 40 × 9,3 com E = 8889 MPa.', 'res', '0.00', 'heq_'); r += 1
line(L_, r, 'σs = n·Ma·(d − x)/III', '=n_els*Ma_*(d_util-xII)/III_', 'kN/cm²', 'Tensão no aço em serviço. Aula: 24,49 kN/cm².', 'res', '0.00', 'sig_s_els', 'Planilha 06'); r += 1
r += 1
section(L_, r, 'Deslocamento no topo'); r += 1
# Flecha no TOPO DO MURO com carga só até o topo do solo (dedução na aba Solo e Empuxo, perfil): flecha no nível do
# solo (ΣM) + rotação (ΣN) × trecho de muro acima do solo. Com h solo = h muro o 2º termo é zero e fica a soma de antes.
line(L_, r, 'S = Σ V·a²(3hs − a)/6 + Σ V·a²/2·(hm − hs)', "=SUM('Solo e Empuxo'!M44:M83)+SUM('Solo e Empuxo'!N44:N83)*(H_muro-H_solo)", 'kN·m³/m', 'Carga real do perfil (mesmo resultado do Ftool com 0,32 → 5,18 kN/m). Flecha no nível do solo + rotação × trecho de muro acima do solo.', 'res', '0.0000', 'sum_d'); r += 1
line(L_, r, 'δ0 = (Ma/Mk)·Σ·bm/(Em·Ieq)', '=psi_els*sum_d*bm_els/100/(Em_*1000*Ieq_/100000000)*1000', 'mm', 'Flecha imediata no topo.', 'key', '0.00', 'delta0'); r += 1
line(L_, r, "αf = Δξ/(1 + 50ρ'), ρ' = 0", '=dxi/(1+50*0)', '', 'Sem armadura comprimida.', 'res', '0.00', 'alfa_f', 'Slide flecha final (NBR 16868-1)'); r += 1
line(L_, r, 'δ∞ = δ0·(1 + αf)', '=delta0*(1+alfa_f)', 'mm', 'Flecha final.', 'key', '0.00', 'delta_'); r += 1
line(L_, r, 'δadm = vão/limite', '=IF(vao_ref="2h",2,1)*H_muro*1000/div_adm', 'mm', 'Aula 12.2: 2L/250 no balanço (L = altura do muro: a flecha é a do topo do muro).', 'res', '0.00', 'dadm_'); r += 1
r += 1
section(L_, r, 'Verificações'); r += 1
line(L_, r, 'Resumo', '=IF(delta_<=dadm_,IF(Ma_<=Mr_,"OK — não fissura","OK — fissura na base, δ ok"),"NÃO OK — δ∞ > δadm")', '', 'Usado na aba Muro em balanço.', 'key', None, 'res_els'); r += 1
line(L_, r, 'Fissuração na base', '=IF(Ma_<=Mr_,"Estádio I — não fissura","Estádio II — fissura (Ma/Mr = "&FIXED(Ma_/Mr_,1)&")")', '', '', 'key', None, None); r += 1
line(L_, r, 'δ∞ ≤ δadm', '=IF(delta_<=dadm_,"OK ("&TEXT(delta_/dadm_,"0%")&")","NÃO OK ("&TEXT(delta_/dadm_,"0%")&")")', '', '', 'key', None, None); r += 1
r += 1
L_.cell(row=r, column=1, value='Limite confirmado na aula: 2L/250 = 12,8 mm. Pendente: se ele compara o limite com a flecha final (δ∞ = 2·δ0) ou com a imediata.').font = fS
widths(L_, {'A': 40, 'B': 22, 'C': 9, 'D': 70, 'E': 22})

# ================= CONTRAFORTES (aula 12.3) =================
import os as _os_cf
from openpyxl.utils import get_column_letter as _gl
exec(open(_os_cf.path.join(_os_cf.path.dirname(_os_cf.path.abspath(__file__)), 'contrafortes.py'), encoding='utf8').read())
exec(open(_os_cf.path.join(_os_cf.path.dirname(_os_cf.path.abspath(__file__)), 'fundacao.py'), encoding='utf8').read())
exec(open(_os_cf.path.join(_os_cf.path.dirname(_os_cf.path.abspath(__file__)), 'sapata_molas.py'), encoding='utf8').read())

# ---- Referências: duas alturas e argila (09/10) — abaixo das tabelas de Libânio (linha 150 é a nota delas) ----
REF3 = [
    ('Duas alturas: solo e muro', 'Pedido do Jose (09/10)', 'h solo ≤ h muro. Empuxo, pressões, Mk, Vk, solo do talão e subpressão: h solo. Peso da parede e do contraforte, esbeltez (he), painel, flecha no topo, δadm e limites do app: h muro. Com h solo = h muro tudo dá o número de antes.'),
    ('Flecha no topo com solo abaixo do topo', 'Dedução (resistência dos materiais)', 'Balanço com força V a uma altura a ≤ h solo: y(x) = V·a²(3x − a)/(6EI) para x ≥ a, rotação V·a²/(2EI) constante. y(h muro) = y(h solo) + θ·(h muro − h solo) → S = Σ V·a²(3hs − a)/6 + Σ V·a²/2·(hm − hs) (Solo e Empuxo, colunas M e N; aba ELS).'),
    ('Painel (Libânio) com solo abaixo do topo', 'Dedução, a favor da segurança', 'Placa com h = h muro (topo livre no topo do muro); triângulo de 0 no topo do muro a σh,base − σh,topo na base + uniforme σh,topo na altura toda. Em todo ponto ≥ a pressão real (acima do solo a real é zero).'),
    ('Painel não armado com solo abaixo', 'Dedução, a favor da segurança', 'Painel de baixo mais alto que o solo: z = 0 e o trapézio σh,topo → σh,base do solo vale no painel inteiro.'),
] + ARG_REFS
R['A152'] = 'Duas alturas (solo e muro) e argila — 09/10'; R['A152'].font = fB
header(R, 153, ['Item', 'Fonte', 'O que diz / como foi usado'])
for i, (a, b, c_) in enumerate(REF3):
    for col, v in zip('ABC', (a, b, c_)):
        cell = R[f'{col}{154 + i}']; cell.value = v; cell.font = fN; cell.border = BOX
        cell.alignment = Alignment(wrap_text=True, vertical='top')


# ================= ILUSTRAÇÕES =================
import os as _os
from openpyxl.drawing.image import Image as _XLImg
FIGDIR = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'figs')
FIGS = [
    (1, 'fig01_geral', 'Muro de arrimo em balanço: visão geral e entradas'),
    (2, 'fig02_bloco', 'Blocos de concreto: dimensões usadas na planilha'),
    (3, 'fig03_secao', 'Seção / grauteamento: seção I ou seção cheia'),
    (4, 'fig04_barra', 'POSIÇÃO DA BARRA: encostada do lado do solo — não centralizar'),
    (5, 'fig05_elevacao', 'Elevação: barras verticais, canaletas e painel não armado'),
    (6, 'fig06_casos', 'Casos de vinculação do painel não armado'),
    (7, 'fig07_he', 'Altura efetiva (he) e esbeltez'),
    (8, 'fig08_tracao', 'Tração na flexão: direção em relação à fiada'),
    (9, 'fig09_ancoragem', 'Ancoragem da espera na fundação'),
    (10, 'fig10_els', 'ELS do balanço: fissuração e flecha'),
    (11, 'fig11_pressoes', 'Pressões: sem coesão, com coesão e com água'),
    (12, 'fig12_contraforte', 'Contraforte em planta: enterrado (seção T) ou aparente (retangular)'),
    (13, 'fig13_painel', 'Painel entre contrafortes: vinculação, cargas, armaduras e charneiras'),
    (14, 'fig14_barras_painel', 'PAINEL: uma barra vertical em CADA face; horizontal centralizada'),
    (15, 'fig15_sapata', 'Sapata corrida: posição, forças, tombamento e deslizamento'),
    (24, 'fig24_tomb_desl', 'Sapata corrida: tombamento e deslizamento (traço do Bastos, Fig. 1.116)'),
]
# Mapa entrada → figura: a fonte única é dados/figuras.json, o mesmo arquivo que o app lê (app/src/figuras/mapa.ts).
# Antes havia uma cópia aqui e outra no app, e elas já divergiam (ex.: Ka_dir na Fig. 1 aqui e na Fig. 11 no app).
# Assim a coluna E das Entradas mostra a MESMA figura que o botão do app abre.
import json as _json_fig
_FIGJ = _json_fig.load(open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', 'dados', 'figuras.json'), encoding='utf8'))
_FIG_NUM = {f['id']: f['numero'] for f in _FIGJ['figuras']}
FIG_OF = {nm: _FIG_NUM[lig['figura']] for nm, lig in _FIGJ['entradas'].items()}
# As 15 figuras da planilha (PNG em figs/) têm de ser as mesmas que o figuras.json diz ("planilha": nome do arquivo).
_fig_planilha = {(f['numero'], f['planilha']) for f in _FIGJ['figuras'] if f.get('planilha')}
assert _fig_planilha == {(n, fn) for n, fn, _ in FIGS}, 'figuras.json e a lista FIGS do gerador divergem'
# As outras (16 em diante) só existem no app (SVG de figs/app/gerar.py): a planilha lista no índice, sem imagem. O PDF
# de ilustrações (figs/make_pdf.py) fica com as 15 da planilha, como antes.
FIGS_APP = [(f['numero'], f['titulo']) for f in _FIGJ['figuras'] if not f.get('planilha')]
IL = wb.create_sheet('Ilustrações')
title(IL, 'Ilustrações', 'Índice abaixo; clique no nome para ir à figura. Os originais em SVG (vetor) ficam na pasta de figuras, para reaproveitar no app.')
header(IL, 3, ['Fig.', 'Título', 'Campos das Entradas'])
fig_row = {}
r_idx_app = 4 + len(FIGS)
r_img = r_idx_app + len(FIGS_APP) + 3
for i, (n, fn, tit) in enumerate(FIGS):
    # só nomes da planilha: o figuras.json também mapeia entradas que só o app tem (comprimento, drenagem…)
    campos = ', '.join(sorted({k for k, v in FIG_OF.items() if v == n and k in wb.defined_names}))
    IL.cell(row=4 + i, column=1, value=n).font = fB
    c = IL.cell(row=4 + i, column=2, value=tit); c.font = Font(name=F, size=10, color='0563C1', underline='single')
    IL.cell(row=4 + i, column=3, value=campos).font = fS
    pth = _os.path.join(FIGDIR, fn + '.png')
    IL.cell(row=r_img, column=1, value=f'Fig. {n} — {tit}').font = fT
    img = _XLImg(pth)
    sc = 1000 / img.width
    img.width, img.height = int(img.width * sc), int(img.height * sc)
    IL.add_image(img, f'A{r_img + 1}')
    fig_row[n] = r_img
    c.hyperlink = f"#'Ilustrações'!A{r_img}"
    r_img += 1 + int(img.height / 20) + 3
for i, (n, tit) in enumerate(FIGS_APP):
    rr = r_idx_app + i
    campos = ', '.join(sorted({k for k, v in FIG_OF.items() if v == n and k in wb.defined_names}))
    IL.cell(row=rr, column=1, value=n).font = fB
    IL.cell(row=rr, column=2, value=f'{tit} — só no app').font = fN
    IL.cell(row=rr, column=3, value=campos).font = fS
    fig_row[n] = rr       # o link das Entradas cai na linha do índice, que diz que a figura é do app
IL.cell(row=r_idx_app + len(FIGS_APP), column=1,
        value=f'Figuras {FIGS_APP[0][0]} a {FIGS_APP[-1][0]}: só no app (SVG em figs/app). A planilha e o PDF de ilustrações trazem as figuras {", ".join(str(n) for n, _, _ in FIGS)}.').font = fS
widths(IL, {'A': 8, 'B': 62, 'C': 90})
# Entradas: coluna Figura com link + "ver Fig. N" na observação
for nm, n in FIG_OF.items():
    dn = wb.defined_names.get(nm)
    if dn is None: continue
    ref = list(dn.destinations)[0][1].replace('$', '')
    row = int(''.join(ch for ch in ref if ch.isdigit()))
    cE = E.cell(row=row, column=5, value=f'Fig. {n}')
    cE.hyperlink = f"#'Ilustrações'!A{fig_row[n]}"; cE.font = Font(name=F, size=10, color='0563C1', underline='single')
    cD = E.cell(row=row, column=4)
    if cD.value and 'Fig.' not in str(cD.value): cD.value = f'{cD.value} (ver Fig. {n})'

import re as _re
for _cr in list(wb['Contrafortes'].iter_rows(min_row=4)) + list(wb['Fundação'].iter_rows(min_row=4)):
    for _c in _cr:
        if _c.column <= 8:
            if isinstance(_c.value, str) and _c.value.startswith('=') and not _c.value.startswith('=IFERROR('):
                _c.value = '=IFERROR(' + _c.value[1:] + ',"—")'
for _ws in (wb['ELS'], wb['Painel não armado']):
    for _row in _ws.iter_rows(min_col=2, max_col=2):
        for _c in _row:
            if isinstance(_c.value, str) and _c.value.startswith('=') and not _c.value.startswith('=IFERROR('):
                _f = _c.value[1:]
                if '"OK' in _f or 'Estádio' in _f:      # verificações: sem espaçamento válido não há painel/faixa
                    _f = 'IF(s_adot>0,' + _f + ',"— (sem espaçamento de barras válido)")'
                    if _ws.title == 'Painel não armado':
                        _f = 'IF(AND(s_adot>0,s_adot<=m_mod),"— não se aplica: barra em todos os furos, não há painel entre barras",' + _f + ')'
                _c.value = '=IFERROR(' + _f + ',"—")'
# sanity: Excel-invalid defined names (look like cell refs)
def _col2n(c):
    n = 0
    for ch in c.upper(): n = n * 26 + ord(ch) - 64
    return n
for _nm in list(wb.defined_names.keys()):
    _m = _re.fullmatch(r'([A-Za-z]{1,3})(\d+)', _nm)
    assert not (_m and _col2n(_m.group(1)) <= 16384), f'nome inválido no Excel: {_nm}'
    assert not _re.fullmatch(r'[RrCc]\d*|[Rr]\d*[Cc]\d*', _nm), f'nome inválido no Excel: {_nm}'
    # R/C seguido de algarismo no INÍCIO já basta para o Excel recusar (c1_s, r2_a, c12abc — medido por COM em 08/10):
    # ele lê como pedaço de referência R1C1 e não abre o arquivo pela automação (na mão, "repara" apagando o nome).
    assert not _re.match(r'[RrCc]\d', _nm), f'nome inválido no Excel: {_nm}'
# Nome definido no Excel não diferencia maiúscula: k_dir e K_dir são o MESMO nome (achado em 13/10, o k do solo
# colidia com o K da flexão). O openpyxl grava os dois e o Excel fica com um só — a conta passa a ler o errado.
_vistos = {}
for _nm in wb.defined_names.keys():
    assert _nm.lower() not in _vistos, f'nome repetido no Excel (maiúscula não conta): {_vistos[_nm.lower()]} e {_nm}'
    _vistos[_nm.lower()] = _nm
wb.save(OUT)
print('saved', OUT, wb.sheetnames)
