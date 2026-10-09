# Executado dentro de build_new.py (mesmo namespace). Aba Fundação — sapata corrida.
# Roteiro: aba "Fundação Sapata Corrida p muro" do Eng. Gilberto (posição, tombamento, deslizamento, tensões, armadura),
# adaptado: solo do talão sai da geometria, módulo entre contrafortes, empuxo até a base da sapata, FS clássico + e ≤ B/4,
# flexão/cortante pela NBR 6118 e torção (contrafortes) pela NBR 6118 17.5.
Fd = wb.create_sheet('Fundação', 7)
title(Fd, 'Fundação — sapata corrida (estabilidade e dimensionamento)',
      'Roteiro da aba "Fundação Sapata Corrida p muro" (Eng. Gilberto), adaptado. Muro em balanço: faixa de 1 m. Contrafortes: módulo = espaçamento entre contrafortes. x medido a partir da borda aterrada.')
header(Fd, 3, ['Item', 'Valor', 'Unid.', 'Observação', 'Fonte'])
r = 4
def Lf(label, f, unit='', note='', kind='res', fmt=None, nm=None, src=None):
    global r
    line(Fd, r, label, f, unit, note, kind, fmt, nm, src); r += 1

Lf('Tipo de muro', '=IF(Tipo_muro="Contrafortes","Contrafortes — módulo entre contrafortes","Balanço — faixa de 1 m")', '', '', 'key')
r += 1
section(Fd, r, '1. Geometria'); r += 1
# Módulo e contraforte pelos valores ADOTADOS (na grade do bloco, Entradas): a sapata carrega o muro que a
# memória calcula e o 3D desenha.
Lf('Comprimento do módulo', '=IF(Tipo_muro="Contrafortes",l_cf_adot,1)', 'm', '', 'res', '0.00', 'Lm')
Lf('Espessura do muro', '=t_bloco/100', 'm', '', 'res', '0.00', 't_m')
Lf('Talão (sob o aterro, livre do muro)', '=MAX(0,a_ater-t_m/2)', 'm', 'Largura de solo sobre a sapata.', 'res', '0.000', 'heel')
Lf('Ponta (para fora, livre do muro)', '=MAX(0,B_sap-a_ater-t_m/2)', 'm', '', 'res', '0.000', 'toe')
Lf('Posição da sapata', '=IF(heel<0.005,"Toda para fora (divisa)",IF(toe<0.005,"Toda sob o aterro","Mista: "&FIXED(heel,2)&" m para dentro e "&FIXED(toe,2)&" m para fora"))', '', '', 'key')
Lf('Contraforte cabe na sapata?', '=IF(Tipo_muro<>"Contrafortes","— (muro em balanço)",IF(LEFT(pos_cf,4)="Ente",IF(heel>=(tenr_adot-t_bloco)/100-0.001,"OK — contraforte enterrado apoiado no talão","NÃO OK — contraforte enterrado passa da borda aterrada: aumentar a distância da borda aterrada ao eixo"),IF(toe>=(tenr_adot-t_bloco)/100-0.001,"OK — contraforte aparente apoiado na ponta","NÃO OK — contraforte aparente passa da borda externa: aumentar a ponta")))', '', 'Enterrado exige talão ≥ tenr − t; aparente exige ponta ≥ tenr − t.', 'key', None, 'cf_cabe')
r += 1
section(Fd, r, '2. Cargas verticais (características, por módulo)'); r += 1
header(Fd, r, ['Parcela', 'N (kN)', 'x (m)', 'B − x (m)', 'N·(B − x) (kN·m)', 'x − B/2 (m)', 'N·(x − B/2) (kN·m)']); Fd.row_dimensions[r].height = 30; r += 1
cf_x = 'IF(LEFT(pos_cf,4)="Ente",a_ater-t_m/2-(tenr_adot-t_bloco)/200,a_ater+t_m/2+(tenr_adot-t_bloco)/200)'
# Duas alturas (09/10): o que é PEÇA pesa na altura do muro (parede, contraforte); o que é SOLO, na altura de solo
# (terra sobre o talão — descontado o volume do contraforte enterrado só até onde há terra — e a coluna d'água, com o
# NA medido do topo do solo). O empuxo já vem do perfil, que é da altura de solo.
VERT = [
    ('Muro (peso próprio)', '=peso_par*H_muro*Lm', '=a_ater'),
    ('Contraforte', '=IF(Tipo_muro="Contrafortes",gama_cf*eenr/100*(tenr_adot-t_bloco)/100*H_muro,0)', f'=IF(Tipo_muro="Contrafortes",{cf_x},a_ater)'),
    ('Sapata + dente', '=gama_c*(B_sap*h_sap+b_den*h_den)*Lm', '=B_sap/2'),
    ('Solo sobre o talão', '=gama_solo*H_solo*heel*Lm-IF(AND(Tipo_muro="Contrafortes",LEFT(pos_cf,4)="Ente"),gama_solo*eenr/100*MIN(heel,(tenr_adot-t_bloco)/100)*H_solo,0)', '=heel/2'),
    ('Sobrecarga sobre o talão', '=IF(q_est="Sim",q_sobre*heel*Lm,0)', '=heel/2'),
    ('Carga permanente no topo', '=P_topo*Lm', '=a_ater'),
    ('Subpressão (água)', '=-IF(Agua="Sim",gama_w*MAX(0,H_solo+h_sap-z_NA)*B_sap*Lm,0)', '=B_sap/2'),
]
v0 = r
for lab, fN_, fx in VERT:
    Fd.cell(row=r, column=1, value=lab).font = fN
    Fd[f'B{r}'] = fN_; Fd[f'C{r}'] = fx
    Fd[f'D{r}'] = f'=B_sap-C{r}'; Fd[f'E{r}'] = f'=B{r}*D{r}'; Fd[f'F{r}'] = f'=C{r}-B_sap/2'; Fd[f'G{r}'] = f'=B{r}*F{r}'
    for cc in 'ABCDEFG':
        c = Fd[f'{cc}{r}']; c.border = BOX
        if cc != 'A': c.number_format = '0.000'; c.font = fN; c.fill = RES; c.alignment = Alignment(horizontal='center')
    r += 1
