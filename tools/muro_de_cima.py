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
Lm('Vk = V0·S1·S2·S3', '=V0_v*S1_v*S2_v*S3_v', 'm/s', '', 'res', '0.00', 'Vk_v', 'NBR 6123 4.2')
Lm('q = 0,613·Vk²', '=0.613*Vk_v^2/1000', 'kN/m²', 'Pressão dinâmica.', 'key', '0.000', 'q_v', 'NBR 6123 4.2')
# Tab. 16 da NBR 6123 (1988, item 8.1), muro sobre o terreno, vento a 90°: Cf = 1,1 com l/h = 1 e 1,2 com l/h ≥ 10
# (e no fluxo bidimensional). O l é o comprimento do muro inteiro, que a planilha não tem — fica o maior, 1,2, que
# vale para qualquer comprimento. A norma avisa que, fora do fluxo bidimensional, o vento OBLÍQUO é o pior (1,5 com
# a força deslocada para a ponta); o Jose decidiu só o perpendicular (13/11). q no topo do muro (8.1).
Lm('Coeficiente de força do muro isolado (sugestão)', 1.2, '', 'Muro sobre o terreno, vento perpendicular: 1,1 (l/h = 1) a 1,2 (l/h ≥ 10). Fica 1,2, que vale para qualquer comprimento.', 'sug', '0.00', 'Cf_sug', 'NBR 6123 8.1, Tab. 16')
Lm('Coeficiente de força usado', '=IF(ISNUMBER(Cf_dir),Cf_dir,Cf_sug)', '', 'Digitado nas Entradas ou a sugestão.', 'res', '0.00', 'Cf_v')
Lm('Pressão do vento no muro = C·q', '=IF(' + ON_V + ',IFERROR(Cf_v*q_v,0),0)', 'kN/m²', 'Característica. Zero sem vento.', 'key', '0.000', 'p_w')
r += 1

section(MC, r, '3. O que vai para o arrimo'); r += 1
Lm('Reboco do muro de cima', '=21*reb_mc_esp/100*IF(reb_mc="Nas duas faces",2,IF(reb_mc="Só na frente",1,0))', 'kN/m²', '21 kN/m³ (NBR 6120, argamassa de cimento e areia) × espessura × faces.', 'res', '0.00', 'g_mcr')
Lm('Parede do muro de cima com reboco', '=g_mc+g_mcr', 'kN/m²', '', 'res', '0.00', 'g_mct')
Lm('Peso específico do pilarete', '=IF(LEFT(pil_tipo,4)="Conc",gama_c,gama_cf_us)', 'kN/m³', 'Concreto: γ do concreto (Fundação). Bloco grauteado: o mesmo γ do contraforte (todos os furos cheios).', 'res', '0.00', 'g_pil')
Lm('Cintas do muro de cima (quantidade)', '=IF(cin_mc="Nenhuma",0,IF(cin_mc="No topo e a meia altura",2,1))', '', '', 'res', '0', 'n_cin')
# Cinta de 20 cm de altura em concreto, no lugar de uma faixa de parede: só a diferença de peso (dedução).
Lm('Peso do muro de cima por metro (P)', '=IF(' + ON_M + ',g_mct*h_mc+IF(s_trib>0,(g_pil*b_pil*hs_pil/10000-g_mct*b_pil/100)*h_mc/s_trib,0)+n_cin*(gama_c*t_mc/100-g_mct)*0.2,0)', 'kN/m',
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
Lm('fd = γf·C·q', '=gama_f*p_w', 'kN/m²', '', 'key', '0.000', 'fd_mc')
Lm('W = t²/6 (por metro)', '=(t_mc/100)^2/6', 'm³/m', 'Seção bruta, como no painel do arrimo.', 'res', '0.000000', 'W_mc')
Lm('fvd = fvk/γm', "=IF(ISNUMBER(fvk_mc_dir),fvk_mc_dir,MIN(INDEX('Referências'!$O$16:$O$18,MATCH(arg_mc,'Referências'!$L$16:$L$18,0)),INDEX('Referências'!$P$16:$P$18,MATCH(arg_mc,'Referências'!$L$16:$L$18,0))))/gama_m", 'MPa', 'fvk digitado ou, em branco, fvk0 da tabela sem pré-compressão (a favor).', 'res', '0.000', 'fvd_mc', 'NBR 16868-1 Tab. 4 / projetista')
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
       f'=IF(mc_on<>"Sim","— (sem muro de cima)",IF(h_p{k}<=0,"— (não há)",IF(p_w<=0,"— (sem vento)",IF(AND(sp_p{k}<=ftkp_mc/gama_m,sn_p{k}<=ftkn_mc/gama_m,tv_p{k}<=fvd_mc,MAX(l_mc,h_p{k})<=50*t_mc/100,l_mc*h_p{k}<=ca_p{k}*(t_mc/100)^2),'
       f'"OK (flexão "&FIXED(100*MAX(sp_p{k}/(ftkp_mc/gama_m),sn_p{k}/(ftkn_mc/gama_m)),0)&"%)","NÃO OK"))))', '', 'Flexão nas duas direções, cisalhamento e dimensões-limite.', 'key', None, f'res_p{k}')
