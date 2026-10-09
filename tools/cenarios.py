"""Cenários de entrada (por nome definido). BASE = exemplo da aula 12.2 (já é o padrão do gerador).
VAL123 = muro com CONTRAFORTES em bloco de CONCRETO 14×39 com a geometria da aula 12.3 (h 2,6, Ka 0,4, γ 20) + sapata
de exemplo (não é do curso). Até 08/10 era a própria aula 12.3, em bloco cerâmico no "modo validação"; o cerâmico saiu
da planilha (decisão do Jose, 09/10) e a aula 12.3 ficou como registro (CLAUDE.md, seção Validação). Este cenário é
REGRESSÃO: o testar.py confere que os números não mudam sem querer, não que batem com o professor.

OPCOES/sortear = o domínio dos cenários sorteados (varredura.py procura erro; golden.py vira gabarito do app). Só
valores que a planilha ACEITA: as listas da validação de dados — inclusive as que dependem de outra entrada (altura
pelo tipo de muro; vão, contraforte e espaçamentos pelo bloco), que o sortear() resolve depois de sortear o bloco."""
import openpyxl

VAL123 = {
    'H_muro': 2.6, 'H_solo': 2.6, 't_bloco': 14, 'Graute': 'Parcial (seção I)', 'Tipo_muro': 'Contrafortes',
    'Ka_dir': 0.4, 'gama_solo': 20, 'q_sobre': 0, 'c_solo': 0, 'Agua': 'Não', 'fbk_': 10, 'fpk_ref': 'Líquida (curso)',
    'K_dir': 1, 'AsMin_crit': 'Curso', 'M2d_on': 'Não', 'arg_cls': 'acima de 7,0 MPa', 'fgk_dir': 20, 'h_pan': 0.8,
    'psi_els': 1, 'vao_ref': '2h',
    # aula: 1,50 m e contraforte de 59 (14×29). Na família 14×39: o vão da lista mais perto de 1,50 e o contraforte de 54.
    'l_cf': 1.35, 'tenr_': 54,
    'B_sap': 2.2, 'a_ater': 1.5, 'b_den': 0.3, 'h_den': 0.7,
}

PHI_FURO = [6.3, 8, 10, 12.5, 16, 20]
# Domínio de cada entrada. As que dependem de outra (altura, vão, contraforte, espaçamentos) são resolvidas no
# sortear(): aqui fica só o que não depende de nada.
OPCOES = {
    't_bloco': [14, 19], 'Trav_lat': ['Sim', 'Não'],
    'Ka_dir': ['', 0.33, 0.5], 'phi_solo': [20, 30, 35], 'c_solo': [0, 10, 25], 'q_sobre': [0, 5, 20], 'Agua': ['Sim', 'Não'], 'z_NA': [0, 0.5, 1.5],
    'fbk_': [4, 6, 8, 10, 12, 16, 24], 'Graute': ['Parcial (seção I)', 'Total (seção cheia)'], 'fpk_ref': ['Líquida (curso)', 'Bruta (NBR)'],
    'phi_v': PHI_FURO, 'd_dir': ['', 9.5, 14], 'K_dir': ['', 1, 1.5],
    'AsMin_crit': ['Curso', 'NBR'], 'M2d_on': ['Sim', 'Não'], 'fck_fund': ['C20', 'C25', 'C30'], 'zona_ad': ['Boa', 'Má'], 'gancho_': ['Sim', 'Não'],
    'h_pan': [0.4, 0.8, 1.2, 1.6], 'arg_cls': ['1,5 a 3,4 MPa', '3,5 a 7,0 MPa', 'acima de 7,0 MPa'], 'caso_pan': [13, 18, 11], 'beta_dir': ['', 0.1],
    'sig_pan': [0, 0.1], 'Tipo_muro': ['Balanço', 'Contrafortes'],
    'pos_cf': ['Enterrado (lado do solo)', 'Aparente (lado de fora)'], 'tipo_cf': ['Intermediário', 'Extremidade'], 'bal_cf': [0, 0.5, 1.5],
    'phi_cf': PHI_FURO, 'n_cf_dir': ['', 2, 4], 'c_cf_dir': ['', 10], 'K_cf': ['', 1, 1.5], 'phi_est': [5, 6.3], 'ramos_est': [2, 4], 's_est': [20, 40],
    'lat_pan': ['Apoiadas', 'Engastadas'], 'phi_pv': [6.3, 8, 10, 12.5, 16], 'pos_pv': ['2 barras (uma em cada face)', '1 barra centralizada'],
    'c_pv': [4, 5], 'phi_ph': [6.3, 10, 12.5, 16], 's_ph_dir': ['', 20, 40, 80, 120], 'pos_ph': ['Centralizada (d = t/2)', 'Encostada na face externa'], 'K_pv': [1, 1.5], 'K_ph': [0.5, 1],
    'bwv_dir': ['', 13.6], 'B_sap': [0.4, 1.0, 1.4, 2.5], 'h_sap': [0.2, 0.3, 0.5], 'a_ater': [0.05, 0.1, 0.5, 0.95, 1.5, 2.4], 'b_den': [0, 0.25], 'h_den': [0, 0.5],
    'P_topo': [0, 10], 'q_est': ['Sim', 'Não'], 'phi_base': ['', 30], 'dphi': [0.67, 1], 'ades_b': [0, 20], 'pass_on': ['Sim', 'Não'], 'SPT_b': [5, 20], 'sig_adm_dir': ['', 150],
    'cob_sap': [3, 5], 'phi_sap': [8, 10, 12.5, 16], 'phi_tor': [5, 6.3], 'bwh_els': [19, 20], 'fgk_dir': ['', 15, 30], 'psi_els': [1, 0.7], 'vao_ref': ['h', '2h'], 'sg_on': ['Sim', 'Não'], 'dxi': [1, 0.5], 'bw_dir': ['', 15],
}