v1 = r - 1
Fd.cell(row=r, column=1, value='Σ').font = fB
for cc, nm_ in (('B', 'N_tot'), ('E', 'M_est'), ('G', 'M_vc')):
    Fd[f'{cc}{r}'] = f'=SUM({cc}{v0}:{cc}{v1})'; Fd[f'{cc}{r}'].font = fB; Fd[f'{cc}{r}'].fill = RES; Fd[f'{cc}{r}'].number_format = '0.000'; Fd[f'{cc}{r}'].border = BOX
    name(nm_, Fd, f'{cc}{r}')
r += 1
Fd.cell(row=r, column=1, value='Muro e contraforte na altura do muro; solo do talão e subpressão na altura de solo. Contraforte com γ grauteado e volume eenr × (tenr − t) × h muro. Solo do talão desconta o volume do contraforte enterrado. Subpressão uniforme (aproximação).').font = fS; r += 2
section(Fd, r, '3. Empuxo até a base da sapata'); r += 1
Lf('σh na base do muro', '=sh_base', 'kPa', '', 'res', '0.00')
Lf('σh na base da sapata', '=sh_base+h_sap*(Ka_*(gama_solo-IF(AND(Agua="Sim",H_solo+h_sap>z_NA),gama_w,0))+IF(AND(Agua="Sim",H_solo+h_sap>z_NA),gama_w,0))', 'kPa', 'Continua o perfil por mais h da sapata.', 'res', '0.00', 'sh_b2')
Lf('Hk — empuxo total no módulo', '=(Vk_+(sh_base+sh_b2)/2*h_sap)*Lm', 'kN', '', 'key', '0.00', 'H_k')
Lf('M tombador em relação à base da sapata', '=(Mk_+Vk_*h_sap+h_sap^2*(2*sh_base+sh_b2)/6)*Lm', 'kN·m', 'Mk na base do muro + Vk·h sapata + fatia da sapata. (A aba do Gilberto soma Vk·h.)', 'key', '0.00', 'M_tb')
Lf('Passivo na frente (Kp·γ·(h + dente)²/2)', '=IF(pass_on="Sim",Kp_*gama_solo*(h_sap+h_den)^2/2*Lm,0)', 'kN', 'Solo da frente no nível do topo da sapata.', 'res', '0.00', 'E_p')
r += 1
section(Fd, r, '4. Tombamento'); r += 1
Lf('M estabilizante em relação ao pé', '=M_est', 'kN·m', 'Σ N·(B − x). Passivo não entra (a favor da segurança).', 'res', '0.00')
Lf('FS = M estabilizante / M tombador', '=IF(M_tb>0,M_est/M_tb,99)', '', 'Mínimo nas Entradas.', 'key', '0.00', 'FS_t')
Lf('M no centro da sapata (+ = para o pé)', '=M_tb+M_vc', 'kN·m', 'Como a aba do Gilberto: M tombador + Σ N·(x − B/2).', 'res', '0.000', 'M_cen')
Lf('Excentricidade e = M/N', '=M_cen/N_tot', 'm', '+ = resultante para o pé; − = para o aterro.', 'key', '0.000', 'e_f')
Lf('Limite do Gilberto: |e| ≤ B/4', '=B_sap/4', 'm', 'Na aba original só para o lado do pé; aqui nos dois lados.', 'res', '0.000')
r += 1
section(Fd, r, '5. Deslizamento'); r += 1
Lf("φ' do solo de apoio", '=IF(ISNUMBER(phi_base),phi_base,phi_solo)', '°', '', 'res', '0.0', 'phi_b')
Lf('δ = (δ/φ)·φ', '=dphi*phi_b', '°', '', 'res', '0.0', 'del_b')
Lf('Atrito na base = N·tg δ', '=MAX(0,N_tot)*TAN(RADIANS(del_b))', 'kN', '', 'res', '0.00', 'R_at')
Lf('Adesão na base = a·B·L', '=ades_b*B_sap*Lm', 'kN', 'Zero por padrão.', 'res', '0.00', 'R_ad')
Lf('FS = (atrito + adesão + passivo)/Hk', '=(R_at+R_ad+E_p)/H_k', '', 'Mínimo nas Entradas (aba do Gilberto: 1,5).', 'key', '0.00', 'FS_d')
r += 1
section(Fd, r, '6. Tensões no solo'); r += 1
Lf('σ média = N/(B·L)', '=N_tot/(B_sap*Lm)', 'kPa', '', 'res', '0.0', 's_med')
Lf('Caso de pressão', '=IF(ABS(e_f)<=B_sap/6,"Trapézio (|e| ≤ B/6, sapata toda comprimida)",IF(ABS(e_f)<B_sap/2,"Triângulo (|e| > B/6, parte da sapata descola)","Resultante fora da base"))', '', '', 'res')
Lf('Comprimento comprimido', '=IF(ABS(e_f)<=B_sap/6,B_sap,3*(B_sap/2-ABS(e_f)))', 'm', '', 'res', '0.000', 'c_len')
Lf('σ máx', '=IF(ABS(e_f)<=B_sap/6,s_med*(1+6*ABS(e_f)/B_sap),2*N_tot/(c_len*Lm))', 'kPa', '', 'key', '0.0', 's_hi')
Lf('σ mín', '=IF(ABS(e_f)<=B_sap/6,s_med*(1-6*ABS(e_f)/B_sap),0)', 'kPa', '', 'res', '0.0', 's_lo')
Lf('Lado da σ máx', '=IF(e_f>=0,"pé (borda externa)","talão (borda aterrada)")', '', '', 'res')
Lf('Sugestão: 20·SPT (N/5 kgf/cm²)', '=20*SPT_b', 'kPa', 'Regra prática da aba do Gilberto, sem teto.', 'sug', '0')
Lf('σadm usado', '=IF(ISNUMBER(sig_adm_dir),sig_adm_dir,20*SPT_b)', 'kPa', '', 'res', '0', 's_adm')
r += 1
section(Fd, r, '7. Flexão e cortante transversais (por metro, NBR 6118)'); r += 1
Lf('fck', '=VALUE(MID(fck_fund,2,2))', 'MPa', 'Concreto da fundação (Entradas).', 'res', '0', 'fck_s')
Lf('fcd', '=fck_s/1.4', 'MPa', '', 'res', '0.00', 'fcd_s')
Lf('d', '=h_sap*100-cob_sap-phi_sap/20', 'cm', '', 'res', '0.00', 'd_s')
_S0 = r  # memória das fatias fica no fim; aqui só os resultados
Lf('Mk na face do muro — ponta (traciona embaixo)', '=SUM(T_dM)', 'kN·m/m', 'Pressão do solo − peso da sapata, integrada em 20 fatias (memória no fim da aba).', 'res', '0.00', 'Mk_toe')
Lf('Mk na face do muro — talão (traciona em cima)', '=SUM(H_dM)', 'kN·m/m', 'Solo + sobrecarga + sapata − pressão do solo. Talão em balanço (a favor da segurança; os contrafortes ajudariam).', 'res', '0.00', 'Mk_heel')
for tag, lab, mk in (('t', 'ponta', 'Mk_toe'), ('h', 'talão', 'Mk_heel')):
    Lf(f'Md {lab} = 1,4·Mk', f'=1.4*MAX(0,{mk})', 'kN·m/m', '', 'res', '0.00', f'Md_{tag}s')
    Lf(f'x {lab}', f'=IFERROR(1.25*d_s*(1-SQRT(1-Md_{tag}s*100/(0.425*100*d_s^2*fcd_s/10))),"não resiste")', 'cm', 'Bloco 0,8x com 0,85fcd.', 'res', '0.00', f'x_{tag}s')
    Lf(f'As {lab}', f'=IFERROR(Md_{tag}s*100/(fyk_/gama_s/10*(d_s-0.4*x_{tag}s)),"—")', 'cm²/m', '', 'res', '0.00', f'As_{tag}s')
