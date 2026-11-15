# Executado dentro de build_new.py (mesmo namespace). Aba Fundação — sapata corrida.
# Roteiro: aba "Fundação Sapata Corrida p muro" do Eng. Gilberto (posição, tombamento, deslizamento, tensões, armadura),
# adaptado: solo do talão sai da geometria, módulo entre contrafortes, empuxo até a base da sapata, FS clássico + e ≤ B/4,
# flexão/cortante pela NBR 6118 e torção (contrafortes) pela NBR 6118 17.5.
Fd = wb.create_sheet('Fundação', 7)
title(Fd, 'Fundação — sapata corrida (estabilidade e dimensionamento)',
      'Muro em balanço: faixa de 1 m. Contrafortes: módulo = espaçamento entre contrafortes. x medido a partir da borda aterrada.')
header(Fd, 3, ['Item', 'Valor', 'Unid.', 'Observação', 'Fonte'])
r = 4
def Lf(label, f, unit='', note='', kind='res', fmt=None, nm=None, src=None):
    global r
    line(Fd, r, label, f, unit, note, kind, fmt, nm, src); r += 1

Lf('Tipo de muro', '=IF(Tipo_muro="Contrafortes","Contrafortes — módulo entre contrafortes","Balanço — faixa de 1 m")', '', '', 'key')
# A PRIMEIRA CONTA da sapata (Jose, 14/10): rígida ou flexível. Toda a aba supõe sapata RÍGIDA (pressão linear,
# tombamento, deslizamento, fatias); flexível não é calculada aqui — acusa NÃO OK e manda reavaliar (Jose: "a planilha
# não vai fazer sapata flexível, vai verificar"; elementos finitos ficam para o software). A conta está nas
# Verificações (h_rig, chk_rig); esta linha repete o veredito no topo. Ocupa a linha que era em branco.
Lf('Sapata rígida: h ≥ (B − t)/3 (NBR 6118 22.6.1) — a primeira conta', '=chk_rig', '',
   'Sapata corrida: a = B, ap = espessura do muro (Bastos, Sapatas de Fundação, 1.7).', 'key', None, 'cls_fund', 'NBR 6118 22.6.1')
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
    ('Muro (peso próprio)', '=peso_us*H_muro*Lm', '=a_ater'),
    ('Contraforte', '=IF(Tipo_muro="Contrafortes",gama_cf_us*eenr/100*(tenr_adot-t_bloco)/100*H_muro,0)', f'=IF(Tipo_muro="Contrafortes",{cf_x},a_ater)'),
    ('Sapata', '=gama_c*B_sap*h_sap*Lm', '=B_sap/2'),
    ('Solo sobre o talão', '=gama_solo*H_solo*heel*Lm-IF(AND(Tipo_muro="Contrafortes",LEFT(pos_cf,4)="Ente"),gama_solo*eenr/100*MIN(heel,(tenr_adot-t_bloco)/100)*H_solo,0)', '=heel/2'),
    ('Sobrecarga sobre o talão', '=IF(q_est="Sim",q_sobre*heel*Lm,0)', '=heel/2'),
    ('Carga permanente no topo', '=(P_topo+P_mc)*Lm', '=a_ater'),
    ('Subpressão (água)', '=-IF(Agua="Sim",gama_w*MAX(0,H_solo+h_sap-z_NA)*B_sap*Lm,0)', '=B_sap/2'),
    # Aterro sobre a ponta (Jose, 12/10): só com a garantia do solo da frente. Desconta o contraforte APARENTE, que fica
    # na ponta (espelho do enterrado no talão). Linha no FIM da tabela: as de cima mantêm o endereço que o app lê.
    ('Aterro sobre a ponta', '=IF(pass_on="Sim",gama_solo*h_fr*toe*Lm-IF(AND(Tipo_muro="Contrafortes",LEFT(pos_cf,4)<>"Ente"),gama_solo*eenr/100*MIN(toe,(tenr_adot-t_bloco)/100)*h_fr,0),0)', '=B_sap-toe/2'),
    # O dente saiu da linha da sapata (13/10): ele tem posição própria (x_den, do centro, + para o pé), e o braço dele
    # muda o momento. Linha no FIM, pela mesma razão do aterro.
    ('Dente', '=gama_c*b_den*h_den*Lm', '=B_sap/2+x_den'),
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
Fd.cell(row=r, column=1, value='Muro e contraforte na altura do muro; solo do talão e subpressão na altura de solo. Contraforte com γ grauteado e volume eenr × (tenr − t) × h muro. Dente na posição dele (do centro da sapata). Solo do talão desconta o volume do contraforte enterrado; aterro sobre a ponta (só com a garantia do solo da frente) desconta o aparente. Subpressão uniforme (aproximação).').font = fS; r += 2
section(Fd, r, '3. Empuxo até a base da sapata'); r += 1
Lf('σh na base do muro', '=sh_base', 'kPa', '', 'res', '0.00')
Lf('σh na base da sapata', '=sh_base+h_sap*(Ka_*(gama_solo-IF(AND(Agua="Sim",H_solo+h_sap>z_NA),gama_w,0))+IF(AND(Agua="Sim",H_solo+h_sap>z_NA),gama_w,0))', 'kPa', 'Continua o perfil por mais h da sapata.', 'res', '0.00', 'sh_b2')
Lf('Hk — empuxo total no módulo', '=(Vk_+Vk_w+(sh_base+sh_b2)/2*h_sap)*Lm', 'kN', 'Empuxo + vento (aba Muro de cima e vento; zero sem vento).', 'key', '0.00', 'H_k')
Lf('M de tombamento em relação à base da sapata', '=(Mk_+Mk_w+(Vk_+Vk_w)*h_sap+h_sap^2*(2*sh_base+sh_b2)/6)*Lm', 'kN·m', 'Mk na base do muro (empuxo + vento) + Vk·h sapata + fatia da sapata.', 'key', '0.00', 'M_tb')
# Passivo (Jose, 13/10): com o solo da frente garantido, a face toda da frente (aterro + sapata + dente). Sem a garantia,
# só o dente do centro para trás: o solo na frente dele está debaixo da sapata e não é escavado; vale a altura do dente
# abaixo da base, sem o peso da sapata por cima (a favor). Dente para a ponta, sem garantia: nada.
# Kp do solo de APOIO (Jose, 14/10): o dente está cravado no solo natural sob a sapata, não no aterro de trás — Kp_b,
# seção 5. O γ segue o do solo contido (não há entrada de γ do solo de apoio; DEDUÇÃO).
Lf('Passivo (frente garantida: Kp·γ·(h aterro + h + dente)²/2; senão dente do centro para trás: Kp·γ·h dente²/2) ÷ 2,0', '=IF(pass_on="Sim",Kp_b*gama_solo*(h_fr+h_sap+h_den)^2/2/2*Lm,IF(AND(b_den>0,h_den>0,x_den<=0.0005),Kp_b*gama_solo*h_den^2/2/2*Lm,0))', 'kN', 'Kp do solo de apoio (seção 5). Solo da frente no nível do aterro sobre a ponta (0 = topo da sapata). Reduzido por 2,0 (NBR 6122 7.6.3).', 'res', '0.00', 'E_p')
r += 1
section(Fd, r, '4. Tombamento'); r += 1
Lf('M estabilizante em relação ao pé', '=M_est', 'kN·m', 'Σ N·(B − x). Passivo não entra (a favor da segurança).', 'res', '0.00')
Lf('FS = M estabilizante / M de tombamento', '=IF(M_tb>0,M_est/M_tb,99)', '', 'Mínimo nas Entradas.', 'key', '0.00', 'FS_t')
Lf('M no centro da sapata (+ = para o pé)', '=M_tb+M_vc', 'kN·m', 'M de tombamento + Σ N·(x − B/2).', 'res', '0.000', 'M_cen')
Lf('Excentricidade e = M/N', '=M_cen/N_tot', 'm', '+ = resultante para o pé; − = para o aterro.', 'key', '0.000', 'e_f')
Lf('Limite: |e| ≤ B/4', '=B_sap/4', 'm', 'Critério adotado, nos dois lados.', 'res', '0.000', 'e_lim')
r += 1
section(Fd, r, '5. Deslizamento'); r += 1
# φ' do solo de apoio OBRIGATÓRIO (Jose, 14/10: "o solo embaixo da sapata é o solo natural, é o do laudo de
# sondagem, é o que o calculista digita"): sem valor, nada de copiar o do solo contido — o deslizamento reprova
# pedindo o valor (Verificações).
Lf("φ' do solo de apoio", '=IF(ISNUMBER(phi_base),phi_base,"—")', '°', 'Entradas (laudo de sondagem). Sem valor, o deslizamento pede o dado.', 'res', '0.0', 'phi_b')
Lf("Kp do solo de apoio = tg²(45° + φ'b/2)", '=TAN(RADIANS(45+phi_b/2))^2', '', 'Passivo do dente e da frente (seção 3).', 'res', '0.000', 'Kp_b', 'Rankine')
Lf('δ = (δ/φ)·φ', '=dphi*phi_b', '°', '', 'res', '0.0', 'del_b')
Lf('Atrito na base = N·tg δ', '=MAX(0,N_tot)*TAN(RADIANS(del_b))', 'kN', '', 'res', '0.00', 'R_at')
Lf('Adesão na base = a·B·L', '=ades_b*B_sap*Lm', 'kN', 'Zero por padrão.', 'res', '0.00', 'R_ad')
Lf('FS = (atrito + adesão + passivo)/Hk', '=(R_at+R_ad+E_p)/H_k', '', 'Mínimo nas Entradas.', 'key', '0.00', 'FS_d')
r += 1
section(Fd, r, '6. Tensões no solo'); r += 1
Lf('σ média = N/(B·L)', '=N_tot/(B_sap*Lm)', 'kPa', '', 'res', '0.0', 's_med')
Lf('Caso de pressão', '=IF(ABS(e_f)<=B_sap/6,"Trapézio (|e| ≤ B/6, sapata toda comprimida)",IF(ABS(e_f)<B_sap/2,"Triângulo (|e| > B/6, parte da sapata descola)","Resultante fora da base"))', '', '', 'res')
Lf('Comprimento comprimido', '=IF(ABS(e_f)<=B_sap/6,B_sap,3*(B_sap/2-ABS(e_f)))', 'm', '', 'res', '0.000', 'c_len')
Lf('σ máx', '=IF(ABS(e_f)<=B_sap/6,s_med*(1+6*ABS(e_f)/B_sap),2*N_tot/(c_len*Lm))', 'kPa', '', 'key', '0.0', 's_hi')
Lf('σ mín', '=IF(ABS(e_f)<=B_sap/6,s_med*(1-6*ABS(e_f)/B_sap),0)', 'kPa', '', 'res', '0.0', 's_lo')
Lf('Lado da σ máx', '=IF(e_f>=0,"pé (borda externa)","talão (borda aterrada)")', '', '', 'res')
# Duas regras práticas pelo SPT da base, cada uma com a faixa de N em que vale (Jose, 10/10: calculadora embaixo da
# Fig. 15). Só sugestão: o σadm usado é o digitado ou o automático abaixo.
Lf('Sugestão: 20·SPT (N/50 MPa)', '=20*SPT_b', 'kPa', 'Regra prática (Cintra, Aoki e Albiero). Vale para 5 ≤ N ≤ 20.', 'sug', '0', 'sadm_20N', 'Cintra, Aoki e Albiero (2011)')
Lf('20·SPT: faixa de validade', '=IF(AND(SPT_b>=5,SPT_b<=20),"Dentro (5 ≤ N ≤ 20)","Fora (vale para 5 ≤ N ≤ 20)")', '', '', 'res', None, 'sadm_20N_fx')
Lf('Sugestão: Mello 100·(√SPT − 1)', '=100*(SQRT(SPT_b)-1)', 'kPa', 'Mello (1975). Vale para 4 ≤ N ≤ 16.', 'sug', '0', 'sadm_mel', 'Mello (1975), em Cintra, Aoki e Albiero (2011)')
Lf('Mello: faixa de validade', '=IF(AND(SPT_b>=4,SPT_b<=16),"Dentro (4 ≤ N ≤ 16)","Fora (vale para 4 ≤ N ≤ 16)")', '', '', 'res', None, 'sadm_mel_fx')
# Automático = 20·SPT DENTRO da faixa da regra (Jose, 14/10: "o auto tem de ser sempre a favor da segurança"):
# acima de 20 golpes conta 20 (teto 400 kPa: a regra não garante mais que isso); abaixo de 5 não há automático —
# solo mole pede ensaio, e a verificação da tensão reprova até o σadm ser digitado. O digitado manda sempre.
Lf('σadm usado', '=IF(ISNUMBER(sig_adm_dir),sig_adm_dir,IF(SPT_b>=5,20*MIN(SPT_b,20),"—"))', 'kPa',
   'Em branco: 20·mín(SPT; 20). Com SPT < 5 a regra não vale: digitar o σadm.', 'res', '0', 's_adm')