def listas_do_bloco(t, tipo_muro):
    """As listas dependentes, como as fórmulas da aba Referências (colunas AJ–AM) as calculam."""
    m = 20
    alturas = [n * 20 / 100 for n in range(3, 21) if n * 20 <= (400 if tipo_muro == 'Contrafortes' else 300)]
    if t == 19:
        vaos = [(t + 1 + n * m) / 100 for n in range(3, 20)]
        tenr = [59, 79]
    else:
        vaos = [(t + 1 + 2 * k * m) / 100 for k in range(2, 10)]
        tenr = [34, 54]
    barras = [n * m for n in range(1, 7) if n * m <= 6 * t]
    return {'H_muro': alturas, 'l_cf': vaos, 'tenr_': tenr, 's_dir': [''] + barras, 's_pv_dir': [''] + barras}


def solo_sorteado(rnd, h_muro):
    """Altura de solo ≤ altura do muro (validação da planilha: 0 < h solo ≤ h muro). Um terço dos sorteios fica com o
    solo no topo do muro (o caso das aulas, em que as duas alturas são uma só); os outros, com o solo abaixo — de 40% a
    quase 100% do muro, em centímetros (é como se digita), para pegar o painel de baixo mais alto que o solo e a
    rotação do trecho de muro acima do solo na flecha."""
    if rnd.random() < 1 / 3:
        return h_muro
    return max(0.2, min(h_muro, round(h_muro * rnd.uniform(0.4, 0.99), 2)))


def sortear(rnd):
    """Um cenário com valores aceitos pela planilha. '' = em branco (None)."""
    sc = {k: rnd.choice(v) for k, v in OPCOES.items()}
    sc.update({k: rnd.choice(v) for k, v in listas_do_bloco(sc['t_bloco'], sc['Tipo_muro']).items()})
    sc['H_solo'] = solo_sorteado(rnd, sc['H_muro'])
    return {k: (None if v == '' else v) for k, v in sc.items()}


def aplicar(src, dst, valores):
    wb = openpyxl.load_workbook(src)
    for k, v in valores.items():
        sh, ref = list(wb.defined_names[k].destinations)[0]
        wb[sh][ref.replace('$', '')] = v
    wb.save(dst)

def ler(path, nomes):
    wb = openpyxl.load_workbook(path, data_only=True)
    out = {}
    for n in nomes:
        sh, ref = list(wb.defined_names[n].destinations)[0]
        out[n] = wb[sh][ref.replace('$', '')].value
    return out