r += 1

section(MC, r, '5. Pilarete (balanço engastado no topo do arrimo)'); r += 1
Lm('Vk no pilarete = C·q·h·(eixo a eixo)', '=p_w*h_mce*s_trib', 'kN', 'O pilarete leva o vento da largura de influência inteira (a favor).', 'res', '0.00', 'Vk_pil')
Lm('Mk na base do pilarete = Vk·h/2', '=Vk_pil*h_mce/2', 'kN·m', '', 'res', '0.00', 'Mk_pil')
Lm('Md = γf·Mk', '=gama_f*Mk_pil', 'kN·m', '', 'key', '0.00', 'Md_pil')
Lm('Vd = γf·Vk', '=gama_f*Vk_pil', 'kN', '', 'key', '0.00', 'Vd_pil')
Lm('d = h da seção − cobrimento ao eixo', '=hs_pil-c_pil', 'cm', '', 'res', '0.0', 'd_pil')
Lm('As efetiva (uma face)', '=n_pil*PI()*phi_pil^2/400', 'cm²', '', 'res', '0.00', 'As_pile')
Lm('fyd', '=fyk_/gama_s', 'MPa', '', 'res', '0.0', 'fyd_pil')
# concreto moldado: NBR 6118, flexão simples (a força normal do peso próprio é pequena e desprezada — a favor)
Lm('Concreto: fcd', '=VALUE(MID(fck_pil,2,2))/1.4', 'MPa', '', 'res', '0.00', 'fcd_pil', 'NBR 6118')
Lm('Concreto: x', '=IFERROR(1.25*d_pil*(1-SQRT(1-Md_pil*100/(0.425*b_pil*d_pil^2*fcd_pil/10))),"não resiste")', 'cm', 'Bloco 0,8x com 0,85fcd.', 'res', '0.00', 'xc_pil', 'NBR 6118 17.2.2')
Lm('Concreto: As', '=IFERROR(Md_pil*100/(fyd_pil/10*(d_pil-0.4*xc_pil)),"—")', 'cm²', '', 'res', '0.00', 'Asc_pil')
Lm('Concreto: As,mín = 0,15%·b·h', '=0.0015*b_pil*hs_pil', 'cm²', '', 'res', '0.00', 'Asm_pil', 'NBR 6118 17.3.5.2.1')
Lm('Concreto: VRd2 = 0,27·(1 − fck/250)·fcd·b·d', '=0.27*(1-VALUE(MID(fck_pil,2,2))/250)*fcd_pil/10*b_pil*d_pil', 'kN', '', 'res', '0.00', 'VR2c_pil', 'NBR 6118 17.4.2.2')
# bloco grauteado: NBR 16868-1, seção retangular cheia (fpk*), como o contraforte aparente
Lm('Bloco: fpk* (prisma cheio)', "=VLOOKUP(fbk_pil,'Referências'!$H$5:$J$16,3,FALSE)", 'MPa', '', 'res', '0.0', 'fpk_pil', 'ABCP Tab. 3.2')
Lm('Bloco: K·fd = K·0,7·fpk*/γm', '=IF(ISNUMBER(K_cf),K_cf,2)*0.7*fpk_pil/gama_m', 'MPa', 'K = o do contraforte (Entradas); em branco, 2,0 (todo grauteado, NBR 16868-1 6.2.2.4).', 'res', '0.000', 'Kfd_pil')
Lm('Bloco: x', '=IFERROR(1.25*d_pil*(1-SQRT(1-Md_pil*100/(0.5*b_pil*d_pil^2*Kfd_pil/10))),"não resiste")', 'cm', '', 'res', '0.00', 'xb_pil', 'NBR 16868-1 11.3')
Lm('Bloco: As = Md/(fyd·z), z ≤ 0,95d', '=IFERROR(Md_pil*100/(fyd_pil/10*MIN(d_pil-0.4*xb_pil,0.95*d_pil)),"—")', 'cm²', '', 'res', '0.00', 'Asb_pil')
Lm('Bloco: As,mín = 0,15%·b·d', '=0.0015*b_pil*d_pil', 'cm²', '', 'res', '0.00', 'Asmb_pil')
Lm('Bloco: fvd = (0,35 + 17,5ρ ≤ 0,7)/γm', '=MIN(0.7,0.35+17.5*As_pile/(b_pil*d_pil))/gama_m', 'MPa', '', 'res', '0.000', 'fvd_pil', 'NBR 16868-1 11.4')
_concreto = 'LEFT(pil_tipo,4)="Conc"'
Lm('x/d', f'=IFERROR(IF({_concreto},xc_pil,xb_pil)/d_pil,"—")', '', '≤ 0,45 (ductilidade).', 'res', '0.000', 'xd_pil')
Lm('As necessária', f'=IF(ISNUMBER(IF({_concreto},xc_pil,xb_pil)),MAX(IF({_concreto},Asc_pil,Asb_pil),IF({_concreto},Asm_pil,Asmb_pil)),"não resiste")', 'cm²', 'Maior entre o cálculo e o mínimo. Seção que não resiste: texto (o MAX ignoraria o texto e daria só o mínimo).', 'key', '0.00', 'Asn_pil')
Lm('Ancoragem no arrimo: ℓ0t = α0t·ℓb no graute ≥ ℓ0t,mín',
   '=CEILING(MAX(a0t*lbphi_gr*phi_pil/10*IFERROR(MIN(1,IF(' + _concreto + ',Asc_pil,Asb_pil)/As_pile),1),0.3*a0t*lbphi_gr*phi_pil/10,1.5*phi_pil,20),1)',
   'cm', 'A barra do pilarete desce no furo grauteado do arrimo (ou no contraforte) e emenda com a dele: mesma regra das esperas (Fundação, seção 10).', 'key', '0', 'l0t_pil', 'NBR 6118 9.5.2.2.1')