r += 1
section(Fd, r, '7. Flexão e cortante transversais (por metro, NBR 6118)'); r += 1
Lf('fck', '=VALUE(MID(fck_fund,2,2))', 'MPa', 'Concreto da fundação (Entradas).', 'res', '0', 'fck_s')
Lf('fcd', '=fck_s/1.4', 'MPa', '', 'res', '0.00', 'fcd_s')
Lf('d', '=h_sap*100-cob_sap-phi_sap/20', 'cm', '', 'res', '0.00', 'd_s')
_S0 = r  # memória das fatias fica no fim; aqui só os resultados
Lf('Mk na face do muro — ponta (traciona embaixo)', '=SUM(T_dM)', 'kN·m/m', 'Pressão do solo − peso da sapata − aterro sobre a ponta, integrada em 20 fatias (memória no fim da aba).', 'res', '0.00', 'Mk_toe')
Lf('Mk na face do muro — talão (traciona em cima)', '=SUM(H_dM)', 'kN·m/m', 'Solo + sobrecarga + sapata − pressão do solo. Talão em balanço (a favor da segurança; os contrafortes ajudariam).', 'res', '0.00', 'Mk_heel')
for tag, lab, mk in (('t', 'ponta', 'Mk_toe'), ('h', 'talão', 'Mk_heel')):
    Lf(f'Md {lab} = 1,4·Mk', f'=1.4*MAX(0,{mk})', 'kN·m/m', '', 'res', '0.00', f'Md_{tag}s')
    Lf(f'x {lab}', f'=IFERROR(1.25*d_s*(1-SQRT(1-Md_{tag}s*100/(0.425*100*d_s^2*fcd_s/10))),"não resiste")', 'cm', 'Bloco 0,8x com 0,85fcd.', 'res', '0.00', f'x_{tag}s')
    Lf(f'As {lab}', f'=IFERROR(Md_{tag}s*100/(fyk_/gama_s/10*(d_s-0.4*x_{tag}s)),"—")', 'cm²/m', '', 'res', '0.00', f'As_{tag}s')
Lf('As,mín = 0,15%·b·h', '=0.0015*100*h_sap*100', 'cm²/m', 'NBR 6118 (fck ≤ 30).', 'res', '0.00', 'As_ms')
Lf('As principal (maior entre ponta, talão e mínimo)', '=MAX(IF(ISNUMBER(As_ts),As_ts,0),IF(ISNUMBER(As_hs),As_hs,0),As_ms)', 'cm²/m', 'Mesma armadura nas duas faces se os dois balanços pedirem.', 'key', '0.00', 'As_ps')
Lf('Espaçamento com o Ø principal', '=MIN(20,2*h_sap*100,ROUNDDOWN(PI()*phi_sap^2/400/As_ps*100,0))', 'cm', 'NBR 6118: ≤ 20 cm e ≤ 2h.', 'key', '0', 's_ps')
Lf('As secundária = máx(0,9; 20% As; 0,5·As,mín)', '=MAX(0.9,0.2*As_ps,0.5*As_ms)', 'cm²/m', '', 'res', '0.00', 'As_ss')
Lf('Espaçamento com o Ø secundário', '=MIN(33,ROUNDDOWN(PI()*phi_sap2^2/400/As_ss*100,0))', 'cm', '', 'res', '0', 's_ss')
Lf('fctd = 0,7·0,3·fck^(2/3)/1,4', '=0.21*fck_s^(2/3)/1.4', 'MPa', '', 'res', '0.000', 'fctd_s')
Lf('k = 1,6 − d ≥ 1', '=MAX(1,1.6-d_s/100)', '', '', 'res', '0.000', 'k_s')
Lf('ρ1 = As/(b·d) ≤ 2%', '=MIN(0.02,As_ps/(100*d_s))', '', '', 'res', '0.0000', 'rho_s')
Lf('VRd1 = 0,25·fctd·k·(1,2 + 40ρ1)·b·d', '=0.25*fctd_s*1000*k_s*(1.2+40*rho_s)*d_s/100', 'kN/m', 'NBR 6118 19.4.1 (laje sem estribo).', 'key', '0.00', 'VRd1_s')
Lf('VSd ponta (a d da face)', '=1.4*MAX(0,SUM(T_dV))', 'kN/m', '', 'res', '0.00', 'Vsd_t')
Lf('VSd talão (a d da face)', '=1.4*MAX(0,SUM(H_dV))', 'kN/m', '', 'res', '0.00', 'Vsd_h')
# Biela comprimida no contorno C (Jose, 14/10). "O fenômeno da punção não ocorre nas sapatas corridas rígidas, porém,
# conforme a NBR 6118 (19.5.3.1), a tensão de compressão na diagonal comprimida deve ser verificada na superfície
# crítica C" (Bastos, Sapatas de Fundação, 1.7.1). Vinda da aba Sapata sobre molas (13/10), que saiu. Faixa de 1 m do
# muro como pilar C1 = t × C2 = 100 cm com o momento da base (K = 0,45, C1/C2 < 0,5): DEDUÇÃO; o contorno conta só as
# duas faces compridas (u0 = 2·100 cm) — o muro continua dos dois lados, as pontas da faixa não são borda (a favor).
_iv = {lab: v0 + j for j, (lab, _, _) in enumerate(VERT)}   # linha de cada parcela na tabela de cargas
def _ktab(rz): return f'IF({rz}<=0.5,0.45,IF({rz}<=1,0.45+({rz}-0.5)*0.3,IF({rz}<=2,0.6+({rz}-1)*0.1,IF({rz}<=3,0.7+({rz}-2)*0.1,0.8))))'
Lf('τRd2 = 0,27·αv·fcd (αv = 1 − fck/250)', '=0.27*(1-fck_s/250)*fcd_s', 'MPa', 'Compressão diagonal no contorno C.', 'res', '0.000', 'tauRd2_s', 'NBR 6118 19.5.3.1')
Lf('Muro: FSd = 1,4·(peso do muro + carga no topo)/L', f"=1.4*(B{_iv['Muro (peso próprio)']}+B{_iv['Carga permanente no topo']})/Lm", 'kN/m', 'Sem descontar a reação do solo (a favor), como Bastos, Ex. 6.', 'res', '0.00', 'Fw_s')
Lf('Muro: MSd = 1,4·Mk na base do muro', '=1.4*(Mk_+Mk_w)', 'kN·m/m', '', 'res', '0.00', 'Mw_s')
Lf('Muro: τSd = FSd/(u0·d) + K·MSd/(Wp0·d); u0 = 200 cm, Wp0 = t²/2 + 100·t, K = 0,45', '=(Fw_s/(200*d_s)+0.45*Mw_s*100/((t_bloco^2/2+100*t_bloco)*d_s))*10', 'MPa',
   'Faixa de 1 m como pilar t × 100 cm (dedução).', 'key', '0.000', 'tw_s', 'NBR 6118 19.5.2.2 e 19.5.3.1')
