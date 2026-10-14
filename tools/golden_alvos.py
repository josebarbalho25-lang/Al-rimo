"""Cenários DIRECIONADOS para o gabarito do motor: dados/golden/alvo_<nome>.json, no MESMO formato do golden.py.

Por que existem: os 40 sorteios do golden.py nunca caem nas bordas em que uma regra do Excel decide o resultado
(o cobertura.test.ts do app mostra isso: trocar a comparação de 15 dígitos ou o ARRED.PARA.CIMA de 15 dígitos
pela versão ingênua não muda nenhuma célula dos sorteios). Estes cenários foram ACHADOS por busca no app
(4000 sorteios em domínio mais largo, rodando o motor com e sem cada regra) e caem exatamente nessas bordas.
Rodá-los no Excel prova, dentro da própria planilha, que o motor escolhe o mesmo ramo que o Excel.

Três famílias: as bordas de 15 dígitos (ALVOS), os ramos que os sorteios nunca tomam (ALVOS_COBERTURA, da lente
de cobertura) e os campos apagados (ALVOS_VAZIO).

Reaproveita o cenarios.aplicar e o recalc_lo.recalc (que cai no Excel por COM quando não há LibreOffice).
O Excel abre um por vez. Uso: python tools/golden_alvos.py [nome_do_alvo ...]
"""
import json, os, subprocess, sys, tempfile
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
from cenarios import aplicar
from recalc_lo import recalc
import openpyxl

SAIDA = os.path.join(RAIZ, 'dados', 'golden')