Lf('As,mín = 0,15%·b·h', '=0.0015*100*h_sap*100', 'cm²/m', 'NBR 6118 (fck ≤ 30). A aba do Gilberto usa máx(2·As,nec; 0,15·h).', 'res', '0.00', 'As_ms')
Lf('As principal (maior entre ponta, talão e mínimo)', '=MAX(IF(ISNUMBER(As_ts),As_ts,0),IF(ISNUMBER(As_hs),As_hs,0),As_ms)', 'cm²/m', 'Mesma armadura nas duas faces se os dois balanços pedirem.', 'key', '0.00', 'As_ps')
Lf('Espaçamento com o Ø principal', '=MIN(20,2*h_sap*100,ROUNDDOWN(PI()*phi_sap^2/400/As_ps*100,0))', 'cm', 'NBR 6118: ≤ 20 cm e ≤ 2h. (A aba do Gilberto limita a 30.)', 'key', '0', 's_ps')
Lf('As secundária = máx(0,9; 20% As; 0,5·As,mín)', '=MAX(0.9,0.2*As_ps,0.5*As_ms)', 'cm²/m', '', 'res', '0.00', 'As_ss')
Lf('Espaçamento com o Ø secundário', '=MIN(33,ROUNDDOWN(PI()*phi_sap2^2/400/As_ss*100,0))', 'cm', '', 'res', '0', 's_ss')
Lf('fctd = 0,7·0,3·fck^(2/3)/1,4', '=0.21*fck_s^(2/3)/1.4', 'MPa', '', 'res', '0.000', 'fctd_s')
Lf('k = 1,6 − d ≥ 1', '=MAX(1,1.6-d_s/100)', '', '', 'res', '0.000', 'k_s')
Lf('ρ1 = As/(b·d) ≤ 2%', '=MIN(0.02,As_ps/(100*d_s))', '', '', 'res', '0.0000', 'rho_s')
Lf('VRd1 = 0,25·fctd·k·(1,2 + 40ρ1)·b·d', '=0.25*fctd_s*1000*k_s*(1.2+40*rho_s)*d_s/100', 'kN/m', 'NBR 6118 19.4.1 (laje sem estribo).', 'key', '0.00', 'VRd1_s')
Lf('VSd ponta (a d da face)', '=1.4*MAX(0,SUM(T_dV))', 'kN/m', '', 'res', '0.00', 'Vsd_t')
Lf('VSd talão (a d da face)', '=1.4*MAX(0,SUM(H_dV))', 'kN/m', '', 'res', '0.00', 'Vsd_h')
r += 1
section(Fd, r, '8. Torção longitudinal (só com contrafortes — modelo simplificado)'); r += 1
Lf('Modelo', '="Sapata rígida: o Md do contraforte chega concentrado e o solo reage uniforme no módulo → torção de ±Md/2 junto a cada contraforte (dedução nossa, limite superior: Md do contraforte com 100% da área)."', '', '', 'txt')
Lf('TSd = Md do contraforte / 2', '=IF(Tipo_muro="Contrafortes",Md_cf/2,0)', 'kN·m', '', 'key', '0.00', 'T_sd')
Lf('A/u da seção cheia (B × h)', '=B_sap*h_sap/(2*(B_sap+h_sap))', 'm', '', 'res', '0.000', 'Au_s')
Lf('c1 (face ao eixo da barra longitudinal)', '=(cob_sap+phi_tor/10+phi_sap/20)/100', 'm', '', 'res', '0.000', 'c_eixo_s')
# NBR 6118 17.5.1.4.1: he ≤ A/u e he ≥ 2·c1. Antes a fórmula era só A/u e o c1 calculado ficava sem uso. Não dá para
# fazer he = máx(A/u; 2·c1): passaria do teto A/u. A norma resolve o caso A/u < 2·c1 (sapata baixa) assim: fica
# he = A/u (≤ bw − 2·c1, conferido nas Verificações) e a seção vazada equivalente passa a ser a dos EIXOS DAS BARRAS
# DE CANTO — Ae e ue medidos a c1 da face, e não a he/2. Com A/u ≥ 2·c1 nada muda.
Lf('he = A/u (≤ A/u; ≥ 2·c1)', '=Au_s', 'm', 'NBR 6118 17.5.1.4.1. Se A/u < 2·c1, Ae e ue pelos eixos das barras de canto (linhas abaixo).', 'res', '0.000', 'he_s')
Lf('Ae = (B − he)·(h − he)  [A/u < 2·c1: (B − 2c1)·(h − 2c1)]', '=IF(he_s>=2*c_eixo_s,(B_sap-he_s)*(h_sap-he_s),(B_sap-2*c_eixo_s)*(h_sap-2*c_eixo_s))', 'm²', '', 'res', '0.0000', 'Ae_s')
Lf('ue = 2·[(B − he) + (h − he)]  [A/u < 2·c1: com 2c1]', '=IF(he_s>=2*c_eixo_s,2*((B_sap-he_s)+(h_sap-he_s)),2*((B_sap-2*c_eixo_s)+(h_sap-2*c_eixo_s)))', 'm', '', 'res', '0.000', 'ue_s')
Lf('TRd2 = 0,5·αv2·fcd·Ae·he·sen2θ (θ = 45°)', '=0.5*(1-fck_s/250)*fcd_s*1000*Ae_s*he_s', 'kN·m', 'NBR 6118 17.5.1.5.', 'key', '0.00', 'TRd2_s')
Lf('A90/s = TSd/(2·Ae·fywd) — por ramo', '=IF(T_sd>0,T_sd/(2*Ae_s*fyk_/gama_s*1000)*10000,0)', 'cm²/m', 'Estribo fechado, θ = 45°.', 'res', '0.00', 'A90_s')
Lf('Asl = TSd·ue/(2·Ae·fyd) — total no perímetro', '=IF(T_sd>0,T_sd*ue_s/(2*Ae_s*fyk_/gama_s*1000)*10000,0)', 'cm²', 'Somar à armadura de flexão nas faces.', 'res', '0.00', 'Asl_s')
Lf('Mínimo de estribo: ρsw = 0,2·fctm/fywk (bw = B)', '=IF(T_sd>0,0.2*0.3*fck_s^(2/3)/fyk_*B_sap*100*100/2,0)', 'cm²/m', 'Por ramo (NBR 6118 17.4.1.1.1). Com bw = largura toda fica alto em sapata larga — avaliar (dedução).', 'res', '0.00', 'A90_m')
Lf('Ø do estribo de torção: espaçamento', '=IF(T_sd>0,MIN(20,ROUNDDOWN(PI()*phi_tor^2/400/MAX(A90_s,0.0001)*100,0)),"—")', 'cm', 'Pelo cálculo (sem o mínimo).', 'res', '0')
r += 1
section(Fd, r, '9. Verificações'); r += 1
CHKF = [
    ('Muro apoiado na sapata', '=IF(AND(a_ater>=t_m/2-0.001,a_ater<=B_sap-t_m/2+0.001),"OK","NÃO OK — o muro sai da sapata: distância da borda aterrada ao eixo deve ficar entre t/2 e B − t/2")'),
    ('Contraforte apoiado na sapata', '=cf_cabe'),
    ('Tombamento: FS ≥ mínimo', '=IF(FS_t>=FS_tomb,"OK (FS = "&FIXED(FS_t,2)&")","NÃO OK (FS = "&FIXED(FS_t,2)&" < "&FIXED(FS_tomb,1)&")")'),
    ('Tombamento: |e| ≤ B/4 (Gilberto)', '=IF(ABS(e_f)<=B_sap/4,"OK (e = "&FIXED(e_f*100,1)&" cm)","NÃO OK (e = "&FIXED(e_f*100,1)&" cm > "&FIXED(B_sap*25,1)&")")'),
    ('Tombamento: resultado (vale o pior)', '=IF(AND(FS_t>=FS_tomb,ABS(e_f)<=B_sap/4),"OK","NÃO OK")'),
    ('Deslizamento: FS ≥ mínimo', '=IF(FS_d>=FS_desl,"OK (FS = "&FIXED(FS_d,2)&")","NÃO OK (FS = "&FIXED(FS_d,2)&" < "&FIXED(FS_desl,1)&") — aumentar B, dente ou peso")'),
    ('Tensão: σ máx ≤ σadm', '=IF(s_hi<=s_adm,"OK ("&FIXED(s_hi,0)&" ≤ "&FIXED(s_adm,0)&" kPa)","NÃO OK ("&FIXED(s_hi,0)&" > "&FIXED(s_adm,0)&" kPa)")'),
    ('Tensão: sapata toda comprimida (|e| ≤ B/6)', '=IF(ABS(e_f)<=B_sap/6,"Sim","Não — parte descola (informativo)")'),
    ('Flexão da sapata', '=IF(AND(ISNUMBER(x_ts),ISNUMBER(x_hs)),"OK — Ø"&IF(phi_sap=INT(phi_sap),FIXED(phi_sap,0),FIXED(phi_sap,1))&" c/"&FIXED(s_ps,0)&" ("&FIXED(As_ps,2)&" cm²/m)","NÃO OK — aumentar a altura")'),
    ('Cortante sem estribo (ponta e talão)', '=IF(MAX(Vsd_t,Vsd_h)<=VRd1_s,"OK ("&FIXED(MAX(Vsd_t,Vsd_h),1)&" ≤ "&FIXED(VRd1_s,1)&" kN/m)","NÃO OK — aumentar a altura")'),
    ('Torção: TSd ≤ TRd2', '=IF(T_sd=0,"— (sem contrafortes)",IF(T_sd<=TRd2_s,"OK ("&FIXED(T_sd,1)&" ≤ "&FIXED(TRd2_s,1)&" kN·m)","NÃO OK — aumentar a seção"))'),
    # no fim da lista: as linhas de cima têm endereço lido pelo app (espaçamento do estribo de torção)
    ('Torção: espessura equivalente he', '=IF(T_sd=0,"— (sem contrafortes)",IF(he_s>=2*c_eixo_s,"OK (A/u ≥ 2·c1)",IF(he_s<=MIN(B_sap,h_sap)-2*c_eixo_s,"OK (A/u < 2·c1: Ae pelos eixos das barras de canto)","NÃO OK — A/u > bw − 2·c1: aumentar a altura da sapata")))'),
]
for lab, f in CHKF:
    Lf(lab, f, '', '', 'key')