Lf('Contraforte: K da Tabela 19.2 por C1/C2 = tenr/t (interpolado)', '=IF(Tipo_muro="Contrafortes",' + _ktab('tenr_adot/t_bloco') + ',0)', '', 'Interpolar a tabela é dedução.', 'res', '0.000', 'K_cc', 'NBR 6118 Tab. 19.2')
Lf('Contraforte: FSd = 1,4·peso do contraforte', f"=IF(Tipo_muro=\"Contrafortes\",1.4*B{_iv['Contraforte']},0)", 'kN', 'Sem descontar a reação do solo dentro do contorno (a favor).', 'res', '0.00', 'Fc_s')
Lf('Contraforte: MSd = Md do contraforte', '=IF(Tipo_muro="Contrafortes",Md_cf,0)', 'kN·m', 'Aba Contrafortes.', 'res', '0.00', 'Mc_s')
Lf('Contraforte: τSd = FSd/(u0·d) + K·MSd/(Wp0·d); u0 = 2(C1 + C2), Wp0 = C1²/2 + C1·C2',
   '=IF(Tipo_muro="Contrafortes",(Fc_s/(2*(tenr_adot+t_bloco)*d_s)+K_cc*Mc_s*100/((tenr_adot^2/2+tenr_adot*t_bloco)*d_s))*10,0)', 'MPa',
   'Pilar C1 = comprimento do contraforte (direção do momento) × C2 = t.', 'key', '0.000', 'tc_s', 'NBR 6118 19.5.3.1')
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
# Mínimo com bw = 2·he (Jose, 14/10): as duas paredes da seção vazada equivalente são as que trabalham na torção.
# Com bw = B (o mínimo de viga com a sapata inteira) a aula 12.3 pediria Ø10 c/7 para uma torção que o cálculo
# resolve com 0,73 cm²/m — a sapata não é viga. DEDUÇÃO nossa; antes o espaçamento ignorava o mínimo.
Lf('Mínimo de estribo: ρsw = 0,2·fctm/fywk (bw = 2·he)', '=IF(T_sd>0,0.2*0.3*fck_s^(2/3)/fyk_*2*he_s*100*100/2,0)', 'cm²/m', 'Por ramo (NBR 6118 17.4.1.1.1), bw = as duas paredes da seção vazada (dedução).', 'res', '0.00', 'A90_m')
Lf('Ø do estribo de torção: espaçamento', '=IF(T_sd>0,MIN(20,ROUNDDOWN(PI()*phi_tor^2/400/MAX(A90_s,A90_m,0.0001)*100,0)),"—")', 'cm', 'Pelo maior entre o cálculo e o mínimo; até 20 cm.', 'res', '0', 's_tor_f')
r += 1
section(Fd, r, '9. Verificações'); r += 1
Lf('h mínimo para sapata rígida = (B − t)/3', '=(B_sap-t_bloco/100)/3', 'm', 'NBR 6118 22.6.1: h ≥ (a − ap)/3; sapata corrida: a = B, ap = t (Bastos, 1.7).', 'res', '0.000', 'h_rig', 'NBR 6118 22.6.1')
CHKF = [
    ('Sapata rígida: h ≥ (B − t)/3', '=IF(h_sap>=h_rig-0.0005,"OK — rígida (h = "&FIXED(h_sap,2)&" ≥ "&FIXED(h_rig,2)&" m)","NÃO OK — sapata flexível (h = "&FIXED(h_sap,2)&" < "&FIXED(h_rig,2)&" m): reavaliar as condições de contorno (altura, largura, posição do muro)")'),
    ('Muro apoiado na sapata', '=IF(AND(a_ater>=t_m/2-0.001,a_ater<=B_sap-t_m/2+0.001),"OK","NÃO OK — o muro sai da sapata: distância da borda aterrada ao eixo deve ficar entre t/2 e B − t/2")'),
    ('Contraforte apoiado na sapata', '=cf_cabe'),
    ('Tombamento: FS ≥ mínimo', '=IF(FS_t>=FS_tomb,"OK (FS = "&FIXED(FS_t,2)&")","NÃO OK (FS = "&FIXED(FS_t,2)&" < "&FIXED(FS_tomb,1)&")")'),
    ('Tombamento: |e| ≤ B/4', '=IF(ABS(e_f)<=B_sap/4,"OK (e = "&FIXED(e_f*100,1)&" cm)","NÃO OK (e = "&FIXED(e_f*100,1)&" cm > "&FIXED(B_sap*25,1)&")")'),
    ('Tombamento: resultado (vale o pior)', '=IF(AND(FS_t>=FS_tomb,ABS(e_f)<=B_sap/4),"OK","NÃO OK")'),
    # FS_d em texto (sem φ'b; ou Hk = 0) daria VERDADEIRO no ≥ do Excel: o ÉNÚM vem antes
    ('Deslizamento: FS ≥ mínimo', '=IF(ISNUMBER(FS_d),IF(FS_d>=FS_desl,"OK (FS = "&FIXED(FS_d,2)&")","NÃO OK (FS = "&FIXED(FS_d,2)&" < "&FIXED(FS_desl,1)&") — aumentar B, dente ou peso"),IF(ISNUMBER(phi_b),"—","NÃO OK — digitar o φ\' do solo de apoio (sondagem)"))'),
    # σadm em texto (SPT < 5 sem valor digitado): número ≤ texto daria VERDADEIRO no Excel — por isso o ÉNÚM antes
    ('Tensão: σ máx ≤ σadm', '=IF(ISNUMBER(s_adm),IF(s_hi<=s_adm,"OK ("&FIXED(s_hi,0)&" ≤ "&FIXED(s_adm,0)&" kPa)","NÃO OK ("&FIXED(s_hi,0)&" > "&FIXED(s_adm,0)&" kPa)"),"NÃO OK — SPT < 5: digitar o σadm (ensaio)")'),
    ('Tensão: sapata toda comprimida (|e| ≤ B/6)', '=IF(ABS(e_f)<=B_sap/6,"Sim","Não — parte descola (informativo)")'),
    ('Flexão da sapata', '=IF(AND(ISNUMBER(x_ts),ISNUMBER(x_hs)),"OK — Ø"&IF(phi_sap=INT(phi_sap),FIXED(phi_sap,0),FIXED(phi_sap,1))&" c/"&FIXED(s_ps,0)&" ("&FIXED(As_ps,2)&" cm²/m)","NÃO OK — aumentar a altura")'),
    ('Cortante sem estribo (ponta e talão)', '=IF(MAX(Vsd_t,Vsd_h)<=VRd1_s,"OK ("&FIXED(MAX(Vsd_t,Vsd_h),1)&" ≤ "&FIXED(VRd1_s,1)&" kN/m)","NÃO OK — aumentar a altura")'),
    ('Torção: TSd ≤ TRd2', '=IF(T_sd=0,"— (sem contrafortes)",IF(T_sd<=TRd2_s,"OK ("&FIXED(T_sd,1)&" ≤ "&FIXED(TRd2_s,1)&" kN·m)","NÃO OK — aumentar a seção"))'),
    # no fim da lista: as linhas de cima têm endereço lido pelo app (espaçamento do estribo de torção)
    ('Dente dentro da sapata', '=IF(OR(b_den<=0,h_den<=0),"— (sem dente)",IF(ABS(x_den)<=(B_sap-b_den)/2+0.0005,"OK","NÃO OK — o dente sai da sapata: |x| ≤ (B − b)/2"))'),
    ('Compressão diagonal na face do muro', '=IF(tw_s<=tauRd2_s,"OK ("&FIXED(tw_s,3)&" ≤ "&FIXED(tauRd2_s,3)&" MPa)","NÃO OK ("&FIXED(tw_s,3)&" > "&FIXED(tauRd2_s,3)&" MPa) — aumentar a altura")'),
    ('Compressão diagonal junto ao contraforte', '=IF(Tipo_muro<>"Contrafortes","— (muro em balanço)",IF(tc_s<=tauRd2_s,"OK ("&FIXED(tc_s,3)&" ≤ "&FIXED(tauRd2_s,3)&" MPa)","NÃO OK ("&FIXED(tc_s,3)&" > "&FIXED(tauRd2_s,3)&" MPa) — aumentar a altura"))'),
    ('Torção: espessura equivalente he', '=IF(T_sd=0,"— (sem contrafortes)",IF(he_s>=2*c_eixo_s,"OK (A/u ≥ 2·c1)",IF(he_s<=MIN(B_sap,h_sap)-2*c_eixo_s,"OK (A/u < 2·c1: Ae pelos eixos das barras de canto)","NÃO OK — A/u > bw − 2·c1: aumentar a altura da sapata")))'),
    # Eco do resultado da seção 11, para quem lê a lista não perder o dente. No FIM da lista: só descem as seções 10,
    # 11 e a memória das fatias, que ninguém lê por endereço (nomes, e os cards pelo rótulo da coluna A).
    ('Dente: armadura (seção 11)', '=res_den'),
]
# Nome nas linhas que o app lê (antes por endereço: B101, B102, B104, B105 — uma linha nova acima as mudava de lugar).
NOME_CHK = {'Tombamento: FS ≥ mínimo': 'chk_fs_t', 'Tombamento: |e| ≤ B/4': 'chk_e_t',
            'Deslizamento: FS ≥ mínimo': 'chk_fs_d', 'Tensão: σ máx ≤ σadm': 'chk_sig',
            'Sapata rígida: h ≥ (B − t)/3': 'chk_rig', 'Compressão diagonal na face do muro': 'chk_bw',
            'Compressão diagonal junto ao contraforte': 'chk_bc',
            # nomes de 15/11 (diagrama de esforços): as demais verificações, que só tinham rótulo
            'Muro apoiado na sapata': 'chk_apoio_s', 'Contraforte apoiado na sapata': 'chk_cf_s',
            'Tombamento: resultado (vale o pior)': 'chk_tomb', 'Tensão: sapata toda comprimida (|e| ≤ B/6)': 'chk_comp_s',
            'Flexão da sapata': 'chk_fl_s', 'Cortante sem estribo (ponta e talão)': 'chk_v_s',
            'Torção: TSd ≤ TRd2': 'chk_tor_s', 'Dente dentro da sapata': 'chk_den_in',
            'Torção: espessura equivalente he': 'chk_he_s', 'Dente: armadura (seção 11)': 'chk_den_s'}
