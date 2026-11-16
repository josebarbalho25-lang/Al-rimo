# Aba "Muro de cima e vento" — executada dentro do build_new.py (mesmo namespace, como contrafortes.py e fundacao.py).
#
# Por que existe (Jose, 13/11): os arrimos dos clientes dele têm muro de vedação por cima, e calcular separado e
# detalhar separado dá mais trabalho e mais erro do que ter tudo no mesmo programa. Esta aba faz três coisas:
#   1. o VENTO (NBR 6123, só perpendicular ao muro, soprando do aterro para a frente — o sentido que soma ao empuxo;
#      o outro sentido alivia o arrimo e não governa nada aqui);
#   2. o que o muro de cima e o vento levam para o arrimo — peso por metro (P_mc) e força/momento na base do arrimo
#      (Vk_w, Mk_w por metro; Vk_wcf, Mk_wcf no contraforte que recebe o pilarete). As abas do arrimo só SOMAM esses
#      nomes: com muro de cima e vento desligados todos valem 0 e a conta do arrimo fica a mesma de antes;
#   3. a verificação do próprio muro de cima — painéis entre cintas (a mesma conta do painel não armado: NBR 16868-1
#      Anexo E) e o pilarete (concreto: NBR 6118; bloco grauteado: NBR 16868-1).
#
# Caminho da carga do vento do muro de cima (DEDUÇÃO, escolhida a favor da segurança em cada peça):
#   - painel do muro de cima: apoiado nos pilaretes, nas cintas e na base (casos da Tab. E.1);
#   - pilarete: recebe o vento da largura de influência INTEIRA (como se o painel não descarregasse na base);
#   - contraforte com pilarete: recebe o vento do muro de cima da largura de influência do pilarete inteira;
#   - cinta do topo do arrimo (só com contrafortes): recebe a parte que o painel descarrega na base (metade com cinta
#     no topo do muro de cima, um quarto com cinta a meia altura, tudo sem cinta) mais metade do vento na parte do
#     arrimo acima do solo, vencendo o vão entre contrafortes biapoiada;
#   - muro em balanço e fundação: o total por metro (a soma não depende do caminho).
# A mesma força entra mais de uma vez em peças diferentes; nunca falta.
#
# O vento não entra no ELS (flecha e fissuração): na combinação quase permanente ψ2 = 0 para o vento (NBR 8681).
# No ELU o vento entra cheio junto com o empuxo (γf nos dois, sem o ψ0) — combinação a confirmar com o Jose.

MC = wb.create_sheet('Muro de cima e vento', 8)
title(MC, 'Muro de cima e vento',
      'Vento perpendicular ao muro (NBR 6123), soprando do aterro para a frente. Painéis do muro de cima: NBR 16868-1 Anexo E. Pilarete: NBR 6118 (concreto) ou NBR 16868-1 (bloco grauteado).')
header(MC, 3, ['Item', 'Valor', 'Unid.', 'Observação', 'Fonte'])
r = 4
def Lm(label, f, unit='', note='', kind='res', fmt=None, nm=None, src=None):
    global r
    line(MC, r, label, f, unit, note, kind, fmt, nm, src); r += 1

# ---- tabela do S2 (NBR 6123 Tab. 1): b, Fr e p por categoria e classe — colunas H a L, à direita da conta ----
# Mesmos números do A-PORT (src/modelo/vento/pressao.ts, TABELA_S2), que confere a tabela inteira contra a fórmula.
MC['H3'] = 'S2 = b·Fr·(z/10)^p — NBR 6123, Tab. 1'; MC['H3'].font = fB
for col, h_ in zip('HIJKL', ['Categoria', 'Classe', 'b', 'Fr', 'p']):
    c = MC[f'{col}4']; c.value = h_; c.font = fH; c.fill = NAVY; c.alignment = Alignment(horizontal='center')
S2TAB = {'I': [(1.10, 1.00, 0.060), (1.11, 0.98, 0.065), (1.12, 0.95, 0.070)],
         'II': [(1.00, 1.00, 0.085), (1.00, 0.98, 0.090), (1.00, 0.95, 0.100)],
         'III': [(0.94, 1.00, 0.100), (0.94, 0.98, 0.105), (0.93, 0.95, 0.115)],
         'IV': [(0.86, 1.00, 0.120), (0.85, 0.98, 0.125), (0.84, 0.95, 0.135)],
         'V': [(0.74, 1.00, 0.150), (0.73, 0.98, 0.160), (0.71, 0.95, 0.175)]}
_rr = 5
for cat, linhas in S2TAB.items():
    for cls, (b_, fr_, p_) in zip('ABC', linhas):
        for col, v in zip('HIJKL', (cat, cls, b_, fr_, p_)):
            c = MC[f'{col}{_rr}']; c.value = v; c.font = fN; c.border = BOX; c.alignment = Alignment(horizontal='center')
        MC[f'M{_rr}'] = f'=H{_rr}&I{_rr}'   # chave "IIIA" para o CORRESP
        MC[f'M{_rr}'].font = fS
        _rr += 1
wb.defined_names['s2_chave'] = DefinedName('s2_chave', attr_text=f"'Muro de cima e vento'!$M$5:$M${_rr-1}")
wb.defined_names['s2_tab'] = DefinedName('s2_tab', attr_text=f"'Muro de cima e vento'!$J$5:$L${_rr-1}")
MC[f'H{_rr}'] = 'z mínimo: 5 m (categoria V: 10 m) — a linha "≤ 5 m" da tabela.'; MC[f'H{_rr}'].font = fS

ON_V = 'vento_on="Sim"'
ON_M = 'mc_on="Sim"'
CF = 'Tipo_muro="Contrafortes"'

section(MC, r, '1. Geometria'); r += 1
Lm('Muro de cima no cálculo', '=IF(' + ON_M + ',"Sim — "&FIXED(h_mc,2)&" m de "&mat_mc&" de "&FIXED(t_mc,1)&" cm","Não")', '', '', 'key')
Lm('Altura do muro de cima (no cálculo)', '=IF(' + ON_M + ',h_mc,0)', 'm', 'Zero sem muro de cima.', 'res', '0.00', 'h_mce')
Lm('Arrimo acima do solo (h muro − h solo)', '=MAX(0,H_muro-H_solo)', 'm', 'Parte do arrimo exposta ao vento do lado do aterro.', 'res', '0.00', 'h_exp')
Lm('Altura livre exposta ao vento', '=h_exp+h_mce', 'm', 'Do topo do solo contido ao topo do muro de cima.', 'res', '0.00', 'h_liv')
Lm('Pilaretes: eixo a eixo', '=IF(' + CF + ',pil_ncf*l_cf_adot,s_pil)', 'm',
   'Balanço: o espaçamento digitado. Contrafortes: o pilarete fica em cima do contraforte (um a cada 1 ou 2).', 'res', '0.00', 's_trib')
r += 1

section(MC, r, '2. Vento (NBR 6123)'); r += 1
Lm('Vento no cálculo', '=IF(' + ON_V + ',"Sim","Não")', '', '', 'key')
# z do S2 pelo terreno da FRENTE (a base do arrimo, mais baixa que o aterro): z maior → S2 maior, a favor.
Lm('z (topo do conjunto acima do terreno da frente)', '=H_muro+h_mce', 'm', 'Do topo da sapata ao topo do muro de cima. O terreno da frente é o mais baixo: z maior, S2 maior (a favor).', 'res', '0.00', 'z_v')
Lm('z usado no S2 (mínimo da tabela)', '=MAX(IF(cat_v="V",10,5),z_v)', 'm', '5 m (10 m na categoria V).', 'res', '0.00', 'z_s2', 'NBR 6123 Tab. 1')
Lm('b', '=INDEX(s2_tab,MATCH(cat_v&cls_v,s2_chave,0),1)', '', '', 'res', '0.00', 'b_s2', 'NBR 6123 Tab. 1')
Lm('Fr', '=INDEX(s2_tab,MATCH(cat_v&cls_v,s2_chave,0),2)', '', '', 'res', '0.00', 'Fr_s2', 'NBR 6123 Tab. 1')
Lm('p', '=INDEX(s2_tab,MATCH(cat_v&cls_v,s2_chave,0),3)', '', '', 'res', '0.000', 'p_s2', 'NBR 6123 Tab. 1')
Lm('S2 = b·Fr·(z/10)^p', '=b_s2*Fr_s2*(z_s2/10)^p_s2', '', '', 'res', '0.000', 'S2_v', 'NBR 6123 5.3.3')
Lm('Vk da estrutura = V0·S1·S2·S3', '=V0_v*S1_v*S2_v*S3_e', 'm/s', 'S3 da estrutura: pilarete e arrimo.', 'res', '0.00', 'Vk_v', 'NBR 6123 4.2')
Lm('q da estrutura = 0,613·Vk²', '=0.613*Vk_v^2/1000', 'kN/m²', 'Pressão dinâmica.', 'key', '0.000', 'q_v', 'NBR 6123 4.2')
Lm('Vk da vedação = V0·S1·S2·S3', '=V0_v*S1_v*S2_v*S3_v', 'm/s', 'S3 da vedação: painéis do muro de cima.', 'res', '0.00', 'Vk_vv', 'NBR 6123 4.2')
Lm('q da vedação = 0,613·Vk²', '=0.613*Vk_vv^2/1000', 'kN/m²', '', 'key', '0.000', 'q_vv', 'NBR 6123 4.2')
# Tab. 16 da NBR 6123 (1988, item 8.1), muro sobre o terreno, vento a 90°: Cf = 1,1 com l/h = 1 e 1,2 com l/h ≥ 10
# (e no fluxo bidimensional). O l é o comprimento do muro inteiro, que a planilha não tem — fica o maior, 1,2, que
# vale para qualquer comprimento. A norma avisa que, fora do fluxo bidimensional, o vento OBLÍQUO é o pior (1,5 com
# a força deslocada para a ponta); o Jose decidiu só o perpendicular (13/11). q no topo do muro (8.1).
Lm('Coeficiente de força do muro isolado (sugestão)', 1.2, '', 'Muro sobre o terreno, vento perpendicular: 1,1 (l/h = 1) a 1,2 (l/h ≥ 10). Fica 1,2, que vale para qualquer comprimento.', 'sug', '0.00', 'Cf_sug', 'NBR 6123 8.1, Tab. 16')
Lm('Coeficiente de força usado', '=IF(ISNUMBER(Cf_dir),Cf_dir,Cf_sug)', '', 'Digitado nas Entradas ou a sugestão.', 'res', '0.00', 'Cf_v')
Lm('Pressão do vento na estrutura = C·q', '=IF(' + ON_V + ',IFERROR(Cf_v*q_v,0),0)', 'kN/m²', 'Característica, com o S3 da estrutura (pilarete e arrimo). Zero sem vento.', 'key', '0.000', 'p_w')
Lm('Pressão do vento na vedação = C·q', '=IF(' + ON_V + ',IFERROR(Cf_v*q_vv,0),0)', 'kN/m²', 'Característica, com o S3 da vedação (painéis do muro de cima).', 'key', '0.000', 'p_wv')
r += 1