ALVOS = {
    # arg_x chega a 1 com erro de double: o Excel (15 dígitos) vê arg_x<1 FALSO e dá 'não resiste'
    # (Muro em balanço!B36 e ~50 células abaixo); comparando o double cru, daria x numérico. Até 08/10 o cenário era
    # um bloco 14x29 (saiu com o cerâmico); este foi achado em 09/10 por busca no motor só com valores das listas:
    # Ka 0,75 fecha arg_x = 1 na conta exata, e a soma das 40 fatias dá 0,9999999999999998.
    'alvo_compara15_flexao': {
        't_bloco': 19, 'H_muro': 1, 'gama_solo': 18, 'q_sobre': 0, 'c_solo': 0, 'Agua': 'Não', 'Ka_dir': 0.75,
        'K_dir': 1, 'd_dir': 7.5, 'fbk_': 4, 'fpk_ref': 'Bruta', 'Graute': 40, 'M2d_on': 'Não',
    },
    # Fundação!G136 (G129 até a seção 10 da aba entrar, 09/10): E136 > d_s/100 com os dois iguais a menos do último
    # bit — Excel diz FALSO (0); o double cru daria −0,105.
    'alvo_compara15_sapata_a': {
        'H_muro': 2, 't_bloco': 14, 'Trav_lat': 'Sim', 'Ka_dir': 0.33, 'phi_solo': 30, 'c_solo': 10,
        'q_sobre': 0, 'Agua': 'Não', 'z_NA': 0.7, 'fbk_': 12, 'Graute': 20,
        'fpk_ref': 'Líquida', 'phi_v': 16, 's_dir': 80, 'd_dir': 14, 'K_dir': 1, 'AsMin_crit': 'Parede (b·t)',
        'M2d_on': 'Sim', 'fck_fund': 'C30', 'zona_ad': 'Má', 'gancho_': 'Sim', 'h_pan': 0.8,
        'arg_cls': '3,5 a 7,0 MPa', 'caso_pan': 11, 'beta_dir': 0.1, 'sig_pan': 0.1,
        'Tipo_muro': 'Contrafortes', 'l_cf': 1.35, 'tenr_': 54, 'pos_cf': 'Enterrado (lado do solo)',
        'tipo_cf': 'Intermediário', 'bal_cf': 0.3, 'phi_cf': 10, 'n_cf_dir': 4, 'c_cf_dir': None, 'K_cf': 1.5,
        'phi_est': 6.3, 'ramos_est': 4, 's_est': 40, 'lat_pan': 'Apoiadas', 'phi_pv': 12.5, 's_pv_dir': 20,
        'pos_pv': '2 barras (uma em cada face)', 'c_pv': 5, 'phi_ph': 6.3, 's_ph_dir': 120,
        'pos_ph': 'Centralizada (d = t/2)', 'K_pv': 1, 'K_ph': 0.5, 'bwv_dir': None, 'B_sap': 0.4, 'h_sap': 0.3,
        'a_ater': 0.05, 'b_den': 0, 'h_den': 0, 'P_topo': 10, 'q_est': 'Sim', 'phi_base': None, 'dphi': 1,
        'ades_b': 0, 'pass_on': 'Sim', 'SPT_b': 5, 'sig_adm_dir': 150, 'cob_sap': 5, 'phi_sap': 10, 'phi_tor': 5,
        'bwh_els': 20, 'fgk_dir': None, 'psi_els': 1, 'vao_ref': 'h', 'sg_on': 'Não',
        'dxi': 0.5, 'bw_dir': 15,
    },
    # Fundação!G131 (era G124) e B78 (cortante do talão): até 08/10 caía na mesma armadilha da seção crítica d_s/100. Com o vão e
    # o contraforte da lista (3,75 e 54, antes 4 e 59) não cai mais na borda — fica como cobertura da sapata com
    # contrafortes em 14x39; a regra dos 15 dígitos na comparação continua provada pelo sapata_a.
    'alvo_compara15_sapata_b': {
        'H_muro': 1, 't_bloco': 14, 'Trav_lat': 'Não', 'Ka_dir': 0.33, 'phi_solo': 30, 'c_solo': 10,
        'q_sobre': 2, 'Agua': 'Sim', 'z_NA': 0.3, 'fbk_': 6, 'Graute': 80, 'fpk_ref': 'Bruta',
        'phi_v': 16, 's_dir': 80, 'd_dir': 9.5, 'K_dir': 1.5, 'AsMin_crit': 'Parede (b·t)', 'M2d_on': 'Sim',
        'fck_fund': 'C30', 'zona_ad': 'Boa', 'gancho_': 'Não', 'h_pan': 1.6, 'arg_cls': '3,5 a 7,0 MPa', 'caso_pan': 11,
        'beta_dir': 0.1, 'sig_pan': 0.1, 'Tipo_muro': 'Contrafortes', 'l_cf': 3.75, 'tenr_': 54,
        'pos_cf': 'Enterrado (lado do solo)', 'tipo_cf': 'Extremidade', 'bal_cf': 0, 'phi_cf': 10,
        'n_cf_dir': 4, 'c_cf_dir': None, 'K_cf': 1, 'phi_est': 6.3, 'ramos_est': 2, 's_est': 20, 'lat_pan': 'Apoiadas',
        'phi_pv': 10, 's_pv_dir': None, 'pos_pv': '2 barras (uma em cada face)', 'c_pv': 5, 'phi_ph': 16,
        's_ph_dir': 120, 'pos_ph': 'Encostada na face externa', 'K_pv': 1.5, 'K_ph': 1, 'bwv_dir': None, 'B_sap': 1,
        'h_sap': 0.2, 'a_ater': 0.7, 'b_den': 0, 'h_den': 0, 'P_topo': 10, 'q_est': 'Não', 'phi_base': None,
        'dphi': 0.67, 'ades_b': 20, 'pass_on': 'Sim', 'SPT_b': 5, 'sig_adm_dir': 150, 'cob_sap': 5, 'phi_sap': 12.5,
        'phi_tor': 5, 'bwh_els': 20, 'fgk_dir': None, 'psi_els': 1, 'vao_ref': 'h',
        'sg_on': 'Não', 'dxi': 0.5, 'bw_dir': None,
    },
    # ARRED.PARA.CIMA(2,2*100/20;0) — o double é 11,000000000000002; o Excel (15 dígitos) dá 11, Math.ceil daria
    # 12. Cai no nº de estribos do contraforte e no nº de fiadas (Entradas). Até 08/10 era H 1,1 com estribo c/10;
    # a altura passou a ser lista de fiadas inteiras e 2,2 m com c/20 cai na mesma borda.
    'alvo_arredcima15_estribos': {
        'H_muro': 2.2, 't_bloco': 14, 'Trav_lat': 'Sim', 'Ka_dir': 0.3, 'phi_solo': 35, 'c_solo': 0,
        'q_sobre': 0, 'Agua': 'Não', 'z_NA': 0.3, 'fbk_': 24, 'Graute': 20,
        'fpk_ref': 'Líquida', 'phi_v': 16, 's_dir': 80, 'd_dir': None, 'K_dir': 1.5, 'AsMin_crit': 'Parede (b·t)',
        'M2d_on': 'Sim', 'fck_fund': 'C30', 'zona_ad': 'Boa', 'gancho_': 'Sim', 'h_pan': 1.2,
        'arg_cls': 'acima de 7,0 MPa', 'caso_pan': 18, 'beta_dir': None, 'sig_pan': 0,
        'Tipo_muro': 'Contrafortes', 'l_cf': 0.95, 'tenr_': 54, 'pos_cf': 'Enterrado (lado do solo)',
        'tipo_cf': 'Extremidade', 'bal_cf': 0.5, 'phi_cf': 6.3, 'n_cf_dir': 4, 'c_cf_dir': 10, 'K_cf': 1,
        'phi_est': 6.3, 'ramos_est': 2, 's_est': 20, 'lat_pan': 'Engastadas', 'phi_pv': 10, 's_pv_dir': 20,
        'pos_pv': '2 barras (uma em cada face)', 'c_pv': 4, 'phi_ph': 12.5, 's_ph_dir': 40,
        'pos_ph': 'Encostada na face externa', 'K_pv': 1.5, 'K_ph': 1, 'bwv_dir': None, 'B_sap': 2.5, 'h_sap': 0.5,
        'a_ater': 0.05, 'b_den': 0, 'h_den': 0, 'P_topo': 0, 'q_est': 'Não', 'phi_base': 30, 'dphi': 0.67,
        'ades_b': 20, 'pass_on': 'Sim', 'SPT_b': 5, 'sig_adm_dir': None, 'cob_sap': 3, 'phi_sap': 12.5, 'phi_tor': 5,
        'bwh_els': 20, 'fgk_dir': None, 'psi_els': 0.7, 'vao_ref': 'h', 'sg_on': 'Não',
        'dxi': 0.5, 'bw_dir': None,
    },
}