assert set(NOME_CHK) == {lab for lab, _ in CHKF}, 'verificação sem nome na aba Fundação'
for lab, f in CHKF:
    Lf(lab, f, '', '', 'key', None, NOME_CHK.get(lab))
r += 1
# ---------- 10. esperas: dobra do pé na sapata ----------
# Seção nova (09/10) DEPOIS das verificações e antes da memória das fatias: as seções 1 a 9 ficam nos mesmos endereços,
# que a memória do app (cards/estabilidade.ts) e a modulação (leitura.ts, estribo de torção) leem pelo endereço. A
# memória das fatias desceu: o app a lê pelos nomes T_dM/H_dM/T_dV/H_dV, e o gabarito é refeito pelo golden.
# A conta é a da lista dos Ø com espera (h_dobra, build_new.py): a lista só oferece o Ø que cabe, e estas linhas
# mostram a conta de cada espera do muro escolhido. "—" quando a barra não existe nesse muro ou a espera é reta.
section(Fd, r, '10. Esperas — dobra do pé na sapata e traspasse no graute'); r += 1
_h = 'h_sap*100'
ESP = [('Balanço: espera do Ø vertical', 'phi_v', 'hdob_v', 'Tipo_muro<>"Contrafortes"'),
       ('Contrafortes: espera do Ø vertical do painel', 'phi_pv', 'hdob_pv', 'Tipo_muro="Contrafortes"'),
       ('Contrafortes: espera do Ø principal do contraforte', 'phi_cf', 'hdob_cf', 'Tipo_muro="Contrafortes"'),
       ('Contrafortes: espera das construtivas', 'phi_cc', 'hdob_cc', 'AND(Tipo_muro="Contrafortes",n_cc>0)')]
for i, (lab, ph, nm_, cnd) in enumerate(ESP):
    Lf(f'{lab}: 2c + malha + D + 2φ', f'=IF(AND({cnd},gancho_="Sim"),{h_dobra(ph)},"—")', 'cm',
       'D = 5φ (φ < 20 mm) ou 8φ (φ ≥ 20 mm). 2c e malha (Ø transversal + Ø longitudinal, onde o pé da espera apoia): dedução.' if i == 0 else '',
       'res', '0.00', nm_, 'NBR 6118 Tab. 9.1 + dedução')
# Veredito pela maior das esperas do muro (a conta cresce com o Ø). O "—" vira 0 com ÉNÚM antes do MÁXIMO, em vez de
# confiar que o MÁXIMO pula texto lido por referência: fica explícito, e o motor do app não precisa imitar essa regra.
_hmax = 'MAX(' + ','.join(f'IF(ISNUMBER({nm_}),{nm_},0)' for _, _, nm_, _ in ESP) + ')'
# Com contrafortes são duas ou três esperas: a lista de todas e a maior, que é a que se compara com a sapata.
_partes = ('IF(Tipo_muro="Contrafortes","painel Ø"&' + fphi('phi_pv') + '&": "&FIXED(hdob_pv,1)&" · contraforte Ø"&'
           + fphi('phi_cf') + '&": "&FIXED(hdob_cf,1)&IF(ISNUMBER(hdob_cc)," · construtivas Ø"&' + fphi('phi_cc')
           + f'&": "&FIXED(hdob_cc,1),"")&" cm; maior "&FIXED({_hmax},1),"Ø"&' + fphi('phi_v') + '&": "&FIXED(hdob_v,1))')
Lf('Dobra da espera: 2c + malha + D + 2φ ≤ h da sapata',
   f'=IF(gancho_<>"Sim","— (espera reta, sem dobra)",IF({_hmax}<={_h},"OK — ","NÃO OK — ")&{_partes}'
   f'&IF({_hmax}<={_h}," ≤ "," > ")&FIXED({_h},1)&" cm"&IF({_hmax}<={_h},"",": baixar o Ø ou aumentar a altura da sapata"))',
   '', 'Os Ø com espera só aceitam valores cuja dobra cabe (lista na aba Referências, coluna AS).', 'key', None, 'dob_esp',
   'NBR 6118 Tab. 9.1 + dedução')
# Traspasse espera × barra do muro (Jose, 13/10: "NBR 6118: 2,0 × ℓb no graute"). A emenda fica DENTRO do furo
# grauteado, então a aderência é a do graute (fgk no lugar do fck, como a NBR 16868 manda seguir a 6118). α0t = 2,0
# porque todas as esperas emendam na mesma seção (a base do muro: mais de 50% das barras, Tab. 9.4). Quem defasar as
# emendas digita um traspasse menor no app (traspasse_dir). Antes o app usava o ℓb da ancoragem NA SAPATA (concreto,
# com gancho: 21 cm no muro padrão) — comprimento de outra peça e de outro material, contra a segurança.
# As,calc/As,ef de cada barra: o As do MOMENTO (não o mínimo), como o r_anc da ancoragem; construtiva não tem conta
# (usa 1, a favor). No painel com barra nas duas faces, vale a face que pede mais.
Lf('fbd no graute = 2,25·η2·η3·0,21·fgk^(2/3)/1,4', '=2.25*1*1*0.21*fgk_^(2/3)/1.4', 'MPa',
   'η1 = 2,25 (CA-50 nervurada); η2 = 1,0 (barra vertical, boa aderência); η3 = 1,0 (φ < 32 mm). fgk no lugar do fck.',
   'res', '0.000', 'fbd_gr', 'NBR 6118 9.3.2.1')
Lf('ℓb reto no graute, em diâmetros = fyd/(4·fbd)', '=fyd_/(4*fbd_gr)', 'Ø', '', 'res', '0.0', 'lbphi_gr', 'NBR 6118 9.4.2.4')
Lf('α0t (todas as emendas na mesma seção: a base)', 2, '', 'Mais de 50% das barras emendadas na mesma seção.', 'res', '0.0', 'a0t', 'NBR 6118 Tab. 9.4')
Lf('Painel: As,calc/As,ef da barra vertical', '=IF(ISNUMBER(As_pvs),IFERROR(MIN(1,MAX(As_pvs,IF(ISNUMBER(As_pve),As_pve,0))/a_pv),1),1)', '',
   'As do momento (sem o mínimo); com barra nas duas faces, a face que pede mais.', 'res', '0.000', 'r_pv')
Lf('Contraforte: As,calc/As,ef da principal', '=IF(ISNUMBER(As_cfn),IFERROR(MIN(1,As_cfn/As_cfe),1),1)', '', 'As do momento (sem o mínimo).', 'res', '0.000', 'r_cf')
TRP = [('Balanço: traspasse do Ø vertical', 'phi_v', 'r_anc', 'l0t_v', 'Tipo_muro<>"Contrafortes"'),
       ('Contrafortes: traspasse do Ø vertical do painel', 'phi_pv', 'r_pv', 'l0t_pv', 'Tipo_muro="Contrafortes"'),
       ('Contrafortes: traspasse do Ø principal do contraforte', 'phi_cf', 'r_cf', 'l0t_cf', 'Tipo_muro="Contrafortes"'),
       ('Contrafortes: traspasse das construtivas', 'phi_cc', '1', 'l0t_cc', 'AND(Tipo_muro="Contrafortes",n_cc>0)')]
for i, (lab, ph, rr, nm_, cnd) in enumerate(TRP):
    _lb = f'lbphi_gr*{ph}/10'
    Lf(f'{lab} = α0t·ℓb·As,calc/As,ef ≥ ℓ0t,mín', f'=IF({cnd},CEILING(MAX(a0t*{_lb}*{rr},0.3*a0t*{_lb},1.5*{ph},20),1),"—")', 'cm',
       'ℓ0t,mín = máx(0,3·α0t·ℓb; 15φ; 20 cm). Acima do topo da sapata.' if i == 0 else '', 'key', '0', nm_, 'NBR 6118 9.5.2.2.1')
# As emendas que não são de espera (barra horizontal da canaleta a cada 12 m, longitudinal da sapata) o app faz com o
# mesmo α0t e o ℓb do material onde a emenda fica: graute (lbphi_gr) ou o concreto da sapata (lbphi_c, zona boa —
# barra de baixo, em peça com h < 60 cm).
Lf('ℓb reto no concreto da sapata, em diâmetros = fyd/(4·2,25·fctd)', '=fyd_/(4*2.25*fctd_s)', 'Ø',
   'Emendas da armadura longitudinal da sapata (zona de boa aderência).', 'res', '0.0', 'lbphi_c', 'NBR 6118 9.4.2.4')