section(MC, r, '3. O que vai para o arrimo'); r += 1
Lm('Reboco do muro de cima', '=21*reb_mc_esp/100*IF(reb_mc="Nas duas faces",2,IF(reb_mc="Só na frente",1,0))', 'kN/m²', '21 kN/m³ (NBR 6120, argamassa de cimento e areia) × espessura × faces.', 'res', '0.00', 'g_mcr')
Lm('Parede do muro de cima com reboco', '=g_mc+g_mcr', 'kN/m²', '', 'res', '0.00', 'g_mct')
# Seção do pilarete: em branco, a que o tipo de muro pede (Jose, 13/11). Balanço: 20 de frente e a espessura do muro
# — as barras descem nos furos do bloco do arrimo. Contrafortes: a espessura do contraforte e 25 cm sobre a haste.
Lm('Pilarete: largura b (ao longo do muro)', '=IF(ISNUMBER(b_pil),b_pil,IF(' + CF + ',t_bloco,20))', 'cm', 'Digitada manda.', 'res', '0.0', 'b_pila')
Lm('Pilarete: altura da seção h (na direção do vento)', '=IF(ISNUMBER(hs_pil),hs_pil,IF(' + CF + ',25,t_bloco))', 'cm', 'Digitada manda.', 'res', '0.0', 'hs_pila')
Lm('Peso específico do pilarete', '=IF(LEFT(pil_tipo,4)="Conc",gama_c,gama_cf_us)', 'kN/m³', 'Concreto: γ do concreto (Fundação). Bloco grauteado: o mesmo γ do contraforte (todos os furos cheios).', 'res', '0.00', 'g_pil')
Lm('Cintas do muro de cima (quantidade)', '=IF(cin_mc="Nenhuma",0,IF(cin_mc="No topo e a meia altura",2,1))', '', '', 'res', '0', 'n_cin')
# Cinta de 20 cm de altura em concreto, no lugar de uma faixa de parede: só a diferença de peso (dedução).
Lm('Peso do muro de cima por metro (P)', '=IF(' + ON_M + ',g_mct*h_mc+IF(s_trib>0,(g_pil*b_pila*hs_pila/10000-g_mct*b_pila/100)*h_mc/s_trib,0)+n_cin*(gama_c*t_mc/100-g_mct)*0.2,0)', 'kN/m',
   'Parede + pilaretes (a diferença de peso, dividida pelo eixo a eixo) + cintas de 20 cm em concreto (a diferença). Média por metro.', 'key', '0.00', 'P_mc')
Lm('Vento por metro na base do arrimo: Vk = C·q·h livre', '=p_w*h_liv', 'kN/m', 'Muro de cima + arrimo acima do solo.', 'key', '0.00', 'Vk_w')
Lm('Vento por metro na base do arrimo: Mk = Vk·(h solo + h livre/2)', '=Vk_w*(H_solo+h_liv/2)', 'kN·m/m', 'Resultante no meio da altura livre.', 'key', '0.00', 'Mk_w')
Lm('Contraforte: vento do muro de cima (largura do pilarete)', '=IF(' + CF + ',p_w*h_mce*pil_ncf*binf,0)', 'kN', 'O contraforte com pilarete recebe a largura de influência inteira do pilarete (a favor).', 'res', '0.00', 'F_wpc')
Lm('Contraforte: vento no arrimo acima do solo', '=IF(' + CF + ',p_w*h_exp*binf,0)', 'kN', 'Largura de influência do contraforte.', 'res', '0.00', 'F_wec')
Lm('Contraforte: Vk do vento', '=F_wpc+F_wec', 'kN', '', 'key', '0.00', 'Vk_wcf')
Lm('Contraforte: Mk do vento na base', '=F_wpc*(H_muro+h_mce/2)+F_wec*(H_solo+h_exp/2)', 'kN·m', '', 'key', '0.00', 'Mk_wcf')
r += 1

# ---- painéis do muro de cima: a mesma conta da aba Painel não armado (Anexo E), um bloco por painel ----
section(MC, r, '4. Painéis do muro de cima (alvenaria não armada, NBR 16868-1 Anexo E)'); r += 1
Lm('Largura do painel (l)', '=s_trib', 'm', 'Eixo a eixo dos pilaretes (a favor: o vão livre é menor).', 'res', '0.00', 'l_mc')
Lm('ftk ⊥ fiada usado', "=IF(ISNUMBER(ftkn_mc_dir),ftkn_mc_dir,INDEX('Referências'!$M$16:$M$18,MATCH(arg_mc,'Referências'!$L$16:$L$18,0)))", 'MPa', 'Digitado nas Entradas ou, em branco, a tabela pela argamassa.', 'res', '0.00', 'ftkn_mc', 'NBR 16868-1 Tab. 3 / projetista')
Lm('ftk ∥ fiada usado', "=IF(ISNUMBER(ftkp_mc_dir),ftkp_mc_dir,INDEX('Referências'!$N$16:$N$18,MATCH(arg_mc,'Referências'!$L$16:$L$18,0)))", 'MPa', 'Digitado nas Entradas ou, em branco, a tabela pela argamassa.', 'res', '0.00', 'ftkp_mc', 'NBR 16868-1 Tab. 3 / projetista')
Lm('μ = ftk⊥/ftk∥', '=ftkn_mc/ftkp_mc', '', '', 'res', '0.00', 'mu_mc', 'NBR 16868-1 E.2')
Lm('fd = γf·C·q (vedação)', '=gama_f*p_wv', 'kN/m²', '', 'key', '0.000', 'fd_mc')
Lm('W = t²/6 (por metro)', '=(t_mc/100)^2/6', 'm³/m', 'Seção bruta, como no painel do arrimo.', 'res', '0.000000', 'W_mc')
Lm('fvd = fvk/γm', "=IF(ISNUMBER(fvk_mc_dir),fvk_mc_dir,MIN(INDEX('Referências'!$O$16:$O$18,MATCH(arg_mc,'Referências'!$L$16:$L$18,0)),INDEX('Referências'!$P$16:$P$18,MATCH(arg_mc,'Referências'!$L$16:$L$18,0))))/gama_m", 'MPa', 'fvk digitado ou, em branco, fvk0 da tabela sem pré-compressão (a favor).', 'res', '0.000', 'fvd_mc', 'NBR 16868-1 Tab. 4 / projetista')
# limites publicados como célula: a memória do app compara com a célula, não refaz a conta
Lm('ftd ∥ = ftk∥/γm', '=ftkp_mc/gama_m', 'MPa', '', 'res', '0.000', 'ftdp_mc', 'NBR 16868-1')
Lm('ftd ⊥ = ftk⊥/γm', '=ftkn_mc/gama_m', 'MPa', '', 'res', '0.000', 'ftdn_mc', 'NBR 16868-1')
Lm('Painel de cima existe?', '=IF(OR(cin_mc="A meia altura",cin_mc="No topo e a meia altura"),"Sim","Não")', '', 'Só com cinta a meia altura o muro vira dois painéis.', 'res', None, 'pnB_on')
_PAINEIS = (
    ('A', 'de baixo', '=IF(pnB_on="Sim",h_mc/2,h_mc)', '=IF(cin_mc="Nenhuma",18,13)'),
    ('B', 'de cima', '=IF(pnB_on="Sim",h_mc/2,0)', '=IF(cin_mc="No topo e a meia altura",13,18)'),
)
_T = lambda cs: f'CHOOSE(MATCH({cs},{{13,18,11}},0),tabela_13,tabela_18,tabela_11)'
for k, desc, fh, fcaso in _PAINEIS:
    r += 1
    MC.cell(row=r, column=1, value=f'Painel {desc}').font = fB; r += 1
    Lm(f'h (painel {desc})', fh, 'm', '', 'res', '0.00', f'h_p{k}')
    Lm(f'Caso (painel {desc})', fcaso, '', '13 = quatro bordas apoiadas (cinta em cima); 18 = topo livre.', 'res', '0', f'cs_p{k}', 'NBR 16868-1 Tab. E.1')
    Lm('h/l (limitado a 0,3–3,0)', f'=MIN(3,MAX(0.3,h_p{k}/l_mc))', '', '', 'res', '0.000', f'hl_p{k}')
    Lm('μ (limitado a 0,3–1,0)', '=MIN(1,MAX(0.3,mu_mc))', '', '', 'res', '0.000', f'mu_p{k}')
    Lm('coluna j', f'=MATCH(hl_p{k},hl_row,1)', '', '', 'res', '0', f'jp{k}')
    Lm('linha i', f'=MATCH(mu_p{k},mu_col,-1)', '', '', 'res', '0', f'ip{k}')
    Lm('tx', f'=IF(jp{k}>=11,0,(hl_p{k}-INDEX(hl_row,jp{k}))/(INDEX(hl_row,jp{k}+1)-INDEX(hl_row,jp{k})))', '', '', 'res', '0.000', f'tx{k}')
    Lm('ty', f'=IF(ip{k}>=9,0,(INDEX(mu_col,ip{k})-mu_p{k})/(INDEX(mu_col,ip{k})-INDEX(mu_col,ip{k}+1)))', '', '', 'res', '0.000', f'ty{k}')
    T_ = _T(f'cs_p{k}')
    Lm('βf', f'=(1-ty{k})*((1-tx{k})*INDEX({T_},ip{k},jp{k})+tx{k}*INDEX({T_},ip{k},MIN(11,jp{k}+1)))+ty{k}*((1-tx{k})*INDEX({T_},MIN(9,ip{k}+1),jp{k})+tx{k}*INDEX({T_},MIN(9,ip{k}+1),MIN(11,jp{k}+1)))',
       '', 'Interpolado em h/l e μ.', 'key', '0.0000', f'bf_p{k}', 'NBR 16868-1 E.4.2 (Tab. E.1)')
    Lm('Md,par = βf·fd·l²', f'=bf_p{k}*fd_mc*l_mc^2', 'kN·m/m', '', 'res', '0.0000', f'Mpa_p{k}')
    Lm('Md,nor = μ·Md,par', f'=mu_mc*Mpa_p{k}', 'kN·m/m', '', 'res', '0.0000', f'Mno_p{k}')
    Lm('σtd,par = Md,par/W', f'=Mpa_p{k}/W_mc/1000', 'MPa', f'≤ ftk∥/γm', 'res', '0.0000', f'sp_p{k}')
    Lm('σtd,nor = Md,nor/W', f'=Mno_p{k}/W_mc/1000', 'MPa', f'≤ ftk⊥/γm', 'res', '0.0000', f'sn_p{k}')
    Lm('τvd = fd·l/2/t', f'=fd_mc*l_mc/2/(t_mc/100)/1000', 'MPa', 'Faixa horizontal biapoiada nos pilaretes (como no painel do arrimo).', 'res', '0.0000', f'tv_p{k}')
    Lm('Limite de área (coef. × t²)', f'=IF(cs_p{k}=13,2025,1350)', '', '2025·t² com 4 lados; 1350·t² com 3.', 'res', '0', f'ca_p{k}', 'NBR 16868-1 E.4.1')
    Lm(f'Painel {desc}: resumo',
       f'=IF(mc_on<>"Sim","— (sem muro de cima)",IF(h_p{k}<=0,"— (não há)",IF(p_wv<=0,"— (sem vento)",IF(AND(sp_p{k}<=ftkp_mc/gama_m,sn_p{k}<=ftkn_mc/gama_m,tv_p{k}<=fvd_mc,MAX(l_mc,h_p{k})<=50*t_mc/100,l_mc*h_p{k}<=ca_p{k}*(t_mc/100)^2),'
       f'"OK (flexão "&FIXED(100*MAX(sp_p{k}/(ftkp_mc/gama_m),sn_p{k}/(ftkn_mc/gama_m)),0)&"%)","NÃO OK"))))', '', 'Flexão nas duas direções, cisalhamento e dimensões-limite.', 'key', None, f'res_p{k}')