# Cenários da LENTE DE COBERTURA (instrumentação ramo a ramo do motor sobre o gabarito): cada um destrava ramos de SE,
# limites de MÍNIMO/MÁXIMO e SEERRO que os 40 sorteios nunca tomam, ou mexe em entradas que o golden.py nunca sorteia
# (o golden.py só sorteia as chaves do opts da varredura.py). Os comentários dizem o que cada um exercita — previsão
# do motor ANTES de rodar no Excel; o golden.test.ts é que prova. Os de sapata subdimensionada dão "NÃO OK" de
# propósito: o que se confere aqui é a conta, não o projeto. Desde 09/10 todos usam só valores das listas das Entradas.
ALVOS_COBERTURA = {
    # PRIORIDADE ALTA — seção T do contraforte com LN na alma, com x NUMÉRICO (Contrafortes!B56, nunca conferido);
    # T do painel vertical com 2 barras (B221 ramo fundo); s_adot=0 no balanço; x/d>0,45; torção NÃO OK; sugestões de areia
    # (09/10: refeito com valores das listas por busca no motor — o de antes, H 4 / tenr 89, nem chegava à alma)
    'alvo_cob_T_na_alma': {
        'H_muro': 3.2, 'Tipo_muro': 'Contrafortes', 'q_sobre': 20, 'fbk_': 16, 'fpk_ref': 'Líquida', 's_dir': None,
        'Ka_dir': 0.5, 'K_cf': 1, 'l_cf': 3.2, 'tenr_': 79, 'phi_pv': 12.5, 's_pv_dir': 80, 'c_pv': 3,
        'Tipo_solo': 'Areia', 'NSPT': 12, 'Umidade': 'Saturada', 'Classe_G': 'Areia densa',
    },
    # nenhum espaçamento do painel atende (s_pv=0 → x_ev "—", B278 NÃO OK, "c/0"); Arranjos "> Ø20";
    # Ø construtiva 12,5 e c_pv 4,5 (DEF.NÚM.DEC com 1 casa); torção NÃO OK. Sapata subdimensionada DE PROPÓSITO.
    'alvo_cob_painel_sem_arranjo': {
        'H_muro': 3.2, 'Tipo_muro': 'Contrafortes', 'Ka_dir': 0.28, 'q_sobre': 5, 'fbk_': 22, 'fpk_ref': 'Bruta',
        's_dir': None, 'K_dir': 1.5, 'l_cf': 4, 'phi_cc': 12.5, 'n_cc': 3, 'c_pv': 4.5, 'B_sap': 0.6, 'a_ater': 0.15,
    },
    # flexão da sapata não resiste (B70/B104), cortante além de d (G113), esbeltez αv·h (B7), NA no topo (flutua: FS<0)
    'alvo_cob_contraforte_nao_ductil': {
        'H_muro': 3.6, 'Trav_lat': 'Sim', 'alfa_h': 2.5, 'l_trav': 8, 'gama_solo': 21, 'q_sobre': 10, 'Agua': 'Sim',
        'z_NA': 0, 'fbk_': 24, 'Tipo_muro': 'Contrafortes', 'l_cf': 2.6, 'tenr_': 59, 'K_cf': 1.5, 'B_sap': 3,
        'h_sap': 0.25, 'cob_sap': 5, 'a_ater': 0.3,
    },
    # σmáx > σadm (B102), talão não resiste (B70), G152, B165 #NÚM! (09/10: balanço até 3,0 m na lista — de H 4 para 3
    # com sobrecarga 40 e NA no topo, achado por busca no motor)
    'alvo_cob_sapata_tensao_talao': {
        'H_muro': 3, 'q_sobre': 40, 'Agua': 'Sim', 'z_NA': 0, 'fbk_': 4, 'l_cf': 4, 's_pv_dir': 80, 'pos_pv': '1 barra centralizada',
        'B_sap': 3, 'h_sap': 0.2, 'P_topo': 10, 'SPT_b': 5, 'a_ater': 2.25, 'fck_fund': 'C30',
    },
    # Ø20 em todas as tabelas (Arranjos F6:F9 "> Ø20"), Tipo_solo Outro e as sugestões do solo nos extremos. Até 08/10
    # era o alvo_cob_val_lisas_phi20, no modo validação (cerâmico liso, 0,5·fyd), que saiu com o cerâmico.
    'alvo_cob_phi20_solo_outro': {
        't_bloco': 14, 'Graute': 20, 'Ka_dir': 0.5,
        'q_sobre': 20, 'Tipo_muro': 'Contrafortes', 'l_cf': 3.75, 'tenr_': 54, 'phi_cf': 20, 'lat_pan': 'Engastadas', 'phi_pv': 20,
        'phi_ph': 20, 'K_ph': 1, 'phi_v': 20, 's_dir': None, 'AsMin_crit': 'Parede (b·t)', 'caso_pan': 11,
        'Tipo_solo': 'Outro', 'NSPT': 45, 'Umidade': 'Seca', 'Classe_G': 'Pedregulho arenoso',
    },
    # balanço com 0,8x > hf (Muro em balanço!B81, só o sorteio00 passava por aqui)
    'alvo_cob_balanco_T': {'H_muro': 1.2, 'q_sobre': 20, 'phi_v': 12.5, 'd_dir': 7, 'K_dir': None},
    # painel não armado: l e h > 50t e h·l > coef·t² (B46/B47) — só com coesão (s_adot enorme)
    'alvo_cob_painel_area_limite': {
        'H_muro': 1, 't_bloco': 14, 'l_cf': 1.35, 'tenr_': 54, 'gama_solo': 16, 'Ka_dir': None, 'phi_solo': 30, 'c_solo': 5, 'Agua': 'Sim',
        'z_NA': 2, 's_dir': None, 'AsMin_crit': 'Parede (b·t)',
    },
    # 22 entradas que o gabarito nunca mexe + k = 1,6 − d ≥ 1 (h_sap 0,7)
    'alvo_cob_parametros_nunca_mexidos': {
        'H_muro': 2.8, 'Tipo_muro': 'Contrafortes', 'l_cf': 2.6, 'tenr_': 79, 'B_sap': 1.8, 'a_ater': 1.2, 'h_sap': 0.7,
        'Trav_lat': 'Sim', 'alfa_v': 2.0, 'alfa_h': 1.0, 'l_trav': 4, 'peso_par': 3.5, 'gama_w': 9.81, 'gama_c': 24,
        'gama_cf': 20, 'gama_f': 1.5, 'fyk_': 600, 'FS_tomb': 1.5, 'FS_desl': 2.0, 'div_adm': 300, 'phi_sap2': 8,
        'phi_cc': 8, 'n_cc': 3, 'Agua': 'Sim', 'z_NA': 1.5, 'NSPT': 2, 'Umidade': 'Seca', 'Classe_G': 'Colúvio in situ',
    },
    # ρ ≤ 2% e fvk ≤ 0,7 ativos (Muro em balanço!B61)
    'alvo_cob_rho_maximo': {
        'H_muro': 1, 'Tipo_muro': 'Contrafortes', 'gama_solo': 18, 'q_sobre': 0, 'phi_v': 20, 's_dir': 20, 'Graute': 20, 'd_dir': 7,
        'B_sap': 2.2,
    },
}
ALVOS.update(ALVOS_COBERTURA)