r += 1
# ---------- memória: fatias ----------
section(Fd, r, 'Memória — pressão do solo integrada em 20 fatias por balanço (ponta e talão)', 8); r += 1
Fd.cell(row=r, column=1, value='σ(x): trapézio se |e| ≤ B/6; triângulo a partir da borda mais comprimida se |e| > B/6. Ponta: q = σ − γc·h − γ·h aterro (para cima; o aterro só com a garantia do solo da frente). Talão: q = γ·h solo + q + γc·h − σ (para baixo).').font = fS; r += 1
def sig(xc):
    d_ = f'IF(e_f>=0,B_sap-{xc},{xc})'
    return f'IF(ABS(e_f)<=B_sap/6,s_hi-(s_hi-s_lo)*{d_}/B_sap,MAX(0,s_hi*(1-{d_}/c_len)))'
for tag, lab in (('T', 'Ponta'), ('H', 'Talão')):
    # Colunas H–L (15/11, diagrama de esforços): M e V ACUMULADOS da ponta livre até a face do muro, na seção do lado
    # da face de cada fatia (distância e da face: ponta (i − 1)·L/20, talão (20 − i)·L/20). Na face (e = 0) o M é a
    # SOMA das 20 fatias, a mesma do Mk_toe / Mk_heel, bit a bit; na ponta livre (e = L) é zero (não tem linha).
    #   M(e) = Σ dM das fatias além da seção − e·V(e);  V(e) = Σ q·L/20 das fatias além da seção
    # Característicos, por metro (+ = o sentido da armadura da peça: ponta traciona embaixo, talão em cima). De
    # cálculo: × 1,4 (a seção 7 usa 1,4 fixo, Md = 1,4·máx(0; Mk)); colunas K e L, sem o máx(0; …).
    header(Fd, r, [f'{lab}: fatia', 'x (m)', 'σ (kPa)', 'q líquida (kPa)', 'braço à face (m)', 'dM (kN·m/m)', 'dV além de d (kN/m)',
                   'e: seção a partir da face (m)', 'M acumulado (kN·m/m)', 'V acumulado (kN/m)', 'MSd = 1,4·M (kN·m/m)', 'VSd = 1,4·V (kN/m)']); r += 1
    r0 = r
    for i in range(1, 21):
        Fd.cell(row=r, column=1, value=i)
        if tag == 'T':
            Fd[f'B{r}'] = f'=a_ater+t_m/2+({i}-0.5)*toe/20'
            Fd[f'C{r}'] = '=' + sig(f'B{r}')
            Fd[f'D{r}'] = f'=C{r}-gama_c*h_sap-IF(pass_on="Sim",gama_solo*h_fr,0)'
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
        _L = 'toe' if tag == 'T' else 'heel'
        _ie = lambda f: '=IFERROR(' + f + ',"—")'
        if tag == 'T':    # fatia 1 junto à face; as de índice maior ficam além da seção
            Fd[f'H{r}'] = _ie(f'({i}-1)*toe/20'); _rg = f'{r}:{{c}}{r0 + 19}'
        else:             # fatia 20 junto à face; as de índice menor ficam além da seção
            Fd[f'H{r}'] = _ie(f'(20-{i})*heel/20'); _rg = f'{r0}:{{c}}{r}'
        Fd[f'J{r}'] = _ie(f'SUM(D{_rg.format(c="D")})*{_L}/20')
        Fd[f'I{r}'] = _ie(f'SUM(F{_rg.format(c="F")})-H{r}*J{r}')
        Fd[f'K{r}'] = _ie(f'1.4*I{r}')
        Fd[f'L{r}'] = _ie(f'1.4*J{r}')
        # Colunas M–R (15/11, 2ª versão da vista Esforços): o As da seção 7 em cada seção, com o Md da seção —
        # Md = 1,4·máx(0; M), x pelo bloco 0,8x com 0,85fcd, As = Md/(fyd·(d − 0,4x)). Na face (e = 0) o M é o Mk_toe /
        # Mk_heel bit a bit e as três colunas dão o Md_ts/x_ts/As_ts (Md_hs…) da seção 7. M–O: a face que a peça
        # arma (ponta embaixo, talão em cima); P–R: a face oposta, com o M de sinal trocado.
        for c0, sinal in (('MNO', ''), ('PQR', '-')):
            cM, cX, cA = c0
            Fd[f'{cM}{r}'] = _ie(f'1.4*MAX(0,{sinal}I{r})')
            Fd[f'{cX}{r}'] = _ie(f'IFERROR(1.25*d_s*(1-SQRT(1-{cM}{r}*100/(0.425*100*d_s^2*fcd_s/10))),"não resiste")')
            Fd[f'{cA}{r}'] = _ie(f'{cM}{r}*100/(fyk_/gama_s/10*(d_s-0.4*{cX}{r}))')
        for cc in 'ABCDEFGHIJKLMNOPQR':
            c = Fd[f'{cc}{r}']; c.border = BOX; c.font = fN
            if cc != 'A': c.number_format = '0.000'
        r += 1
    header(Fd, r0 - 1, ['Md = 1,4·máx(0; M)', 'x (cm)', 'As (cm²/m)', 'Md face oposta', 'x (cm)', 'As face oposta (cm²/m)'], start=13)
    for _sf, _cc in (('As', 'O'), ('Aso', 'R')):
        wb.defined_names[f'{tag}_{_sf}'] = DefinedName(f'{tag}_{_sf}', attr_text=f"'Fundação'!${_cc}${r0}:${_cc}${r-1}")
    for _sf, _cc in (('e', 'H'), ('Mk', 'I'), ('Vk', 'J'), ('Md', 'K'), ('Vd', 'L')):
        wb.defined_names[f'{tag}_{_sf}'] = DefinedName(f'{tag}_{_sf}', attr_text=f"'Fundação'!${_cc}${r0}:${_cc}${r-1}")
    wb.defined_names[f'{tag}_dM'] = DefinedName(f'{tag}_dM', attr_text=f"'Fundação'!$F${r0}:$F${r-1}")
    wb.defined_names[f'{tag}_dV'] = DefinedName(f'{tag}_dV', attr_text=f"'Fundação'!$G${r0}:$G${r-1}")
    r += 1
Fd.cell(row=r, column=1, value='Pressão por unidade de área (kPa) vale para qualquer faixa de 1 m do módulo (sapata rígida). Com contrafortes, a diferença entre o Md concentrado do contraforte e a reação uniforme vira a torção da seção 8.').font = fS
r += 2
# ---------- 11. dente: armadura ----------
# Seção nova (15/11) no FIM da aba, depois da memória das fatias: nada do que está acima muda de endereço, e nenhuma
# fórmula de cima lê as daqui — muro sem dente fica igual bit a bit, e o com dente só ganha estas linhas.
# Jose: "a forma de armar é similar à da sapata corrida, porém na vertical, com estribos adentrando a sapata corrida e
# armadura de montagem / mínima no sentido longitudinal do dente; o esforço seria o de deslizamento / tombamento".
# O dente é um balanço pendurado na sapata, empurrado pelo solo da FRENTE (lado da ponta) para trás: traciona a face
# da frente. O empurrão é o passivo CHEIO na face da frente, sem dividir por 2 e sem olhar a garantia do solo da
# frente nem a posição do dente (no deslizamento, seção 3, o mesmo passivo entra dividido por 2 e só quando pode
# contar); a força de cálculo é a maior entre ele × 1,4 e o que o deslizamento pede do dente (Fd_den, abaixo).
section(Fd, r, '11. Dente — armadura (por metro, NBR 6118)'); r += 1
_D = lambda f: f'=IF(tem_den="Sim",{f},"—")'
Lf('Há dente?', '=IF(AND(b_den>0,h_den>0),"Sim","Não")', '', 'Largura e altura do dente maiores que zero (Entradas).', 'res', None, 'tem_den')
Lf('p1 — passivo na raiz do dente = Kp·γ·(h aterro + h)', _D('Kp_b*gama_solo*(h_fr+h_sap)'), 'kPa',
   'Passivo cheio (sem dividir por 2), Kp do solo de apoio (seção 5). Raiz = face de baixo da sapata.', 'res', '0.00', 'p1_den', 'Rankine')
Lf('p2 — passivo no fundo do dente = Kp·γ·(h aterro + h + h dente)', _D('Kp_b*gama_solo*(h_fr+h_sap+h_den)'), 'kPa', '', 'res', '0.00', 'p2_den', 'Rankine')
Lf('Ek = (p1 + p2)/2·h dente', _D('(p1_den+p2_den)/2*h_den'), 'kN/m', 'Resultante na face da frente do dente.', 'res', '0.00', 'Ek_den')
Lf('Mk na raiz = p1·h²/2 + (p2 − p1)·h²/3', _D('p1_den*h_den^2/2+(p2_den-p1_den)*h_den^2/3'), 'kN·m/m', 'Traciona a face da frente (lado da ponta).', 'res', '0.00', 'Mk_den')
Lf('Braço da resultante até a raiz = Mk/Ek', _D('Mk_den/Ek_den'), 'm', 'Abaixo da face de baixo da sapata (entre h/2 e 2h/3 do dente).', 'res', '0.000', 'y_den')
# FORÇA DE CÁLCULO NO DENTE (critério adotado em 15/11, a confirmar com o Jose). O passivo de Rankine é o de superfície
# LIVRE; o solo na frente de um dente debaixo da sapata está confinado pela pressão de contato e pode devolver mais
# que isso — o passivo cheio não é teto. Fica a MAIOR de duas: (a) o passivo cheio de cálculo, 1,4·Ek; (b) o que o
# equilíbrio do deslizamento (seção 5) pede do dente: FS·Hk menos o atrito e a adesão da base, por metro do módulo,
# nunca negativa. (b) já é de cálculo — o FS está na ação; não leva outro γf. É DEDUÇÃO nossa. O braço continua o do
# trapézio do passivo (y = Mk/Ek): a força de (b) se distribui como o passivo na face.
Lf('(a) Passivo cheio de cálculo = 1,4·Ek', _D('1.4*Ek_den'), 'kN/m', '', 'res', '0.00', 'Fa_den')
Lf('(b) Pedido pelo deslizamento = (FS·Hk − atrito − adesão)/L ≥ 0', _D('IF(AND(ISNUMBER(FS_desl),ISNUMBER(H_k),ISNUMBER(R_at),ISNUMBER(R_ad),ISNUMBER(Lm)),MAX(0,(FS_desl*H_k-R_at-R_ad)/Lm),"—")'), 'kN/m',
   'Seção 5, sem o passivo; o FS já está na ação (sem outro 1,4).', 'res', '0.00', 'Fb_den', 'Critério adotado')