r += 1

section(MC, r, '5. Pilarete (balanço engastado no topo do arrimo)'); r += 1
Lm('Vk no pilarete = C·q·h·(eixo a eixo)', '=p_w*h_mce*s_trib', 'kN', 'O pilarete leva o vento da largura de influência inteira (a favor).', 'res', '0.00', 'Vk_pil')
Lm('Mk na base do pilarete = Vk·h/2', '=Vk_pil*h_mce/2', 'kN·m', '', 'res', '0.00', 'Mk_pil')
Lm('Md = γf·Mk', '=gama_f*Mk_pil', 'kN·m', '', 'key', '0.00', 'Md_pil')
Lm('Vd = γf·Vk', '=gama_f*Vk_pil', 'kN', '', 'key', '0.00', 'Vd_pil')
# Cobrimento ao eixo: cobrimento + estribo (Ø5, o mínimo da NBR 6118 18.4.3 — dedução da conta; o desenho usa o Ø do
# estribo escolhido) + Ø/2. A barra continua reta para dentro do bloco do arrimo (furo no balanço, haste do contraforte
# rente à face): o eixo fica no mínimo a parede do bloco + Ø/2 da face do muro (no balanço o pilarete é centrado).
Lm('Cobrimento ao eixo das barras', '=MAX(c_pil+IF(LEFT(pil_tipo,4)="Conc",0.5,0)+phi_pil/20,IF(' + CF + ',0,(t_bloco-hs_pila)/2)+hf_bl+phi_pil/20)', 'cm',
   'c + Ø estribo + Ø/2, e ≥ parede do bloco + Ø/2 (a barra desce dentro do bloco do arrimo; no balanço, o pilarete centrado no muro: + (t − h)/2).', 'res', '0.00', 'ce_pil')
Lm('d = h da seção − cobrimento ao eixo', '=hs_pila-ce_pil', 'cm', '', 'res', '0.0', 'd_pil')
Lm('As efetiva (uma face)', '=n_pil*PI()*phi_pil^2/400', 'cm²', '', 'res', '0.00', 'As_pile')
Lm('fyd', '=fyk_/gama_s', 'MPa', '', 'res', '0.0', 'fyd_pil')
# concreto moldado: NBR 6118, flexão simples (a força normal do peso próprio é pequena e desprezada — a favor)
Lm('Concreto: fcd', '=VALUE(MID(fck_pil,2,2))/1.4', 'MPa', '', 'res', '0.00', 'fcd_pil', 'NBR 6118')
Lm('Concreto: x', '=IFERROR(1.25*d_pil*(1-SQRT(1-Md_pil*100/(0.425*b_pila*d_pil^2*fcd_pil/10))),"não resiste")', 'cm', 'Bloco 0,8x com 0,85fcd.', 'res', '0.00', 'xc_pil', 'NBR 6118 17.2.2')
Lm('Concreto: As', '=IFERROR(Md_pil*100/(fyd_pil/10*(d_pil-0.4*xc_pil)),"—")', 'cm²', '', 'res', '0.00', 'Asc_pil')
Lm('Concreto: As,mín = 0,15%·b·h', '=0.0015*b_pila*hs_pila', 'cm²', '', 'res', '0.00', 'Asm_pil', 'NBR 6118 17.3.5.2.1')
Lm('Concreto: VRd2 = 0,27·(1 − fck/250)·fcd·b·d', '=0.27*(1-VALUE(MID(fck_pil,2,2))/250)*fcd_pil/10*b_pila*d_pil', 'kN', '', 'res', '0.00', 'VR2c_pil', 'NBR 6118 17.4.2.2')
# bloco grauteado: NBR 16868-1, seção retangular cheia (fpk*), como o contraforte aparente
Lm('Bloco: fpk* (prisma cheio)', "=VLOOKUP(fbk_pil,'Referências'!$H$5:$J$16,3,FALSE)", 'MPa', '', 'res', '0.0', 'fpk_pil', 'ABCP Tab. 3.2')
Lm('Bloco: K·fd = K·0,7·fpk*/γm', '=IF(ISNUMBER(K_cf),K_cf,2)*0.7*fpk_pil/gama_m', 'MPa', 'K = o do contraforte (Entradas); em branco, 2,0 (todo grauteado, NBR 16868-1 6.2.2.4).', 'res', '0.000', 'Kfd_pil')
Lm('Bloco: x', '=IFERROR(1.25*d_pil*(1-SQRT(1-Md_pil*100/(0.5*b_pila*d_pil^2*Kfd_pil/10))),"não resiste")', 'cm', '', 'res', '0.00', 'xb_pil', 'NBR 16868-1 11.3')
Lm('Bloco: As = Md/(fyd·z), z ≤ 0,95d', '=IFERROR(Md_pil*100/(fyd_pil/10*MIN(d_pil-0.4*xb_pil,0.95*d_pil)),"—")', 'cm²', '', 'res', '0.00', 'Asb_pil')
Lm('Bloco: As,mín = 0,15%·b·d', '=0.0015*b_pila*d_pil', 'cm²', '', 'res', '0.00', 'Asmb_pil')
Lm('Bloco: fvd = (0,35 + 17,5ρ ≤ 0,7)/γm', '=MIN(0.7,0.35+17.5*As_pile/(b_pila*d_pil))/gama_m', 'MPa', '', 'res', '0.000', 'fvd_pil', 'NBR 16868-1 11.4')
_concreto = 'LEFT(pil_tipo,4)="Conc"'
Lm('x/d', f'=IFERROR(IF({_concreto},xc_pil,xb_pil)/d_pil,"—")', '', '≤ 0,45 (ductilidade).', 'res', '0.000', 'xd_pil')
Lm('As necessária', f'=IF(ISNUMBER(IF({_concreto},xc_pil,xb_pil)),MAX(IF({_concreto},Asc_pil,Asb_pil),IF({_concreto},Asm_pil,Asmb_pil)),"não resiste")', 'cm²', 'Maior entre o cálculo e o mínimo. Seção que não resiste: texto (o MAX ignoraria o texto e daria só o mínimo).', 'key', '0.00', 'Asn_pil')
Lm('Ancoragem no arrimo: ℓ0t = α0t·ℓb no graute ≥ ℓ0t,mín',
   '=CEILING(MAX(a0t*lbphi_gr*phi_pil/10*IFERROR(MIN(1,IF(' + _concreto + ',Asc_pil,Asb_pil)/As_pile),1),0.3*a0t*lbphi_gr*phi_pil/10,1.5*phi_pil,20),1)',
   'cm', 'A barra do pilarete desce no furo grauteado do arrimo (ou no contraforte) e emenda com a dele: mesma regra das esperas (Fundação, seção 10).', 'key', '0', 'l0t_pil', 'NBR 6118 9.5.2.2.1')
Lm('Pilarete: resumo',
   f'=IF(h_mce<=0,"— (sem muro de cima)",IF(p_w<=0,"— (sem vento)",IF(ISNUMBER(Asn_pil)=FALSE,"NÃO OK — a seção não resiste: aumentar a seção",'
   f'IF(xd_pil>0.45,"NÃO OK — x/d > 0,45: aumentar a seção",IF(As_pile<Asn_pil,"NÃO OK — As "&FIXED(As_pile,2)&" < "&FIXED(Asn_pil,2)&" cm²: mais barras ou Ø maior",'
   f'IF(IF({_concreto},Vd_pil>VR2c_pil,Vd_pil/(b_pila*d_pil)*10>fvd_pil),"NÃO OK — cisalhamento","OK ("&FIXED(100*Asn_pil/As_pile,0)&"% do aço)"))))))',
   '', 'Concreto: estribo mínimo da NBR 6118 17.4.1.1 em todo caso.', 'key', None, 'res_pil')
r += 1