# Duas alturas (09/10): os alvos acima (e os de campo apagado, abaixo) foram achados com UMA altura — solo no topo do
# muro; o laço depois do ALVOS_VAZIO faz o solo acompanhar o muro neles. Estes exercitam o solo abaixo do topo.
ALVOS_SOLO = {
    # balanço com o solo bem abaixo do topo: painel de baixo (1,20) mais alto que o solo (1,05) → z_pan = 0 (trapézio do
    # solo no painel inteiro); flecha no topo com a parcela da rotação (1,35 m de muro acima do solo); NA no meio do solo
    'alvo_solo_abaixo_balanco': {
        'H_muro': 2.4, 'H_solo': 1.05, 'h_pan': 1.2, 'Agua': 'Sim', 'z_NA': 0.5, 'q_sobre': 5, 'Ka_dir': None,
        'phi_solo': 30, 's_dir': None,
    },
    # contrafortes 19×39 enterrados, solo a 1,30 m num muro de 3,60: subpainel (canaletas c/160) mais alto que o solo,
    # Libânio com o triângulo esticado até o topo do muro, solo e água do talão na altura de solo, NA acima da base
    'alvo_solo_abaixo_cf': {
        'Tipo_muro': 'Contrafortes', 'H_muro': 3.6, 'H_solo': 1.3, 'l_cf': 2.0, 'tenr_': 79, 's_ph_dir': 160,
        'pos_cf': 'Enterrado (lado do solo)', 'B_sap': 2.5, 'a_ater': 1.5, 'Agua': 'Sim', 'z_NA': 1.0, 'q_sobre': 10,
    },
    # contraforte aparente, laterais engastadas, solo a 3,15 num muro de 4,00 com coesão (perfil cortado no topo)
    'alvo_solo_abaixo_cf_aparente': {
        'Tipo_muro': 'Contrafortes', 'H_muro': 4.0, 'H_solo': 3.15, 'l_cf': 2.6, 'tenr_': 59,
        'pos_cf': 'Aparente (lado de fora)', 'lat_pan': 'Engastadas', 'c_solo': 10, 'Ka_dir': None, 'phi_solo': 30,
        'B_sap': 2.5, 'a_ater': 0.3,
    },
    # solo raso (0,20 m) num muro de 3,00: a altura de solo mínima da conta, quase toda a flecha vem da rotação
    'alvo_solo_raso': {'H_muro': 3.0, 'H_solo': 0.2, 'q_sobre': 20, 's_dir': None},
}
ALVOS.update(ALVOS_SOLO)