Lf('Fd = máx(a; b)', _D('IF(ISNUMBER(Fb_den),MAX(Fa_den,Fb_den),Fa_den)'), 'kN/m', '', 'key', '0.00', 'Fd_den', 'Critério adotado')
Lf('Quem manda', _D('IF(AND(ISNUMBER(Fb_den),Fb_den>Fa_den),"Deslizamento (b)","Passivo cheio (a)")'), '', '', 'res', None, 'gov_den')
Lf('Md = Fd·y', _D('Fd_den*y_den'), 'kN·m/m', '', 'key', '0.00', 'Md_den')
Lf('Vd = Fd', _D('Fd_den'), 'kN/m', 'Na raiz (sem descontar a faixa até d: a favor).', 'key', '0.00', 'Vd_den')
Lf('d = b dente − c − Ø/2', _D('b_den*100-cob_sap-phi_den/20'), 'cm', 'Seção 100 × b dente; cobrimento da sapata até o estribo.', 'res', '0.00', 'd_den')
# Largura mínima para o estribo fechado: duas dobras de 90° no pino do estribo (NBR 6118 Tab. 9.2: 3φ até Ø10, 5φ
# acima, 8φ de Ø20 — a mesma regra do modelo, barras.ts pinoEstribo) mais as duas bitolas e os dois cobrimentos.
# O modelo não arma dente mais estreito que isso (DENTE_ESTREITO): a planilha não pode dizer OK onde não há barra.
# Fora do _D: o dente sem largura (S3) também mostra o mínimo.
Lf('Pino de dobra do estribo do dente', '=IF(phi_den<=10,3,IF(phi_den>=20,8,5))*phi_den/10', 'cm', '3Ø até Ø10; 5Ø; 8Ø a partir de Ø20.', 'res', '0.00', 'pino_den', 'NBR 6118 Tab. 9.2')
Lf('Largura mínima do dente = 2c + 2Ø + pino', '=2*cob_sap+2*phi_den/10+pino_den', 'cm', '', 'res', '0.00', 'bmin_den')
Lf('x', _D('IFERROR(1.25*d_den*(1-SQRT(1-Md_den*100/(0.425*100*d_den^2*fcd_s/10))),"não resiste")'), 'cm', 'Bloco 0,8x com 0,85fcd.', 'res', '0.00', 'xln_den', 'NBR 6118 17.2.2')
Lf('x/d', _D('xln_den/d_den'), '', 'Limite 0,45 (ductilidade).', 'res', '0.000', 'xd_den', 'NBR 6118 14.6.4.3')
Lf('As', _D('Md_den*100/(fyk_/gama_s/10*(d_den-0.4*xln_den))'), 'cm²/m', '', 'res', '0.00', 'As_den')
Lf('As,mín = 0,15%·b·h', _D('0.0015*100*b_den*100'), 'cm²/m', 'O mesmo critério da sapata (seção 7), com h = largura do dente.', 'res', '0.00', 'Asm_den')
Lf('As necessário (maior entre cálculo e mínimo)', _D('IF(ISNUMBER(As_den),MAX(As_den,Asm_den),"—")'), 'cm²/m', 'O estribo fechado põe o mesmo aço nas duas faces.', 'key', '0.00', 'Asn_den')
Lf('Área de um ramo do estribo', _D('PI()*phi_den^2/400'), 'cm²', 'Um ramo por estribo em cada face.', 'res', '0.000', 'Ab_den')
# Automático: o MAIOR espaçamento da série que dá o aço pedido (menos estribo para armar; nunca abaixo do pedido).
# Nenhum da série serve → "—" e a flexão reprova pedindo Ø maior. As que "não resiste" fica em texto: o ÉNÚM vem antes
# do MÁXIMO e das comparações (o Excel pularia o texto no MÁXIMO e o ordenaria acima de qualquer número — regras que
# o motor do app não precisa imitar).
_SER = (20, 15, 12.5, 10, 7.5, 5)
_auto = '"—"'
for _s in reversed(_SER): _auto = f'IF(Ab_den*100/{_s}>=Asn_den,{_s},{_auto})'
Lf('Espaçamento do estribo', _D(f'IF(ISNUMBER(s_den_dir),s_den_dir,IF(ISNUMBER(Asn_den),{_auto},"—"))'), 'cm', 'Digitado (Entradas) ou o maior entre 20; 15; 12,5; 10; 7,5 e 5 cm que atende.', 'key', '0.0', 's_den')
Lf('As,ef = área do ramo/espaçamento', _D('Ab_den/s_den*100'), 'cm²/m', '', 'res', '0.00', 'Ase_den')
Lf('k = 1,6 − d ≥ 1', _D('MAX(1,1.6-d_den/100)'), '', '', 'res', '0.000', 'k_den')
Lf('ρ1 = As,ef/(b·d) ≤ 2%', _D('MIN(0.02,Ase_den/(100*d_den))'), '', '', 'res', '0.0000', 'rho_den')
Lf('VRd1 = 0,25·fctd·k·(1,2 + 40ρ1)·b·d', _D('0.25*fctd_s*1000*k_den*(1.2+40*rho_den)*d_den/100'), 'kN/m', 'NBR 6118 19.4.1 (sem armadura de cortante), como a sapata.', 'key', '0.00', 'VRd1_den', 'NBR 6118 19.4.1')
# Ancoragem das pernas do estribo DENTRO da sapata: sobem até logo abaixo da armadura de cima e fecham lá. As dobras
# de 90° de cima contam como gancho (α = 0,7, NBR 6118 9.4.2.5), como a perna do U da canaleta; os ganchos de 135°
# ficam no canto de baixo, dentro do dente (revisão de 15/11: em cima eles cruzavam as longitudinais da sapata). ℓb reto no concreto da sapata (lbphi_c,
# seção 10; barra em pé = boa aderência).
Lf('ℓb reto no concreto da sapata', _D('lbphi_c*phi_den/10'), 'cm', '', 'res', '0.0', 'lb_den', 'NBR 6118 9.4.2.4')
Lf('ℓb,mín = máx(0,3·ℓb; 10Ø; 10 cm)', _D('MAX(0.3*lb_den,phi_den,10)'), 'cm', '10Ø em cm = Ø em mm.', 'res', '0.0', 'lbm_den', 'NBR 6118 9.4.2.5')
Lf('ℓb,nec = α·ℓb·As,calc/As,ef ≥ ℓb,mín (α = 0,7)', _D('MAX(0.7*lb_den*MIN(1,As_den/Ase_den),lbm_den)'), 'cm', 'As,calc = As do momento (sem o mínimo). Estribo fechado: as dobras de 90° de cima, no pino, contam como gancho.', 'key', '0.0', 'lbn_den', 'NBR 6118 9.4.2.5')
# O ramo de cima do estribo do dente passa POR BAIXO da camada de cima da sapata (Ø principal + Ø secundária abaixo do
# cobrimento): no cobrimento ele bateria nas longitudinais de cima e, com Ø do dente maior que o da sapata, entraria
# nelas (modelo, entorno.ts estriboDoDente). A perna ancorada vai da raiz até o topo desse ramo.
Lf('Ancoragem disponível = h sapata − c − Ø principal − Ø secundária', _D('h_sap*100-cob_sap-(phi_sap+phi_sap2)/10'), 'cm', 'Da raiz do dente ao ramo de cima do estribo, logo abaixo da armadura de cima da sapata.', 'res', '0.0', 'lbd_den')
# Longitudinal de montagem, por face do dente, por dentro do estribo. Critério da armadura secundária de laje (NBR 6118
# Tab. 19.1: 20% da principal e 0,9 cm²/m) aplicado à altura do dente, e uma barra a cada 33 cm no máximo (20.1) —
# usar o critério de laje no dente é DEDUÇÃO. Mínimo de duas por face (o canto de baixo e a raiz).
Lf('As de distribuição = máx(0,9; 20%·As,ef)', _D('MAX(0.9,0.2*Ase_den)'), 'cm²/m', 'Por face, por metro de altura do dente.', 'res', '0.00', 'Asd_den', 'NBR 6118 Tab. 19.1 (dedução)')
Lf('Longitudinais por face', _D('MAX(2,ROUNDUP(Asd_den*h_den/(PI()*phi_lden^2/400)-0.005,0),ROUNDUP(h_den*100/33,0)+1)'), 'barras', 'Pelo menos 2; a área de distribuição na altura do dente; uma a cada 33 cm no máximo.', 'res', '0', 'nf_den')
Lf('Longitudinais do dente (duas faces)', _D('2*nf_den'), 'barras', '', 'key', '0', 'n_lden')
# O dente entrega o momento dele à sapata, e esse momento anda pela sapata do dente até o muro. Dente do lado da PONTA
# (eixo à frente do eixo do muro): traciona a face de CIMA da sapata — alivia a flexão da ponta (que traciona embaixo),
# e o alívio é ignorado; dente do lado do TALÃO (ou sob o muro): traciona a face de BAIXO — alivia o talão. Em vez de
# mexer no Md da sapata (mudaria a armadura de quem já tem dente), uma verificação própria: o momento do dente, levado
# até a face oposta da sapata (Md + Vd·h: cobre o braço até a compressão e a força horizontal que o dente passa),
# mais o momento que a sapata JÁ tem tracionando a mesma face, contra o momento resistente da seção com a armadura
# principal adotada (o estribo da sapata põe o mesmo aço em cima e embaixo). DEDUÇÃO nossa.
Lf('Lado do dente em relação ao muro', _D('IF(B_sap/2+x_den>a_ater+0.0005,"Ponta","Talão")'), '', 'Ponta: o momento do dente traciona a face de cima da sapata; talão (ou sob o muro): a de baixo.', 'res', None, 'lado_den')
Lf('Momento do dente na sapata = Md + Vd·h sapata', _D('Md_den+Vd_den*h_sap'), 'kN·m/m', 'Em relação à face oposta da sapata (dedução, a favor).', 'res', '0.00', 'Mt_den', 'Dedução')
Lf('Momento da sapata que traciona a mesma face', _D('1.4*MAX(0,-IF(lado_den="Ponta",Mk_toe,Mk_heel))'), 'kN·m/m', 'Ponta: face de cima (Mk da ponta negativo); talão: face de baixo (Mk do talão negativo). O que alivia não entra.', 'res', '0.00', 'Mf_den')
Lf('As,ef da sapata (Ø principal no espaçamento adotado)', _D('PI()*phi_sap^2/400/s_ps*100'), 'cm²/m', 'Seção 7.', 'res', '0.00', 'Ase_sap')
Lf('x da sapata com o As,ef = As·fyd/(0,68·b·fcd)', _D('Ase_sap*fyk_/gama_s/10/(0.68*100*fcd_s/10)'), 'cm', '', 'res', '0.00', 'xr_sap')
Lf('MRd da sapata = As,ef·fyd·(d − 0,4x)', _D('Ase_sap*fyk_/gama_s/10*(d_s-0.4*xr_sap)/100'), 'kN·m/m', '', 'key', '0.00', 'MRd_sap', 'NBR 6118 17.2.2')
Lf('MSd na sapata junto ao dente', _D('Mt_den+Mf_den'), 'kN·m/m', '', 'key', '0.00', 'Ms_den', 'Dedução')
_fden = '"Ø"&' + fphi('phi_den') + '&" c/"&IF(s_den=INT(s_den),FIXED(s_den,0),FIXED(s_den,1))'
_SEMD = '"— (sem dente)"'
# Geometria antes de tudo, e sem pedir o φ' (não depende do solo). Altura sem largura (revisão de 15/11): com o solo
# da frente garantido, o deslizamento (seção 3, E_p) conta o passivo pela altura do dente, com ou sem largura — sem
# largura não há dente para armar, e a armadura não pode sair "— (sem dente)" enquanto o deslizamento usa o dente.
# Sem a garantia, largura 0 é o "sem dente" das Entradas (o passivo do dente já pede largura > 0): nada muda.
_bmin = 'FIXED(bmin_den,1)'
Lf('Dente: largura para o estribo',
   f'=IF(tem_den<>"Sim",IF(AND(pass_on="Sim",ISNUMBER(h_den),h_den>0),"NÃO OK — digitar a largura do dente ou zerar a altura",{_SEMD}),'
   f'IF(ISNUMBER(bmin_den)=FALSE,"NÃO OK — conta do dente sem número",IF(b_den*100>=bmin_den-0.0005,"OK (b = "&FIXED(b_den*100,1)&" ≥ "&{_bmin}&" cm)",'
   f'"NÃO OK — dente estreito para o estribo: mínimo "&{_bmin}&" cm")))', '', '', 'key', None, 'chk_geo_den')