# A LIGAÇÃO do pilarete com o arrimo (Jose, 13/11: "esses pilares precisam engastar e ter armadura contínua com o
# muro, adentrando no graute"). O momento do pilarete chega inteiro no topo do arrimo e as barras dele descem ℓ0t
# dentro da alvenaria grauteada: a seção que resiste ali é de ALVENARIA, não a do pilarete. Balanço: b × t (a frente
# do pilarete na parede do muro); contrafortes: a haste, t × comprimento do contraforte. Toda grauteada → fpk* do
# bloco do arrimo, com o K do contraforte. DEDUÇÃO, a favor: a parede em volta, que espalha o momento, não conta.
# O d é o do sentido pior: a barra tracionada mais perto do bordo comprimido (mín(h do pilarete; h da ligação) − c).
section(MC, r, '5b. Ligação do pilarete no arrimo'); r += 1
Lm('Largura da ligação', '=IF(' + CF + ',t_bloco,b_pila)', 'cm', 'Balanço: a frente do pilarete. Contrafortes: a espessura da haste.', 'res', '0.0', 'b_lig')
Lm('Altura da ligação (na direção do vento)', '=IF(' + CF + ',tenr_adot,t_bloco)', 'cm', 'Balanço: a espessura do muro. Contrafortes: o comprimento do contraforte.', 'res', '0.0', 'h_lig')
Lm('d = mín(h do pilarete; h da ligação) − c', '=MIN(hs_pila,h_lig)-ce_pil', 'cm', 'O vento vem dos dois lados: vale o braço menor.', 'res', '0.0', 'd_lig')
Lm('fpk* do bloco do arrimo (prisma cheio)', "=VLOOKUP(fbk_,'Referências'!$H$5:$J$16,3,FALSE)", 'MPa', 'A ligação é toda grauteada.', 'res', '0.0', 'fpk_lig', 'ABCP Tab. 3.2')
Lm('K·fd = K·0,7·fpk*/γm', '=IF(ISNUMBER(K_cf),K_cf,2)*0.7*fpk_lig/gama_m', 'MPa', 'K = o do contraforte (Entradas); em branco, 2,0.', 'res', '0.000', 'Kfd_lig')
Lm('x', '=IFERROR(1.25*d_lig*(1-SQRT(1-Md_pil*100/(0.5*b_lig*d_lig^2*Kfd_lig/10))),"não resiste")', 'cm', '', 'res', '0.00', 'x_lig', 'NBR 16868-1 11.3')
Lm('x/d', '=IFERROR(x_lig/d_lig,"—")', '', '≤ 0,45 (ductilidade).', 'res', '0.000', 'xd_lig')
Lm('As = Md/(fyd·z), z ≤ 0,95d', '=IFERROR(Md_pil*100/(fyd_pil/10*MIN(d_lig-0.4*x_lig,0.95*d_lig)),"não resiste")', 'cm²', 'As de uma face do pilarete que desce na ligação.', 'res', '0.00', 'As_lig')
Lm('fvd = (0,35 + 17,5ρ ≤ 0,7)/γm', '=MIN(0.7,0.35+17.5*As_pile/(b_lig*d_lig))/gama_m', 'MPa', '', 'res', '0.000', 'fvd_lig', 'NBR 16868-1 11.4')
Lm('τvd = Vd/(b·d)', '=Vd_pil/(b_lig*d_lig)*10', 'MPa', '', 'res', '0.000', 'tvd_lig')
# A montagem vale com ou sem vento (o veredito do app a lê no card do muro de cima); a conta, só com vento.
Lm('Ligação: montagem',
   '=IF(OR(mc_on<>"Sim",h_mce<=0),"— (sem muro de cima)",'
   'IF(AND(Tipo_muro<>"Contrafortes",t_bloco=14),"NÃO OK — balanço em bloco 14 não leva muro de cima: bloco 19 ou contrafortes",'
   'IF(AND(Tipo_muro<>"Contrafortes",b_pila<20),"NÃO OK — pilarete com menos de 20 cm de frente",'
   'IF(AND(' + CF + ',b_pila>t_bloco),"NÃO OK — pilarete mais largo que o contraforte: na ponta do muro ele passa do fim do muro",'
   'IF(AND(' + CF + ',larg_cf="Dobrado",n_pil<>2*INT(n_pil/2)),"NÃO OK — sobre o contraforte dobrado as barras de cada face vão metade em cada bloco: nº par",'
   'IF(AND(' + CF + ',larg_cf="Dobrado",t_bloco=14),"NÃO OK — contraforte dobrado em bloco 14: as barras do pilarete do lado do muro caem na parede do bloco de junção, não descem no graute",'
   'IF(hs_pila>h_lig,IF(' + CF + ',"NÃO OK — pilarete passa da ponta do contraforte","NÃO OK — pilarete mais grosso que o muro: as barras não caem nos furos"),"OK")))))))',
   '', 'Balanço: bloco 19 e 20 cm de frente (Jose, 13/11). Contrafortes: largura até t (o da ponta não passa do fim do muro); sobre o dobrado, barras por face em nº par. Pilarete dentro da ligação.', 'key', None, 'chk_ligg')
Lm('Ligação: resumo',
   '=IF(LEFT(chk_ligg,2)<>"OK",chk_ligg,'
   'IF(p_w<=0,"— (sem vento)",'
   'IF(ISNUMBER(x_lig)=FALSE,"NÃO OK — a alvenaria da ligação não resiste",'
   'IF(xd_lig>0.45,"NÃO OK — x/d "&FIXED(xd_lig,2)&" > 0,45 na ligação",'
   'IF(As_pile<As_lig,"NÃO OK — As "&FIXED(As_pile,2)&" < "&FIXED(As_lig,2)&" cm² na ligação",'
   'IF(tvd_lig>fvd_lig,"NÃO OK — cisalhamento na ligação","OK ("&FIXED(100*As_lig/As_pile,0)&"% do aço; x/d "&FIXED(xd_lig,2)&")"))))))',
   '', 'Dentro do arrimo: frente mínima no balanço, flexão, ductilidade, aço e cisalhamento.', 'key', None, 'res_lig')
r += 1

section(MC, r, '6. Cinta do topo do arrimo (só com contrafortes)'); r += 1
Lm('Parte do vento do muro de cima que desce pela base do painel', '=IF(cin_mc="No topo",0.5,IF(cin_mc="Nenhuma",1,0.25))', '',
   'Cinta no topo: metade; a meia altura: um quarto; sem cinta: tudo (dedução, a favor).', 'res', '0.00', 'sh_cin')
Lm('Carga na cinta do topo do arrimo', '=IF(' + CF + ',p_w*(h_mce*sh_cin+h_exp/2),0)', 'kN/m', '+ metade do vento no arrimo acima do solo.', 'res', '0.00', 'w_cin')
Lm('Md do vento = γf·w·l²/8 (biapoiada entre contrafortes)', '=gama_f*w_cin*l_cf_adot^2/8*100', 'kN·cm', '', 'res', '0.0', 'Md_cin')
# A canaleta do topo é a BORDA LIVRE do painel de Libânio: o momento dela é o Mdxb (μyb), que com carga uniforme
# passa o do vão. Faixa de s_ph da canaleta (a mesma da barra horizontal) e um As só para a soma dos momentos.
Lm('Md do empuxo na canaleta do topo = máx(Mdxb; M horizontal)·faixa', '=IF(Tipo_muro="Contrafortes",MAX(Mdxb_p,M_ph)*s_ph/100,0)', 'kN·cm', 'Mdxb = borda livre (aba Contrafortes, seção 8).', 'res', '0.0', 'Mde_cin')
Lm('x', '=IFERROR(1.25*d_ph*(1-SQRT(1-(Md_cin+Mde_cin)/(0.5*s_ph*d_ph^2*Kfd_ph/10))),"não resiste")', 'cm', 'Faixa s da canaleta comprimida, d e K·fd da barra horizontal do painel — a mesma seção da aba Contrafortes, seção 9.', 'res', '0.00', 'x_cin')
Lm('As (empuxo + vento) ≤ uma barra Ø horizontal', '=IFERROR((Md_cin+Mde_cin)/(fyk_/gama_s/10*MIN(d_ph-0.4*x_cin,0.95*d_ph)),"não resiste")', 'cm²', '', 'res', '0.00', 'Ast_cin')
Lm('As de uma barra Ø horizontal', '=PI()*phi_ph^2/400', 'cm²', '', 'res', '0.00', 'Asb_cin')
Lm('Cinta do topo: resumo',
   '=IF(Tipo_muro<>"Contrafortes","— (muro em balanço)",IF(w_cin<=0,"— (sem vento)",IF(ISNUMBER(Ast_cin)=FALSE,"NÃO OK — a canaleta não resiste",IF(Ast_cin<=PI()*phi_ph^2/400,"OK ("&FIXED(100*Ast_cin/(PI()*phi_ph^2/400),0)&"% da barra)","NÃO OK — "&FIXED(Ast_cin,2)&" cm² > uma barra Ø"&FIXED(phi_ph,1)))))',
   '', '', 'key', None, 'res_cin')
r += 1

section(MC, r, '7. Verificações'); r += 1
Lm('Dados do vento', '=IF(vento_on<>"Sim","— (sem vento)",IF(AND(ISNUMBER(V0_v),ISNUMBER(S1_v),ISNUMBER(S3_v),ISNUMBER(S3_e),q_v>0,q_vv>0),"OK","NÃO OK — vento ligado sem V0, S1 ou S3"))', '', '', 'key', None, 'chk_dv')
Lm('Dados do muro de cima', '=IF(mc_on<>"Sim","— (sem muro de cima)",IF(AND(ISNUMBER(h_mc),h_mc>0,ISNUMBER(t_mc),t_mc>0,ISNUMBER(g_mc),s_trib>0,b_pila>0,hs_pila>0),"OK","NÃO OK — falta altura, espessura, peso, espaçamento ou seção do pilarete"))', '', '', 'key', None, 'chk_dmc')
# Só vale "OK…" ou o "— (motivo)" escrito pela própria conta: o "—" puro é o IFERROR do pós-processamento, ou
# seja, conta que não fechou — e conta que não fechou não pode passar.
Lm('Muro de cima e vento: resumo',
   '=IF(AND(mc_on<>"Sim",vento_on<>"Sim"),"— (sem muro de cima e sem vento)",IF(AND(OR(LEFT(chk_dv,2)="OK",LEFT(chk_dv,3)="— ("),OR(LEFT(chk_dmc,2)="OK",LEFT(chk_dmc,3)="— ("),OR(LEFT(res_pA,2)="OK",LEFT(res_pA,3)="— ("),OR(LEFT(res_pB,2)="OK",LEFT(res_pB,3)="— ("),OR(LEFT(res_pil,2)="OK",LEFT(res_pil,3)="— ("),OR(LEFT(res_lig,2)="OK",LEFT(res_lig,3)="— ("),OR(LEFT(res_cin,2)="OK",LEFT(res_cin,3)="— ("),OR(LEFT(res_cmc,2)="OK",LEFT(res_cmc,3)="— (")),"OK","NÃO OK"))',
   '', 'Dados, painéis, pilarete, ligação no arrimo, cinta do topo do arrimo e cintas do muro de cima (seção 9). Vai para as verificações do balanço e do contraforte.', 'key', None, 'res_mc')