# σadm automático fora da faixa da regra 20·SPT (Jose, 14/10): o sorteio só tira SPT 5 e 20
ALVOS.update({
    'alvo_sadm_spt_mole': {'SPT_b': 3, 'sig_adm_dir': None},     # sem automático: a tensão reprova pedindo o σadm
    'alvo_sadm_spt_teto': {'SPT_b': 30, 'sig_adm_dir': None},    # conta 20 golpes: 400 kPa, não 600
})


# Cenários de ENTRADA EM BRANCO. O app deixa o usuário apagar qualquer campo numérico (o motor grava null, como o
# Excel grava célula vazia), e a sonda do Excel mostrou que o vazio não se comporta igual em toda função: o
# CORRESP com procurado vazio vale 0 (o motor antigo dava #N/D), SOMARPRODUTO de uma célula vazia dá #VALOR!...
# Estes cenários provam, dentro da própria planilha, que o motor faz com o campo apagado o mesmo que o Excel.
# Os "tudo em branco" são degenerados de propósito (muita célula vira erro): o que se confere é que o erro é o
# mesmo, no mesmo lugar. A lista dos campos livres sai da planilha na hora (entrada sem lista de validação), para
# não envelhecer quando o gerador ganhar campo novo.
def _tudo_em_branco(tipo_muro):
    return lambda livres: {**{n: None for n in livres}, 'Tipo_muro': tipo_muro}