CHKD = [
    # espaçamento: o automático sai da série 20…5; o digitado tem de ficar entre 5 e 20 (abaixo de 5 cm não se
    # concreta entre os estribos). O ÉNÚM antes do < 5: texto ("—") seria maior que qualquer número no Excel.
    ('Dente: flexão', 'chk_fl_den',
     'IF(ISNUMBER(xln_den)=FALSE,"NÃO OK — aumentar a largura do dente",IF(xd_den>0.45,"NÃO OK — x/d = "&FIXED(xd_den,2)&" > 0,45: aumentar a largura do dente",'
     'IF(AND(ISNUMBER(s_den),s_den<5),"NÃO OK — espaçamento do estribo abaixo de 5 cm: usar 5 cm ou mais",'
     'IF(ISNUMBER(Ase_den)=FALSE,"NÃO OK — aumentar o Ø do estribo do dente",IF(s_den>20,"NÃO OK — espaçamento do estribo acima de 20 cm",'
     'IF(Ase_den>=Asn_den-0.005,"OK — "&' + _fden + '&" ("&FIXED(Ase_den,2)&" ≥ "&FIXED(Asn_den,2)&" cm²/m)","NÃO OK — "&' + _fden + '&" ("&FIXED(Ase_den,2)&" < "&FIXED(Asn_den,2)&" cm²/m): diminuir o espaçamento ou aumentar o Ø"))))))'),
    ('Dente: cortante sem estribo', 'chk_v_den',
     'IF(Vd_den<=VRd1_den,"OK ("&FIXED(Vd_den,1)&" ≤ "&FIXED(VRd1_den,1)&" kN/m)","NÃO OK ("&FIXED(Vd_den,1)&" > "&FIXED(VRd1_den,1)&" kN/m) — aumentar a largura do dente")'),
    ('Dente: ancoragem do estribo na sapata', 'chk_anc_den',
     'IF(lbd_den>=lbn_den,"OK ("&FIXED(lbd_den,1)&" ≥ "&FIXED(lbn_den,1)&" cm)","NÃO OK ("&FIXED(lbd_den,1)&" < "&FIXED(lbn_den,1)&" cm) — aumentar a altura da sapata ou baixar o Ø do estribo")'),
    # Do lado da ponta o momento do dente traciona a face de CIMA. Barra em cima há quando a transversal é estribo
    # (o ramo de cima) ou, reta, quando o talão pede (Mk_heel > 0) — a MESMA regra do modelo (entorno.ts,
    # sapataReta: faces = Mk_heel > 0 ? I e S : só I). Sem ela, a conta com o MRd da barra de cima seria de mentira.
    ('Dente: momento passado à sapata', 'chk_tr_den',
     'IF(AND(lado_den="Ponta",LEFT(sap_transv,4)="Reta",IF(ISNUMBER(Mk_heel),Mk_heel<=0,TRUE)),"NÃO OK — sem armadura em cima da sapata: usar estribo na sapata",'
     'IF(Ms_den<=MRd_sap,"OK ("&FIXED(Ms_den,1)&" ≤ "&FIXED(MRd_sap,1)&" kN·m/m)","NÃO OK ("&FIXED(Ms_den,1)&" > "&FIXED(MRd_sap,1)&" kN·m/m) — aumentar a altura da sapata ou diminuir o dente"))'),
]
# número contra texto ("—", "não resiste") compara como VERDADEIRO no Excel: os dois lados de cada desigualdade têm
# de ser número antes dela — por isso o ÉNÚM em cima e a lista do que cada verificação lê
_LE = {'chk_fl_den': ('Md_den',), 'chk_v_den': ('Vd_den', 'VRd1_den'), 'chk_anc_den': ('lbd_den', 'lbn_den'), 'chk_tr_den': ('Ms_den', 'MRd_sap')}
# d ≤ 0 (dente mais estreito que o cobrimento): o VRd1 sairia positivo de dois negativos e a flexão de raiz de
# número negativo — nenhuma das quatro pode dizer OK sem altura útil.
_dok = 'AND(ISNUMBER(d_den),d_den>0)'
for _lab, _nm, _f in CHKD:
    _num = 'AND(' + ','.join(f'ISNUMBER({_x})' for _x in _LE[_nm]) + ')'
    Lf(_lab, f'=IF(tem_den<>"Sim",{_SEMD},IF(ISNUMBER(p2_den)=FALSE,"NÃO OK — digitar o φ\' do solo de apoio (sondagem)",'
       f'IF({_dok}=FALSE,"NÃO OK — dente sem altura útil, d ≤ 0: aumentar a largura",IF({_num},{_f},"NÃO OK — conta do dente sem número"))))', '', '', 'key', None, _nm)
CHKD.insert(0, ('Dente: largura para o estribo', 'chk_geo_den', None))
# Só vale "OK…" ou o "— (sem dente)" escrito aqui: o "—" puro seria conta que não fechou (IFERROR do pós-processamento).
_okd = 'AND(' + ','.join(f'LEFT({_nm},2)="OK"' for _, _nm, _ in CHKD) + ')'
_qual = '"conta sem número"'
for _lab, _nm, _ in reversed(CHKD): _qual = f'IF(LEFT({_nm},2)<>"OK","{_lab.split(": ")[1]}",{_qual})'
# sem dente: o que a geometria disse ("— (sem dente)" ou "NÃO OK — digitar a largura do dente")
Lf('Dente: resultado', f'=IF(tem_den<>"Sim",chk_geo_den,IF(ISNUMBER(p2_den)=FALSE,"NÃO OK — digitar o φ\' do solo de apoio (sondagem)",IF({_okd},"OK — estribo "&{_fden}&" + "&FIXED(n_lden,0)&" Ø"&{fphi("phi_lden")}&" corridas","NÃO OK — "&{_qual})))', '',
   'Largura, flexão, cortante, ancoragem do estribo e momento passado à sapata.', 'key', None, 'res_den')