r += 1
# ---------- 8. momentos resistentes e esforços ao longo da altura (15/11, vista "Esforços") ----------
# No FIM da aba: nada acima muda de lugar. As contas das seções 4 a 6 desfeitas com o aço adotado (mrd_ret,
# build_new.py), cada uma com o limite que a verificação dela usa: pilarete e ligação conferem x/d ≤ 0,45; a cinta do
# topo não confere (fim da conta, 1,25d). γf: Md_pil = γf·Mk_pil; a cinta soma Md_cin (γf) e Mde_cin (Libânio, já de
# cálculo); os painéis já vêm com fd = γf·C·q.
section(MC, r, '8. Momentos resistentes com a armadura adotada e esforços ao longo da altura (diagrama de momentos)'); r += 1
_conc = 'LEFT(pil_tipo,4)="Conc"'
MC.cell(row=r, column=1, value='Pilarete (seção 5): concreto NBR 6118 ou bloco grauteado NBR 16868-1').font = fB; r += 1
mrd_ret(Lm, 'pil', 'As_pile', 'fyd_pil', f'IF({_conc},0.68*fcd_pil,0.8*Kfd_pil)', f'IF({_conc},0.425*fcd_pil,0.5*Kfd_pil)',
        'b_pila', 'd_pil', '0.45', 'LEFT(pil_tipo,4)<>"Conc"', '0,45·d (ductilidade)')
Lm('MRd do pilarete', '=IFERROR(MRf_pil/100,"—")', 'kN·m', 'Compara com o Md do pilarete (seção 5). Uma face (o vento vem dos dois lados).', 'key', '0.00', 'MRd_pil', 'NBR 6118 17.2.2 / NBR 16868-1 11.3 (conta invertida)')
Lm('MSd/MRd do pilarete', '=IFERROR(Md_pil/MRd_pil,"—")', '', '', 'key', '0.000', 'ap_pil')
MC.cell(row=r, column=1, value='Ligação do pilarete no arrimo (seção 5b)').font = fB; r += 1
mrd_ret(Lm, 'lig', 'As_pile', 'fyd_pil', '0.8*Kfd_lig', '0.5*Kfd_lig', 'b_lig', 'd_lig', '0.45', True, '0,45·d (ductilidade)')
Lm('MRd da ligação', '=IFERROR(MRf_lig/100,"—")', 'kN·m', 'Compara com o Md do pilarete.', 'key', '0.00', 'MRd_lig', 'NBR 16868-1 11.3 (conta invertida)')
Lm('MSd/MRd da ligação', '=IFERROR(Md_pil/MRd_lig,"—")', '', '', 'key', '0.000', 'ap_lig')
MC.cell(row=r, column=1, value='Cinta do topo do arrimo (seção 6): a seção da barra horizontal do painel (aba Contrafortes, seção 16)').font = fB; r += 1
Lm('MSd da canaleta do topo = Md do vento + Md do empuxo', '=Md_cin+Mde_cin', 'kN·cm', 'Na faixa s da canaleta.', 'key', '0.0', 'Msd_cin')
Lm('MRd da canaleta do topo (na faixa s)', '=IFERROR(IF(Tipo_muro="Contrafortes",MRf_ph,"—"),"—")', 'kN·cm', 'Mesma faixa, d, K·fd e uma barra Ø horizontal: o MRd da faixa da aba Contrafortes.', 'key', '0.0', 'MRd_cin', 'NBR 16868-1 11.3 (conta invertida)')
Lm('MSd/MRd da canaleta do topo', '=IFERROR(Msd_cin/MRd_cin,"—")', '', '', 'key', '0.000', 'ap_cin')
MC.cell(row=r, column=1, value='Painéis do muro de cima (seção 4): resistência como momento, MRd = ftd·W (por metro, sem pré-compressão)').font = fB; r += 1
for k, desc in (('A', 'de baixo'), ('B', 'de cima')):
    Lm(f'Painel {desc}: MRd,par = ftd∥·W', '=ftdp_mc*W_mc*1000', 'kN·m/m', 'Compara com o Md,par do painel.', 'key', '0.0000', f'MRp_p{k}')
    Lm(f'Painel {desc}: MRd,nor = ftd⊥·W', '=ftdn_mc*W_mc*1000', 'kN·m/m', 'Compara com o Md,nor do painel.', 'key', '0.0000', f'MRn_p{k}')
    Lm(f'Painel {desc}: Md,par/MRd,par', f'=Mpa_p{k}/MRp_p{k}', '', '', 'res', '0.000', f'ap_pp{k}')
    Lm(f'Painel {desc}: Md,nor/MRd,nor', f'=Mno_p{k}/MRn_p{k}', '', '', 'res', '0.000', f'ap_np{k}')
r += 1
# ---- VENTO AO LONGO DA ALTURA DO ARRIMO: 11 nós, do topo do muro (nó 0) à base (nó 10), y = altura acima da base ----
# O vento é uniforme (p_w) na altura livre (do topo do solo ao topo do muro de cima). Num ponto y do arrimo:
#   balanço (por metro):  y ≤ h solo: Mw = Vk_w·(h solo + h livre/2 − y), Vw = Vk_w   (toda a carga está acima)
#                         y > h solo: Mw = p_w·(h solo + h livre − y)²/2, Vw = p_w·(h solo + h livre − y)
#   contraforte:          Mwc = F_wpc·(h muro + h mc/2 − y) + [y ≤ h solo: F_wec·(h solo + h exp/2 − y);
#                         y > h solo: p_w·binf·(h muro − y)²/2]  (o do muro de cima chega inteiro no topo do contraforte)
# Na base (y = 0) Mw = Mk_w e Mwc = Mk_wcf, bit a bit (as mesmas operações). De cálculo: × γf (colunas I–K). Dentro do
# solo o perfil de Solo e Empuxo (colunas O–Z) já soma o vento ao empuxo; esta tabela serve à parte ACIMA do solo e ao
# vento como parcela própria.
_CF = 'Tipo_muro="Contrafortes"'
MC.cell(row=r, column=1, value='Vento ao longo da altura do arrimo (característico; × γf nas três últimas colunas)').font = fB; r += 1
header(MC, r, ['Nó', 'y acima da base (m)', 'M vento — balanço (kN·m/m)', 'V vento — balanço (kN/m)', 'M vento — contraforte (kN·m)',
               'V vento — contraforte (kN)', 'M vento — outro contraforte (kN·m)', 'V vento — outro contraforte (kN)',
               'MSd vento — balanço', 'MSd vento — contraforte', 'MSd vento — outro contraforte']); r += 1
_v0 = r
_ie = lambda f: '=IFERROR(' + f + ',"—")'
for j in range(11):
    MC.cell(row=r, column=1, value=j)
    MC[f'B{r}'] = _ie(f'H_muro*(10-A{r})/10')
    MC[f'C{r}'] = _ie(f'IF(B{r}<=H_solo,Vk_w*(H_solo+h_liv/2-B{r}),p_w*(H_solo+h_liv-B{r})^2/2)')
    MC[f'D{r}'] = _ie(f'IF(B{r}<=H_solo,Vk_w,p_w*(H_solo+h_liv-B{r}))')
    for cM, cV, Fp, Fe, bi in (('E', 'F', 'F_wpc', 'F_wec', 'binf'), ('G', 'H', 'Fpo_cf', 'Feo_cf', 'binf_o')):
        MC[f'{cM}{r}'] = _ie(f'{Fp}*(H_muro+h_mce/2-B{r})+IF(B{r}<=H_solo,{Fe}*(H_solo+h_exp/2-B{r}),IF({_CF},p_w*{bi}*(H_muro-B{r})^2/2,0))')
        MC[f'{cV}{r}'] = _ie(f'{Fp}+IF(B{r}<=H_solo,{Fe},IF({_CF},p_w*{bi}*(H_muro-B{r}),0))')
    MC[f'I{r}'] = _ie(f'gama_f*C{r}'); MC[f'J{r}'] = _ie(f'gama_f*E{r}'); MC[f'K{r}'] = _ie(f'gama_f*G{r}')
    # (15/11, 2ª versão da vista Esforços) cortante de cálculo e o As necessário em cada nó — acima do solo o vento é a
    # única carga, e o diagrama do aço precisa da conta lá em cima também (a do perfil do solo para no topo do solo).
    # Mesmas contas das abas (build_new.py, cadeias_da_haste), colunas O em diante; L–N = γf·V.
    MC[f'L{r}'] = _ie(f'gama_f*D{r}'); MC[f'M{r}'] = _ie(f'gama_f*F{r}'); MC[f'N{r}'] = _ie(f'gama_f*H{r}')
    _cv = cadeias_da_haste(MC, r, 15, f'I{r}', f'J{r}', f'K{r}', f'M{r}', f'N{r}')
    for cc in 'ABCDEFGHIJKLMN':
        c = MC[f'{cc}{r}']; c.font = fN; c.border = BOX; c.fill = RES
        if cc != 'A': c.number_format = '0.000'
    r += 1
header(MC, _v0 - 1, ['VSd vento — balanço', 'VSd vento — contraforte', 'VSd vento — outro contraforte'] + ROTULOS_DA_HASTE, start=12)
for _nm, _cc in (('vt_y', 'B'), ('vt_Mw', 'C'), ('vt_Vw', 'D'), ('vt_Mc', 'E'), ('vt_Vc', 'F'), ('vt_Mo', 'G'),
                 ('vt_Vo', 'H'), ('vt_Md', 'I'), ('vt_Mdc', 'J'), ('vt_Mdo', 'K'), ('vt_Vd', 'L'), ('vt_Vdc', 'M'), ('vt_Vdo', 'N'),
                 ('vt_As', _cv[0]), ('vt_Asc', _cv[1]), ('vt_Aso', _cv[2]), ('vt_Aswc', _cv[3]), ('vt_Aswo', _cv[4])):
    wb.defined_names[_nm] = DefinedName(_nm, attr_text=f"'Muro de cima e vento'!${_cc}${_v0}:${_cc}${r-1}")