# A verificação do he ocupou a linha em branco que havia aqui: a memória das fatias fica nas mesmas linhas de antes
# (o gabarito do app e os cenários-alvo do golden_alvos.py citam células dela pelo endereço).
r += 1
# ---------- memória: fatias ----------
section(Fd, r, 'Memória — pressão do solo integrada em 20 fatias por balanço (ponta e talão)', 8); r += 1
Fd.cell(row=r, column=1, value='σ(x): trapézio se |e| ≤ B/6; triângulo a partir da borda mais comprimida se |e| > B/6. Ponta: q = σ − γc·h (para cima). Talão: q = γ·h solo + q + γc·h − σ (para baixo).').font = fS; r += 1
def sig(xc):
    d_ = f'IF(e_f>=0,B_sap-{xc},{xc})'
    return f'IF(ABS(e_f)<=B_sap/6,s_hi-(s_hi-s_lo)*{d_}/B_sap,MAX(0,s_hi*(1-{d_}/c_len)))'
for tag, lab in (('T', 'Ponta'), ('H', 'Talão')):
    header(Fd, r, [f'{lab}: fatia', 'x (m)', 'σ (kPa)', 'q líquida (kPa)', 'braço à face (m)', 'dM (kN·m/m)', 'dV além de d (kN/m)']); r += 1
    r0 = r
    for i in range(1, 21):
        Fd.cell(row=r, column=1, value=i)
        if tag == 'T':
            Fd[f'B{r}'] = f'=a_ater+t_m/2+({i}-0.5)*toe/20'
            Fd[f'C{r}'] = '=' + sig(f'B{r}')
            Fd[f'D{r}'] = f'=C{r}-gama_c*h_sap'
            Fd[f'E{r}'] = f'=B{r}-(a_ater+t_m/2)'
            Fd[f'F{r}'] = f'=D{r}*toe/20*E{r}'
            Fd[f'G{r}'] = f'=IF(E{r}>d_s/100,D{r}*toe/20,0)'
        else:
            Fd[f'B{r}'] = f'=({i}-0.5)*heel/20'
            Fd[f'C{r}'] = '=' + sig(f'B{r}')
            Fd[f'D{r}'] = f'=gama_solo*H_solo+q_sobre+gama_c*h_sap-C{r}'
            Fd[f'E{r}'] = f'=(a_ater-t_m/2)-B{r}'
            Fd[f'F{r}'] = f'=D{r}*heel/20*E{r}'
            Fd[f'G{r}'] = f'=IF(E{r}>d_s/100,D{r}*heel/20,0)'
        for cc in 'ABCDEFG':
            c = Fd[f'{cc}{r}']; c.border = BOX; c.font = fN
            if cc != 'A': c.number_format = '0.000'
        r += 1
    wb.defined_names[f'{tag}_dM'] = DefinedName(f'{tag}_dM', attr_text=f"'Fundação'!$F${r0}:$F${r-1}")
    wb.defined_names[f'{tag}_dV'] = DefinedName(f'{tag}_dV', attr_text=f"'Fundação'!$G${r0}:$G${r-1}")
    r += 1
Fd.cell(row=r, column=1, value='Pressão por unidade de área (kPa) vale para qualquer faixa de 1 m do módulo (sapata rígida). Com contrafortes, a diferença entre o Md concentrado do contraforte e a reação uniforme vira a torção da seção 8.').font = fS
widths(Fd, {'A': 46, 'B': 24, 'C': 12, 'D': 66, 'E': 18, 'F': 14, 'G': 16})
Fd.freeze_panes = 'A4'