r += 1
# ---------- 12. momentos resistentes com a armadura adotada (15/11, vista "Esforços") ----------
# No FIM da aba, pela mesma razão da seção 11. A conta da seção 7 (NBR 6118, bloco 0,8x com 0,85·fcd, b = 100) e a da
# seção 11 (dente, b = 100) desfeitas com o aço adotado (mrd_ret, build_new.py). γf: os MSd destas peças usam 1,4
# FIXO (seção 7: Md = 1,4·máx(0; Mk); dente: Md_den já é de cálculo). Ao longo da ponta e do talão: as colunas K e L
# das fatias (T_Md, H_Md…). A flexão da sapata (seção 9) não confere a ductilidade: limite = fim da conta (1,25d);
# o dente confere (x/d ≤ 0,45).
section(Fd, r, '12. Momentos resistentes com a armadura adotada (diagrama de momentos)'); r += 1
Lf('As,ef da sapata = Ø principal no espaçamento adotado', '=PI()*phi_sap^2/400/s_ps*100', 'cm²/m', 'Seção 7. A mesma barra embaixo (ponta) e, quando há, em cima (talão).', 'res', '0.00', 'Ase_s')
# Barra em cima: a MESMA regra do chk_tr_den (seção 11) e do modelo (entorno.ts, sapataReta): estribo põe o ramo de
# cima sempre; reta só quando o talão pede (Mk_heel > 0). Sem barra em cima o talão não tem MRd (zero).
Lf('Há armadura em cima (talão)?', '=IF(LEFT(sap_transv,4)="Reta",IF(ISNUMBER(Mk_heel),IF(Mk_heel>0,"Sim","Não"),"Não"),"Sim")', '', 'Estribo: o ramo de cima. Reta: só quando o talão pede (Mk do talão > 0).', 'res', None, 'sup_s')
mrd_ret(Lf, 's', 'Ase_s', 'fyk_/gama_s', '0.68*fcd_s', '0.425*fcd_s', '100', 'd_s', '1.25', False, '1,25·d (fim da conta)')
Lf('MRd da ponta (barra de baixo)', '=IFERROR(MRf_s/100,"—")', 'kN·m/m', 'Compara com o Md da ponta (seção 7).', 'key', '0.00', 'MRd_toe', 'NBR 6118 17.2.2 (conta da flexão invertida)')
Lf('MRd do talão (barra de cima)', '=IFERROR(IF(sup_s="Sim",MRf_s/100,0),"—")', 'kN·m/m', 'Compara com o Md do talão. Zero sem barra em cima.', 'key', '0.00', 'MRd_heel', 'NBR 6118 17.2.2 (conta da flexão invertida)')
Lf('MSd/MRd da ponta', '=IF(Md_ts<=0,0,Md_ts/MRd_toe)', '', '', 'key', '0.000', 'ap_toe')
Lf('MSd/MRd do talão', '=IF(Md_hs<=0,0,Md_hs/MRd_heel)', '', '', 'key', '0.000', 'ap_heel')
Lf('VSd/VRd1 (ponta e talão, a d da face)', '=MAX(Vsd_t,Vsd_h)/VRd1_s', '', 'A verificação "Cortante sem estribo".', 'res', '0.000', 'apV_s')
Fd.cell(row=r, column=1, value='Dente (seção 11)').font = fB; r += 1
mrd_ret(Lf, 'den', 'Ase_den', 'fyk_/gama_s', '0.68*fcd_s', '0.425*fcd_s', '100', 'd_den', '0.45', False, '0,45·d (ductilidade)',
        wrap=lambda f: f'IF(tem_den="Sim",{f},"—")')
Lf('MRd do dente (na raiz)', _D('MRf_den/100'), 'kN·m/m', 'Compara com o Md do dente (seção 11).', 'key', '0.00', 'MRd_den', 'NBR 6118 17.2.2 (conta da flexão invertida)')
Lf('MSd/MRd do dente', _D('Md_den/MRd_den'), '', '', 'key', '0.000', 'ap_den')
r += 1
# ---------- 13. dente ao longo da altura e comprimentos de ancoragem (15/11, 2ª versão da vista "Esforços") ----------
# No FIM da aba, como as seções 11 e 12. O DENTE em 11 seções, da raiz (ζ = 0) ao fundo: a carga abaixo da seção ζ é o
# mesmo trapézio do passivo da seção 11 (pressão pζ na seção, p2 no fundo, comprimento L = h − ζ), e a força de
# cálculo Fd se distribui como ele: Md(ζ) = Md·Mk(ζ)/Mk(0), Vd(ζ) = Vd·Ek(ζ)/Ek(0). Na raiz as operações são as do
# Mk_den e do Ek_den (bit a bit) e a razão é 1: Md(0) = Md_den, Vd(0) = Vd_den. x e As: a conta da seção 11.
section(Fd, r, '13. Dente ao longo da altura e comprimentos de ancoragem (diagrama do aço)'); r += 1
header(Fd, r, ['Seção', 'ζ da raiz (m)', 'pζ (kPa)', 'L = h − ζ (m)', 'Mk abaixo (kN·m/m)', 'Ek abaixo (kN/m)', 'Md (kN·m/m)', 'Vd (kN/m)', 'x (cm)', 'As (cm²/m)']); r += 1
_d0 = r
_ie = lambda f: '=IFERROR(' + f + ',"—")'
for j in range(11):
    Fd.cell(row=r, column=1, value=j)
    _x = lambda f: _ie(f'IF(tem_den="Sim",{f},"—")')
    Fd[f'B{r}'] = _x(f'h_den*A{r}/10')
    Fd[f'C{r}'] = _x(f'p1_den+(p2_den-p1_den)*B{r}/h_den')
    Fd[f'D{r}'] = _x(f'h_den-B{r}')
    Fd[f'E{r}'] = _x(f'C{r}*D{r}^2/2+(p2_den-C{r})*D{r}^2/3')
    Fd[f'F{r}'] = _x(f'(C{r}+p2_den)/2*D{r}')
    Fd[f'G{r}'] = _x(f'Md_den*(E{r}/Mk_den)')
    Fd[f'H{r}'] = _x(f'Vd_den*(F{r}/Ek_den)')
    Fd[f'I{r}'] = _x(f'IFERROR(1.25*d_den*(1-SQRT(1-G{r}*100/(0.425*100*d_den^2*fcd_s/10))),"não resiste")')
    Fd[f'J{r}'] = _x(f'G{r}*100/(fyk_/gama_s/10*(d_den-0.4*I{r}))')
    for cc in 'ABCDEFGHIJ':
        c = Fd[f'{cc}{r}']; c.border = BOX; c.font = fN
        if cc != 'A': c.number_format = '0.000'
    r += 1
for _nm, _cc in (('den_z', 'B'), ('den_Md', 'G'), ('den_Vd', 'H'), ('den_As', 'J')):
    wb.defined_names[_nm] = DefinedName(_nm, attr_text=f"'Fundação'!${_cc}${_d0}:${_cc}${r-1}")
r += 1
# Comprimentos com que cada barra GANHA força no diagrama (o As colocado sobe de zero ao cheio ao longo deles, como no
# Pró-Viga e no TQS): a ponta reta ancora em ℓb,nec = ℓb·As,calc/As,ef ≥ ℓb,mín; a ponta dobrada (gancho, dobra do
# estribo) em α·ℓb·As,calc/As,ef ≥ ℓb,mín, α = 0,7 — NBR 6118 9.4.2.5, a regra que a planilha já usa no dente, na
# perna do U e na cinta do muro de cima. ℓb no material onde a barra está: graute (lbphi_gr) para as do muro, do
# contraforte e do pilarete (a regra do ℓ0t_pil); concreto da sapata (lbphi_c). As,calc = o As do momento (sem o
# mínimo), como o r_anc e o r_cf. Emendas por traspasse: os ℓ0t da seção 10 (l0t_v, l0t_pv, l0t_cf, l0t_cc) e do
# muro de cima (l0t_pil).
Lf('Sapata: As,calc/As,ef da principal', '=IFERROR(MIN(1,MAX(IF(ISNUMBER(As_ts),As_ts,0),IF(ISNUMBER(As_hs),As_hs,0))/Ase_s),1)', '', 'O maior As do momento (ponta ou talão).', 'res', '0.000', 'r_sap')
_LBS = [('Balanço: barra vertical', 'v', 'lbphi_gr', 'phi_v', 'r_anc'),
        ('Contraforte: barra principal', 'cf', 'lbphi_gr', 'phi_cf', 'r_cf'),
        ('Sapata: barra principal', 's', 'lbphi_c', 'phi_sap', 'r_sap'),
        ('Pilarete: barra longitudinal', 'pil', 'lbphi_gr', 'phi_pil', 'IFERROR(MIN(1,IF(LEFT(pil_tipo,4)="Conc",Asc_pil,Asb_pil)/As_pile),1)')]
for _lab, _sx, _lbphi, _ph, _rz in _LBS:
    _lb = f'{_lbphi}*{_ph}/10'
    _mn = f'MAX(0.3*{_lb},{_ph},10)'
    Lf(f'{_lab}: ℓb,nec ponta reta = ℓb·As,calc/As,ef ≥ ℓb,mín', f'=MAX({_lb}*{_rz},{_mn})', 'cm', 'ℓb,mín = máx(0,3·ℓb; 10Ø; 10 cm).', 'res', '0.0', f'lbn_{_sx}', 'NBR 6118 9.4.2.5')
    Lf(f'{_lab}: ℓb,nec ponta dobrada = 0,7·ℓb·As,calc/As,ef ≥ ℓb,mín', f'=MAX(0.7*{_lb}*{_rz},{_mn})', 'cm', 'α = 0,7 (gancho ou dobra).', 'res', '0.0', f'lbg_{_sx}', 'NBR 6118 9.4.2.5')
widths(Fd, {'A': 46, 'B': 24, 'C': 12, 'D': 66, 'E': 18, 'F': 14, 'G': 16, 'H': 14, 'I': 14, 'J': 14, 'K': 14, 'L': 14})
Fd.freeze_panes = 'A4'