r += 1
# ---- PILARETE AO LONGO DA ALTURA: 11 nós, do topo do muro de cima (nó 0) ao topo do arrimo (nó 10, a base dele) ----
# Balanço engastado, vento uniforme p_w·eixo a eixo: com ρ = (h mc − y)/h mc (y acima do topo do arrimo),
#   M = Mk_pil·ρ·ρ, V = Vk_pil·ρ — na base ρ = h/h = 1 e M = Mk_pil, bit a bit (ρ·ρ e não ρ², para não passar pela potência). De cálculo: × γf (= Md_pil na base).
MC.cell(row=r, column=1, value='Pilarete ao longo da altura (do topo do muro de cima à base, no topo do arrimo)').font = fB; r += 1
header(MC, r, ['Nó', 'y acima do topo do arrimo (m)', 'Mk (kN·m)', 'Vk (kN)', 'MSd = γf·Mk (kN·m)', 'VSd = γf·Vk (kN)']); r += 1
_p0 = r
for j in range(11):
    MC.cell(row=r, column=1, value=j)
    MC[f'B{r}'] = _ie(f'h_mce*(10-A{r})/10')
    MC[f'C{r}'] = _ie(f'IF(h_mce>0,Mk_pil*((h_mce-B{r})/h_mce)*((h_mce-B{r})/h_mce),0)')
    MC[f'D{r}'] = _ie(f'IF(h_mce>0,Vk_pil*((h_mce-B{r})/h_mce),0)')
    MC[f'E{r}'] = _ie(f'gama_f*C{r}'); MC[f'F{r}'] = _ie(f'gama_f*D{r}')
    # (15/11, vista Esforços) x e As do momento no nó: a conta da seção 5 (concreto NBR 6118 ou bloco grauteado), com o
    # Md do nó; na base = Asc_pil / Asb_pil (o As sem o mínimo, como o As,nec das outras peças)
    MC[f'G{r}'] = _ie(f'IF({_concreto},IFERROR(1.25*d_pil*(1-SQRT(1-E{r}*100/(0.425*b_pila*d_pil^2*fcd_pil/10))),"não resiste"),'
                      f'IFERROR(1.25*d_pil*(1-SQRT(1-E{r}*100/(0.5*b_pila*d_pil^2*Kfd_pil/10))),"não resiste"))')
    MC[f'H{r}'] = _ie(f'IF({_concreto},IFERROR(E{r}*100/(fyd_pil/10*(d_pil-0.4*G{r})),"—"),IFERROR(E{r}*100/(fyd_pil/10*MIN(d_pil-0.4*G{r},0.95*d_pil)),"—"))')
    for cc in 'ABCDEFGH':
        c = MC[f'{cc}{r}']; c.font = fN; c.border = BOX; c.fill = RES
        if cc != 'A': c.number_format = '0.000'
    r += 1
header(MC, _p0 - 1, ['x (cm)', 'As do momento (cm²)'], start=7)
for _nm, _cc in (('pt_y', 'B'), ('pt_Mk', 'C'), ('pt_Vk', 'D'), ('pt_Md', 'E'), ('pt_Vd', 'F'), ('pt_As', 'H')):
    wb.defined_names[_nm] = DefinedName(_nm, attr_text=f"'Muro de cima e vento'!${_cc}${_p0}:${_cc}${r-1}")
r += 1

# ---------- 9. CINTAS DO MURO DE CIMA (15/11) ----------
# Jose: "verificação da cinta e da armadura mínima… provavelmente ela sofre flexão no plano e fora do plano — no
# sentido da gravidade e na lateral — mas é uma flexão baixíssima, vai dar armadura mínima, eu acho. Mas vamos
# verificar." No FIM da aba: nada acima muda de lugar nem de valor (o res_mc só ganha o resumo daqui).
# Modelo (DEDUÇÃO, a favor da segurança em cada escolha):
#   - cinta de concreto de 20 cm de altura × espessura do muro de cima, BIAPOIADA entre pilaretes, vão = o eixo a
#     eixo (l_mc, o mesmo dos painéis). Ela é contínua no trecho (as barras passam pelos pilaretes), mas o vão
#     biapoiado dá o maior momento de vão e o apoio da ponta sem momento — o que se verifica na ancoragem;
#   - LATERAL (fora do plano): o vento da ESTRUTURA (p_w, S3 da estrutura — a cinta é peça estrutural, "vedação é
#     vedação, estrutura é estrutura") na metade de cada painel que se apoia nela. Cinta do topo: metade do painel de
#     baixo dela. Cinta de meia altura: metade do painel de baixo + metade do de cima (com cinta no topo) ou o painel
#     de cima INTEIRO (topo livre: a borda livre não leva nada, a cinta leva tudo — mais que a placa daria);
#   - GRAVIDADE (no plano): peso da cinta (concreto + reboco) + a alvenaria apoiada nela até a próxima cinta ou o
#     topo, sem o efeito de arco e sem a ajuda da alvenaria de baixo (a parede de baixo apoia a cinta de verdade);
#   - as duas flexões juntas: interação LINEAR Md,lat/MRd,lat + Md,grav/MRd,grav ≤ 1 (a favor: a seção resiste mais
#     que isso na flexão oblíqua); cortante sem estribo pela NBR 6118 19.4.1, como a sapata e o dente;
#   - concreto: o do pilarete (fck_pil). A cinta é concretada junto com os pilaretes; com pilarete de bloco a
#     cinta continua de concreto e a mesma entrada vale para ela (a linha se chama "Pilarete e cintas: concreto").
# Barras (o que o app desenha): eixo a 3 cm das faces; 2 barras = uma em cada face, no meio da altura (d da
# gravidade = 10 cm — a conta usa o d de verdade, não o de uma barra embaixo); 4 barras = duas em cada face, em cima
# e embaixo (d da gravidade = 17 cm). Em branco, 4 só quando 2 não passam na flexão. Se a barra da cinta cairia em
# cima de uma barra do pilarete (a mesma distância do eixo do muro), ela entra o suficiente para passar ao lado —
# por dentro da gaiola do pilarete, como a barra de viga por dentro da de pilar — e o d sai com esse lugar.
section(MC, r, '9. Cintas do muro de cima (concreto, biapoiadas entre pilaretes)'); r += 1
_C = 'Tipo_muro="Contrafortes"'
Lm('Cintas verificadas', '=IF(mc_on<>"Sim","— (sem muro de cima)",IF(cin_mc="Nenhuma","— (sem cintas)",cin_mc))', '', '', 'key')
Lm('Altura da cinta', 20, 'cm', 'Uma fiada (o app desenha a cinta no lugar de uma fiada de tijolo).', 'res', '0.0', 'hc_cmc')
Lm('Largura da cinta = espessura do muro de cima', '=t_mc', 'cm', '', 'res', '0.0', 'tc_cmc')
Lm('Vão = eixo a eixo dos pilaretes', '=l_mc', 'm', 'Biapoiada (dedução, a favor).', 'res', '0.00', 'l_cmc')
Lm('fck (o do pilarete)', '=VALUE(MID(fck_pil,2,2))', 'MPa', 'Entrada "Pilarete e cintas: concreto".', 'res', '0', 'fck_cmc')
Lm('fcd = fck/1,4', '=fck_cmc/1.4', 'MPa', '', 'res', '0.00', 'fcd_cmc', 'NBR 6118 12.3.3')
Lm('fctd = 0,21·fck^(2/3)/1,4', '=0.21*fck_cmc^(2/3)/1.4', 'MPa', '', 'res', '0.000', 'fctd_cmc', 'NBR 6118 8.2.5')
Lm('fyd', '=fyk_/gama_s', 'MPa', '', 'res', '0.0', 'fyd_cmc')
Lm('As de uma barra', '=PI()*phi_cin_mc^2/400', 'cm²', '', 'res', '0.000', 'As1_cmc')
Lm('As,mín = 0,15%·b·h (as duas direções: 20 × t)', '=0.0015*hc_cmc*tc_cmc', 'cm²', 'NBR 6118 Tab. 17.3 (fck ≤ 30), o critério da sapata.', 'res', '0.000', 'Asm_cmc', 'NBR 6118 17.3.5.2.1')
# Onde a barra da cinta passa: a 3 cm da face, ou mais para dentro se ali já tem barra do pilarete. Distâncias ao
# EIXO do muro (o muro de cima é centrado no arrimo). Barra do pilarete: balanço — centrado, h/2 − c do eixo;
# contrafortes — rente a uma face do arrimo (enterrado ou aparente, espelho): |c − t/2| e |h − c − t/2|.
Lm('Barra do pilarete mais longe do eixo do muro', '=IF(' + _C + ',MAX(ABS(ce_pil-t_bloco/2),ABS(hs_pila-ce_pil-t_bloco/2)),hs_pila/2-ce_pil)', 'cm', '', 'res', '0.00', 'pp1_cmc')
Lm('Barra do pilarete mais perto do eixo do muro', '=IF(' + _C + ',MIN(ABS(ce_pil-t_bloco/2),ABS(hs_pila-ce_pil-t_bloco/2)),hs_pila/2-ce_pil)', 'cm', '', 'res', '0.00', 'pp2_cmc')
Lm('Distância mínima entre eixos (barra da cinta × do pilarete)', '=(phi_cin_mc+phi_pil)/20', 'cm', 'As duas se encostam, não se cortam.', 'res', '0.00', 'sc_cmc')
Lm('Barra da cinta a 3 cm da face: distância ao eixo', '=tc_cmc/2-3', 'cm', '', 'res', '0.00', 'a0_cmc')
Lm('… depois da barra do pilarete de fora', '=IF(ABS(a0_cmc-pp1_cmc)<sc_cmc,pp1_cmc-sc_cmc,a0_cmc)', 'cm', 'Cai em cima dela: passa por dentro, encostada.', 'res', '0.00', 'a1_cmc')
Lm('Distância da barra da cinta ao eixo do muro', '=IF(ABS(a1_cmc-pp2_cmc)<sc_cmc,pp2_cmc-sc_cmc,a1_cmc)', 'cm', '', 'res', '0.00', 'ac_cmc')
Lm('Eixo da barra da cinta à face', '=tc_cmc/2-ac_cmc', 'cm', 'O que o app desenha nas duas faces.', 'key', '0.00', 'ce_cmc')
Lm('Mínimo ao eixo: φ/2 (as barras das duas faces não se encostam)', '=phi_cin_mc/20', 'cm', '', 'res', '0.00', 'acm_cmc')
r += 1
_K = (('T', 'do topo', 'OR(cin_mc="No topo",cin_mc="No topo e a meia altura")'),
      ('M', 'de meia altura', 'OR(cin_mc="A meia altura",cin_mc="No topo e a meia altura")'))