Lm('Pilarete: resumo',
   f'=IF(h_mce<=0,"— (sem muro de cima)",IF(p_w<=0,"— (sem vento)",IF(ISNUMBER(Asn_pil)=FALSE,"NÃO OK — a seção não resiste: aumentar a seção",'
   f'IF(xd_pil>0.45,"NÃO OK — x/d > 0,45: aumentar a seção",IF(As_pile<Asn_pil,"NÃO OK — As "&FIXED(As_pile,2)&" < "&FIXED(Asn_pil,2)&" cm²: mais barras ou Ø maior",'
   f'IF(IF({_concreto},Vd_pil>VR2c_pil,Vd_pil/(b_pil*d_pil)*10>fvd_pil),"NÃO OK — cisalhamento","OK ("&FIXED(100*Asn_pil/As_pile,0)&"% do aço)"))))))',
   '', 'Concreto: estribo mínimo da NBR 6118 17.4.1.1 em todo caso.', 'key', None, 'res_pil')
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
Lm('Cinta do topo: resumo',
   '=IF(Tipo_muro<>"Contrafortes","— (muro em balanço)",IF(w_cin<=0,"— (sem vento)",IF(ISNUMBER(Ast_cin)=FALSE,"NÃO OK — a canaleta não resiste",IF(Ast_cin<=PI()*phi_ph^2/400,"OK ("&FIXED(100*Ast_cin/(PI()*phi_ph^2/400),0)&"% da barra)","NÃO OK — "&FIXED(Ast_cin,2)&" cm² > uma barra Ø"&FIXED(phi_ph,1)))))',
   '', '', 'key', None, 'res_cin')
r += 1

section(MC, r, '7. Verificações'); r += 1
Lm('Dados do vento', '=IF(vento_on<>"Sim","— (sem vento)",IF(AND(ISNUMBER(V0_v),ISNUMBER(S1_v),ISNUMBER(S3_v),q_v>0),"OK","NÃO OK — vento ligado sem V0, S1 ou S3"))', '', '', 'key', None, 'chk_dv')
Lm('Dados do muro de cima', '=IF(mc_on<>"Sim","— (sem muro de cima)",IF(AND(ISNUMBER(h_mc),h_mc>0,ISNUMBER(t_mc),t_mc>0,ISNUMBER(g_mc),s_trib>0,ISNUMBER(b_pil),ISNUMBER(hs_pil)),"OK","NÃO OK — falta altura, espessura, peso, espaçamento ou seção do pilarete"))', '', '', 'key', None, 'chk_dmc')
# Só vale "OK…" ou o "— (motivo)" escrito pela própria conta: o "—" puro é o IFERROR do pós-processamento, ou
# seja, conta que não fechou — e conta que não fechou não pode passar.
Lm('Muro de cima e vento: resumo',
   '=IF(AND(mc_on<>"Sim",vento_on<>"Sim"),"— (sem muro de cima e sem vento)",IF(AND(OR(LEFT(chk_dv,2)="OK",LEFT(chk_dv,3)="— ("),OR(LEFT(chk_dmc,2)="OK",LEFT(chk_dmc,3)="— ("),OR(LEFT(res_pA,2)="OK",LEFT(res_pA,3)="— ("),OR(LEFT(res_pB,2)="OK",LEFT(res_pB,3)="— ("),OR(LEFT(res_pil,2)="OK",LEFT(res_pil,3)="— ("),OR(LEFT(res_cin,2)="OK",LEFT(res_cin,3)="— (")),"OK","NÃO OK"))',
   '', 'Dados, painéis, pilarete e cinta do topo do arrimo. Vai para as verificações do balanço e do contraforte.', 'key', None, 'res_mc')
widths(MC, {'A': 46, 'B': 22, 'C': 9, 'D': 70, 'E': 18, 'H': 10, 'I': 8, 'J': 8, 'K': 8, 'L': 8})