ALVOS_VAZIO = {
    # NSPT apagado: Solo e Empuxo!B5:B7 (CORRESP(NSPT;…;1) com a tabela começando em NSPT ≥ 0) — o Excel mostra a 1ª
    # linha; a lente de cobertura previa #N/D, pelo motor antigo.
    'alvo_vazio_nspt': {'NSPT': None, 'Tipo_solo': 'Areia', 'Umidade': 'Seca', 'Classe_G': 'Areia fofa'},
    # contrafortes com TODOS os opcionais e "automáticos" em branco (a planilha escolhe sozinha cada um)
    'alvo_vazio_opcionais_cf': {
        'Tipo_muro': 'Contrafortes', 'H_muro': 2.8, 'l_cf': 3, 's_dir': None, 'K_dir': None, 'Ka_dir': None, 'd_dir': None,
        'K_cf': None, 'c_cf_dir': None, 'n_cf_dir': None, 'phi_base': None, 'sig_adm_dir': None,
        'beta_dir': None, 'fgk_dir': None, 'bw_dir': None, 'bwv_dir': None, 's_pv_dir': None, 's_ph_dir': None,
    },
    'alvo_vazio_tudo_balanco': _tudo_em_branco('Balanço'),
    'alvo_vazio_tudo_cf': _tudo_em_branco('Contrafortes'),
}
ALVOS.update(ALVOS_VAZIO)

# solo no topo do muro em todo alvo que mexe na altura do muro e não diz a do solo (ver ALVOS_SOLO)
for _sc in ALVOS.values():
    if isinstance(_sc, dict) and 'H_muro' in _sc:
        _sc.setdefault('H_solo', _sc['H_muro'])


def campos_livres(wb, entradas, nomes):
    """Entradas sem lista de validação (campo numérico livre), na ordem alfabética."""
    livres = []
    for nm in sorted(entradas):
        sh, ref = nomes[nm]
        cel = ref.replace('$', '')
        if not any(dv.type == 'list' and cel in dv.sqref for dv in wb[sh].data_validations.dataValidation):
            livres.append(nm)
    return livres


def ler_ref(ws, ref):
    # igual ao golden.py: nome que aponta para INTERVALO vira lista de valores
    alvo = ws[ref.replace('$', '')]
    if isinstance(alvo, tuple):
        return [[c.value for c in linha] if isinstance(linha, tuple) else linha.value for linha in alvo]
    return alvo.value


def main():
    os.makedirs(SAIDA, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='golden_alvos_')
    base = os.path.join(tmp, 'base.xlsx')
    subprocess.run([sys.executable, os.path.join(AQUI, 'build_new.py'), base], check=True, capture_output=True)
    wbf = openpyxl.load_workbook(base)
    formulas = [(ws.title, c.coordinate) for ws in wbf for row in ws.iter_rows() for c in row
                if isinstance(c.value, str) and c.value.startswith('=')]
    nomes = {nm: list(dn.destinations)[0] for nm, dn in wbf.defined_names.items()}
    entradas = {nm for nm, (sh, ref) in nomes.items()
                if sh == 'Entradas' and ':' not in ref and (wbf[sh][ref.replace('$', '')].fill.fgColor.rgb or '').endswith('FFF2CC')}
    # Sem argumento roda todos; com nomes (python tools/golden_alvos.py alvo_cob_T_na_alma ...) só esses — o Excel
    # leva ~5 s por cenário e os que já estão em dados/golden não mudam enquanto o gerador não mudar.
    pedidos = sys.argv[1:] or list(ALVOS)
    faltam = [n for n in pedidos if n not in ALVOS]
    if faltam:
        raise SystemExit(f'cenário desconhecido: {faltam}')
    livres = campos_livres(wbf, entradas, nomes)
    for nome in pedidos:
        sc = ALVOS[nome]
        if callable(sc):
            sc = sc(livres)
        arq = os.path.join(tmp, f'{nome}.xlsx')
        aplicar(base, arq, sc)
        calc = recalc(arq, os.path.join(tmp, 'rc_' + nome))
        wb = openpyxl.load_workbook(calc, data_only=True)
        val_nomes = {nm: ler_ref(wb[sh], ref) for nm, (sh, ref) in nomes.items()}
        val_cel = {f'{sh}!{ref}': wb[sh][ref].value for sh, ref in formulas}
        ent = {nm: val_nomes[nm] for nm in sorted(entradas)}
        json.dump({'cenario': nome, 'alterado': sc, 'entradas': ent, 'nomes': val_nomes, 'celulas': val_cel},
                  open(os.path.join(SAIDA, f'{nome}.json'), 'w', encoding='utf8'), ensure_ascii=False, default=str)
        print('ok', nome, flush=True)
    print('alvos em', SAIDA)


if __name__ == '__main__':
    main()