for k, desc, cond in _K:
    MC.cell(row=r, column=1, value=f'Cinta {desc}: cargas e esforços').font = fB; r += 1
    Lm(f'Cinta {desc} existe?', f'=IF(AND(mc_on="Sim",{cond}),"Sim","Não")', '', '', 'res', None, f'on_c{k}')
    if k == 'T':
        Lm('Altura de painel que se apoia nela (lateral)', '=IF(on_cT="Sim",IF(pnB_on="Sim",h_pB,h_pA)/2,0)', 'm', 'Metade do painel de baixo dela.', 'res', '0.00', 'ht_cT')
        Lm('Alvenaria apoiada nela', '=0', 'm', 'Nada acima: ela é o topo.', 'res', '0.00', 'hm_cT')
    else:
        Lm('Altura de painel que se apoia nela (lateral)', '=IF(on_cM="Sim",h_pA/2+IF(cin_mc="No topo e a meia altura",h_pB/2,h_pB),0)', 'm',
           'Metade do painel de baixo + metade do de cima (com cinta no topo) ou o de cima inteiro (topo livre).', 'res', '0.00', 'ht_cM')
        Lm('Alvenaria apoiada nela', '=IF(on_cM="Sim",h_pB-IF(cin_mc="No topo e a meia altura",hc_cmc/100,0),0)', 'm', 'Até a cinta do topo ou o topo do muro.', 'res', '0.00', 'hm_cM')
    Lm('Carga lateral = C·q (estrutura)·altura', f'=IF(on_c{k}="Sim",p_w*ht_c{k},0)', 'kN/m', 'Característica.', 'res', '0.000', f'wl_c{k}')
    Lm('Carga de gravidade = (γc·t + reboco)·0,20 + parede·altura', f'=IF(on_c{k}="Sim",(gama_c*tc_cmc/100+g_mcr)*hc_cmc/100+g_mct*hm_c{k},0)', 'kN/m', 'Característica.', 'res', '0.000', f'wg_c{k}')
    Lm('Md lateral = γf·w·l²/8', f'=gama_f*wl_c{k}*l_cmc^2/8', 'kN·m', '', 'key', '0.000', f'Mdl_c{k}')
    Lm('Vd lateral = γf·w·l/2', f'=gama_f*wl_c{k}*l_cmc/2', 'kN', '', 'res', '0.000', f'Vdl_c{k}')
    Lm('Md de gravidade = γf·w·l²/8', f'=gama_f*wg_c{k}*l_cmc^2/8', 'kN·m', '', 'key', '0.000', f'Mdg_c{k}')
    Lm('Vd de gravidade = γf·w·l/2', f'=gama_f*wg_c{k}*l_cmc/2', 'kN', '', 'res', '0.000', f'Vdg_c{k}')
r += 1
# Em branco, a quantidade de barras é 2 quando 2 passam na flexão, senão 4. "Passa" = As,mín e a interação com o MRd
# de 2 barras (MSd ≤ MRd com x ≤ 0,45d já garante As e ductilidade). A conta de 2 barras é a do MRd adotado, numa
# linha só; a quantidade é uma para as duas cintas (o mesmo detalhe).
MC.cell(row=r, column=1, value='Quantidade de barras (2 ou 4)').font = fB; r += 1
Lm('d lateral = t − eixo à face', '=tc_cmc-ce_cmc', 'cm', 'O vento vem dos dois lados: a mesma conta nas duas faces.', 'res', '0.00', 'dl_cmc')
_MR2 = lambda As, b, d: (f'IF({As}*fyd_cmc/10/(0.68*fcd_cmc/10*{b})<=0.45*{d},{As}*fyd_cmc/10*({d}-0.4*{As}*fyd_cmc/10/(0.68*fcd_cmc/10*{b})),'
                         f'0.68*fcd_cmc/10*{b}*0.45*{d}*({d}-0.4*0.45*{d}))')
Lm('Com 2 barras: MRd lateral (1 barra na face, b = 20)', '=' + _MR2('As1_cmc', 'hc_cmc', 'dl_cmc') + '/100', 'kN·m', 'F = As·fyd = 0,68·fcd·b·x; M = F·(d − 0,4x); x ≤ 0,45d.', 'res', '0.000', 'M2l_cmc', 'NBR 6118 17.2.2')
Lm('Com 2 barras: MRd de gravidade (as 2 no meio da altura, d = 10)', '=' + _MR2('2*As1_cmc', 'tc_cmc', 'hc_cmc/2') + '/100', 'kN·m', '', 'res', '0.000', 'M2g_cmc', 'NBR 6118 17.2.2')
for k, desc, _ in _K:
    Lm(f'Cinta {desc}: 2 barras passam?', f'=IF(on_c{k}<>"Sim","Sim",IF(AND(As1_cmc>=Asm_cmc,Mdl_c{k}/M2l_cmc+Mdg_c{k}/M2g_cmc<=1),"Sim","Não"))', '', 'As,mín e Md,lat/MRd,lat + Md,grav/MRd,grav ≤ 1.', 'res', None, f't2_c{k}')
Lm('Barras da cinta (adotado)', '=IF(ISNUMBER(n_cin_mc),n_cin_mc,IF(AND(t2_cT="Sim",t2_cM="Sim"),2,4))', '', 'Digitado nas Entradas ou o automático. O app desenha esta quantidade.', 'key', '0', 'n_cin_a')
Lm('d de gravidade', '=IF(n_cin_a=4,hc_cmc-3,hc_cmc/2)', 'cm', '4 barras: a camada de baixo; 2 barras: as do meio da altura.', 'res', '0.00', 'dg_cmc')
Lm('As lateral (uma face)', '=n_cin_a/2*As1_cmc', 'cm²', '', 'res', '0.000', 'Asl_cmc')
Lm('As de gravidade (tracionada, embaixo)', '=2*As1_cmc', 'cm²', '', 'res', '0.000', 'Asg_cmc')
r += 1
MC.cell(row=r, column=1, value='Momento resistente com as barras adotadas (NBR 6118 17.2.2, conta do As desfeita)').font = fB; r += 1
mrd_ret(Lm, 'cml', 'Asl_cmc', 'fyd_cmc', '0.68*fcd_cmc', '0.425*fcd_cmc', 'hc_cmc', 'dl_cmc', '0.45', False, '0,45·d (ductilidade)')
Lm('MRd lateral', '=IFERROR(MRf_cml/100,"—")', 'kN·m', 'Seção 20 × t, uma face tracionada.', 'key', '0.000', 'MRdl_cmc', 'NBR 6118 17.2.2 (conta invertida)')
mrd_ret(Lm, 'cmg', 'Asg_cmc', 'fyd_cmc', '0.68*fcd_cmc', '0.425*fcd_cmc', 'tc_cmc', 'dg_cmc', '0.45', False, '0,45·d (ductilidade)')
Lm('MRd de gravidade', '=IFERROR(MRf_cmg/100,"—")', 'kN·m', 'Seção t × 20, tração embaixo.', 'key', '0.000', 'MRdg_cmc', 'NBR 6118 17.2.2 (conta invertida)')
# Cortante sem estribo como a sapata (NBR 6118 19.4.1, a de laje): a cinta não leva estribo (DEDUÇÃO).
for k_, desc_, b_, d_, As_ in (('l', 'lateral', 'hc_cmc', 'dl_cmc', 'Asl_cmc'), ('g', 'de gravidade', 'tc_cmc', 'dg_cmc', 'Asg_cmc')):
    Lm(f'k {desc_} = 1,6 − d ≥ 1', f'=MAX(1,1.6-{d_}/100)', '', '', 'res', '0.000', f'k{k_}_cmc')
    Lm(f'ρ1 {desc_} = As/(b·d) ≤ 2%', f'=MIN(0.02,{As_}/({b_}*{d_}))', '', '', 'res', '0.0000', f'rho{k_}_cmc')
    Lm(f'VRd1 {desc_} = 0,25·fctd·k·(1,2 + 40ρ1)·b·d', f'=0.25*fctd_cmc/10*k{k_}_cmc*(1.2+40*rho{k_}_cmc)*{b_}*{d_}', 'kN', 'Sem estribo, como a sapata (dedução).', 'key', '0.00', f'VR1{k_}_cmc', 'NBR 6118 19.4.1')
r += 1
# Ancoragem na ponta do trecho: as barras são corridas e só terminam no PILARETE DA PONTA, que é o apoio extremo da
# viga biapoiada. A força a ancorar no apoio é R = (aℓ/d)·Vd com aℓ = 1,5d (peça sem armadura de cortante — DEDUÇÃO
# da regra da laje), NBR 6118 18.3.2.4: As,calc = 1,5·Vd/fyd, somando lateral e gravidade na mesma barra (com 2
# barras a mesma barra leva as duas; com 4, a de baixo da face tracionada leva metade de cada — a soma das razões é a
# mesma). Reta (α = 1) com a ponta a 3 cm da face de fora do pilarete; se não cabe, gancho de 90° descendo no
# pilarete (α = 0,7), com a perna por dentro do estribo dele. O ℓb,mín vale nos dois.
MC.cell(row=r, column=1, value='Ancoragem no pilarete da ponta').font = fB; r += 1
Lm('fbd = 2,25·η2·η3·fctd', '=2.25*fctd_cmc', 'MPa', 'η1 = 2,25 (nervurada); η2 = 1,0 (boa aderência: peça de 20 cm); η3 = 1,0.', 'res', '0.000', 'fbd_cmc', 'NBR 6118 9.3.2.1')
Lm('ℓb = φ/4·fyd/fbd', '=fyd_cmc/(4*fbd_cmc)*phi_cin_mc/10', 'cm', '', 'res', '0.0', 'lb_cmc', 'NBR 6118 9.4.2.4')
Lm('ℓb,mín = máx(0,3·ℓb; 10φ; 10 cm)', '=MAX(0.3*lb_cmc,phi_cin_mc,10)', 'cm', '10φ em cm = φ em mm.', 'res', '0.0', 'lbm_cmc', 'NBR 6118 9.4.2.5')
Lm('Reta: comprimento dentro do pilarete', '=b_pila-3', 'cm', 'Da face de dentro à ponta, a 3 cm da face de fora.', 'res', '0.0', 'ldr_cmc')
Lm('Gancho: eixo da perna à face de fora', '=MAX(3,ce_pil-phi_pil/20+phi_cin_mc/20)', 'cm', 'Por dentro do estribo do pilarete.', 'res', '0.00', 'cg_cmc')
Lm('Gancho: reto até a dobra', '=IF(AND(n_cin_a=4,12*phi_cin_mc>(hc_cmc-6)*10),0,b_pila-cg_cmc-0.3*phi_cin_mc)', 'cm',
   'Dobra no pino 5φ (raio no eixo 3φ). Com 4 barras a perna de cima desce até a barra de baixo: só cabe com 12φ ≤ h − 6 cm.', 'res', '0.0', 'ldg_cmc', 'NBR 6118 Tab. 9.1')
for k, desc, _ in _K:
    MC.cell(row=r, column=1, value=f'Cinta {desc}: verificação').font = fB; r += 1
    Lm('x lateral', f'=IFERROR(1.25*dl_cmc*(1-SQRT(1-Mdl_c{k}*100/(0.425*hc_cmc*dl_cmc^2*fcd_cmc/10))),"não resiste")', 'cm', 'b = 20.', 'res', '0.00', f'xl_c{k}', 'NBR 6118 17.2.2')
    Lm('As lateral = Md/(fyd·(d − 0,4x))', f'=IFERROR(Mdl_c{k}*100/(fyd_cmc/10*(dl_cmc-0.4*xl_c{k})),"não resiste")', 'cm²', '', 'res', '0.000', f'Aslc_c{k}')
    Lm('x de gravidade', f'=IFERROR(1.25*dg_cmc*(1-SQRT(1-Mdg_c{k}*100/(0.425*tc_cmc*dg_cmc^2*fcd_cmc/10))),"não resiste")', 'cm', 'b = t.', 'res', '0.00', f'xg_c{k}', 'NBR 6118 17.2.2')
    Lm('As de gravidade = Md/(fyd·(d − 0,4x))', f'=IFERROR(Mdg_c{k}*100/(fyd_cmc/10*(dg_cmc-0.4*xg_c{k})),"não resiste")', 'cm²', '', 'res', '0.000', f'Asgc_c{k}')
    # o necessário de cada direção e o x/d como célula: a memória compara com eles (não refaz a conta)
    Lm('As lateral necessária = máx(As; As,mín)', f'=IF(ISNUMBER(Aslc_c{k}),MAX(Aslc_c{k},Asm_cmc),"não resiste")', 'cm²', '', 'res', '0.000', f'Asln_c{k}')
    Lm('As de gravidade necessária = máx(As; As,mín)', f'=IF(ISNUMBER(Asgc_c{k}),MAX(Asgc_c{k},Asm_cmc),"não resiste")', 'cm²', '', 'res', '0.000', f'Asgn_c{k}')
    Lm('x/d lateral', f'=xl_c{k}/dl_cmc', '', '≤ 0,45 (ductilidade).', 'res', '0.000', f'xdl_c{k}', 'NBR 6118 14.6.4.3')
    Lm('x/d de gravidade', f'=xg_c{k}/dg_cmc', '', '≤ 0,45 (ductilidade).', 'res', '0.000', f'xdg_c{k}', 'NBR 6118 14.6.4.3')
    Lm('Md,lat/MRd,lat', f'=Mdl_c{k}/MRdl_cmc', '', '', 'key', '0.000', f'apl_c{k}')
    Lm('Md,grav/MRd,grav', f'=Mdg_c{k}/MRdg_cmc', '', '', 'key', '0.000', f'apg_c{k}')
    Lm('Interação: Md,lat/MRd,lat + Md,grav/MRd,grav', f'=apl_c{k}+apg_c{k}', '', '≤ 1 (linear, a favor).', 'key', '0.000', f'ap_c{k}')
    Lm('As,calc/As,ef no apoio = 1,5·Vd/fyd/As (lateral + gravidade)', f'=MIN(1,1.5*Vdl_c{k}/(fyd_cmc/10)/Asl_cmc+1.5*Vdg_c{k}/(fyd_cmc/10)/Asg_cmc)', '', 'aℓ = 1,5d (dedução).', 'res', '0.000', f'ra_c{k}', 'NBR 6118 18.3.2.4')
    Lm('ℓb,nec reta = ℓb·As,calc/As,ef ≥ ℓb,mín', f'=MAX(lb_cmc*ra_c{k},lbm_cmc)', 'cm', 'α = 1.', 'res', '0.0', f'lbr_c{k}', 'NBR 6118 9.4.2.5')
    Lm('ℓb,nec com gancho = 0,7·ℓb·As,calc/As,ef ≥ ℓb,mín', f'=MAX(0.7*lb_cmc*ra_c{k},lbm_cmc)', 'cm', 'α = 0,7.', 'res', '0.0', f'lbg_c{k}', 'NBR 6118 9.4.2.5')
    Lm('Ancoragem no pilarete da ponta', f'=IF(on_c{k}<>"Sim","— (sem cinta)",IF(lbr_c{k}<=ldr_cmc,"Reta",IF(lbg_c{k}<=ldg_cmc,"Gancho","Não cabe")))', '',
       'Reta; gancho de 90° descendo no pilarete; ou não cabe. O app desenha a que vale.', 'key', None, f'anc_c{k}')
    _q = f'NÃO OK — cinta {desc}: '
    Lm(f'Cinta {desc}: resumo',
       f'=IF(on_c{k}<>"Sim","— (sem cinta {desc})",'
       f'IF(ac_cmc<acm_cmc,"{_q}as barras não cabem entre as do pilarete",'
       f'IF(OR(ISNUMBER(xl_c{k})=FALSE,ISNUMBER(xg_c{k})=FALSE),"{_q}a seção não resiste: Ø maior ou 4 barras",'
       f'IF(MAX(xl_c{k}/dl_cmc,xg_c{k}/dg_cmc)>0.45,"{_q}x/d > 0,45",'
       f'IF(Asl_cmc<MAX(Aslc_c{k},Asm_cmc),"{_q}lateral, As "&FIXED(Asl_cmc,2)&" < "&FIXED(MAX(Aslc_c{k},Asm_cmc),2)&" cm²",'
       f'IF(Asg_cmc<MAX(Asgc_c{k},Asm_cmc),"{_q}gravidade, As "&FIXED(Asg_cmc,2)&" < "&FIXED(MAX(Asgc_c{k},Asm_cmc),2)&" cm²",'
       f'IF(ap_c{k}>1,"{_q}flexão nas duas direções "&FIXED(ap_c{k},2)&" > 1",'
       f'IF(Vdl_c{k}>VR1l_cmc,"{_q}cortante lateral "&FIXED(Vdl_c{k},2)&" > "&FIXED(VR1l_cmc,2)&" kN",'
       f'IF(Vdg_c{k}>VR1g_cmc,"{_q}cortante de gravidade "&FIXED(Vdg_c{k},2)&" > "&FIXED(VR1g_cmc,2)&" kN",'
       f'IF(anc_c{k}="Não cabe","{_q}ancoragem no pilarete da ponta "&FIXED(lbg_c{k},1)&" > "&FIXED(MAX(ldr_cmc,ldg_cmc),1)&" cm: pilarete mais largo ou Ø menor",'
       f'"OK (flexão "&FIXED(100*ap_c{k},0)&"%; ancoragem "&IF(anc_c{k}="Reta","reta","com gancho")&")"))))))))))',
       '', 'Flexão nas duas direções, As,mín, interação, cortante e ancoragem.', 'key', None, f'res_c{k}')
r += 1
Lm('Cintas do muro de cima: resumo',
   '=IF(mc_on<>"Sim","— (sem muro de cima)",IF(cin_mc="Nenhuma","— (sem cintas)",IF(LEFT(res_cT,2)="NÃ",res_cT,IF(LEFT(res_cM,2)="NÃ",res_cM,'
   'IF(AND(OR(LEFT(res_cT,2)="OK",LEFT(res_cT,3)="— ("),OR(LEFT(res_cM,2)="OK",LEFT(res_cM,3)="— (")),"OK","NÃO OK — a conta da cinta não fechou")))))',
   '', 'Vai para o resumo do muro de cima (res_mc).', 'key', None, 'res_cmc')
r += 1
# ---------- 10. o que o diagrama do aço precisa (15/11, 2ª versão da vista "Esforços") ----------
# No FIM da aba (nada acima muda de lugar). As resistências ao cortante que os resumos das seções 5 e 5b comparam,
# escritas como força, e o As,mín que a seção 5 usa — os números com que o diagrama envolve o solicitante.
section(MC, r, '10. Resistências e mínimos para o diagrama do aço (vista Esforços)'); r += 1
Lm('Pilarete: As,mín usado', f'=IF({_concreto},Asm_pil,Asmb_pil)', 'cm²', 'Concreto: 0,15%·b·h; bloco: 0,15%·b·d (seção 5).', 'res', '0.00', 'Asmu_pil')
Lm('Pilarete: VRd que o resumo compara', f'=IF({_concreto},VR2c_pil,fvd_pil/10*b_pila*d_pil)', 'kN', 'Concreto: VRd2 (biela); bloco: fvd·b·d (τvd ≤ fvd).', 'res', '0.00', 'VRd_pil')
Lm('Ligação: VRd = fvd·b·d', '=fvd_lig/10*b_lig*d_lig', 'kN', 'τvd ≤ fvd da seção 5b, escrito como força.', 'res', '0.00', 'VRd_lig')
r += 1
# ---------- 11. pilarete sobre o contraforte dobrado (16/11) ----------
# O pilarete da conta (b_pila) é o da ponta do muro, sobre o contraforte simples: o mais estreito, com o mesmo Md — a
# favor da segurança. Sobre o contraforte DOBRADO (intermediário) o pilarete tem a largura do PAR (2t + 1): com a
# largura t ele ficava centrado na junta entre os dois blocos e as barras caíam nas paredes dos blocos, sem descer no
# graute (achado da revisão de 16/11, bloco 14). Com 2t + 1 as barras descem no furo de cada bloco. O digitado vale na
# ponta (≤ t, a verificação "Ligação: montagem").
section(MC, r, '11. Pilarete sobre o contraforte dobrado'); r += 1
Lm('Pilarete sobre o dobrado: largura (ao longo do muro)', '=IF(AND(' + CF + ',larg_cf="Dobrado"),2*t_bloco+1,b_pila)', 'cm', 'A largura do par; sem dobrado, a do pilarete.', 'res', '0.0', 'b_pili')
Lm('Ligação sobre o dobrado: largura', '=IF(AND(' + CF + ',larg_cf="Dobrado"),2*t_bloco+1,b_lig)', 'cm', 'A largura do par. A ligação da ponta (b_lig = t) é a que a seção 5b confere: a mais estreita.', 'res', '0.0', 'b_ligi')
widths(MC, {'A': 46, 'B': 22, 'C': 9, 'D': 70, 'E': 18, 'H': 10, 'I': 8, 'J': 8, 'K': 8, 'L': 8})
