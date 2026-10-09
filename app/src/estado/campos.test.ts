import { describe, expect, it } from 'vitest';
import dados from '@/motor/planilha.gerada.json';
import type { EntradaMeta, Valor } from '@/motor/tipos';
import { ENTRADAS_DO_MODELO } from '@/modelo/entradasDoModelo';
import {
  aplicarValor,
  campoDe,
  entradaAtiva,
  entradaDoAjuste,
  lerDoCampo,
  leitorDeValores,
  mesmoValor,
  montarSecoes,
  secaoVisivel,
  validarValor,
  _regras,
  _tetos,
  ajustarAosTetos,
  valorAtual,
  valorTravado,
} from './campos';

// O catálogo vem do JSON exportado da planilha (e não de '@/motor'), para o teste
// do formulário não depender do avaliador de fórmulas.
const PLANILHA = (dados as unknown as { entradas: EntradaMeta[] }).entradas;
const TODAS = [...PLANILHA, ...ENTRADAS_DO_MODELO];
const META = new Map(TODAS.map((m) => [m.nome, m] as const));
const meta = (nome: string) => {
  const m = META.get(nome);
  if (!m) throw new Error(`entrada inexistente: ${nome}`);
  return m;
};

describe('junção das seções (planilha + modelo)', () => {
  const secoes = montarSecoes(PLANILHA, ENTRADAS_DO_MODELO);
  const nomes = secoes.flatMap((s) => s.campos.map((c) => c.meta.nome));

  it('toda entrada aparece uma vez, e só uma', () => {
    expect(nomes.length).toBe(TODAS.length);
    expect(new Set(nomes).size).toBe(TODAS.length);
    expect(new Set(nomes)).toEqual(new Set(TODAS.map((m) => m.nome)));
  });

  it('as seções saem na ordem do painel (a validação com cerâmico saiu em 09/10)', () => {
    expect(secoes.map((s) => s.id)).toEqual([
      'geometria',
      'solo',
      'alvenaria',
      'ancoragem',
      'painelNaoArmado',
      'els',
      'contrafortes',
      'painelContrafortes',
      'fundacao',
      'modelo',
      'drenagem',
      'coeficientes',
    ]);
  });

  it('a origem diz para onde o valor vai (conta ou modelo)', () => {
    const modelo = secoes.find((s) => s.id === 'modelo')!;
    expect(modelo.campos.every((c) => c.origem === 'modelo')).toBe(true);
    const geo = secoes.find((s) => s.id === 'geometria')!;
    expect(geo.campos.every((c) => c.origem === 'planilha')).toBe(true);
    expect(geo.campos[0].meta.nome).toBe('H_muro');
  });

  it('títulos de seção sem citação de fonte (fonte é da memória)', () => {
    for (const s of secoes) expect(s.titulo, s.id).not.toMatch(/aula|Gilberto|\(/i);
  });

  it('seção nova da planilha não some: entra no fim, depois das conhecidas', () => {
    const nova: EntradaMeta = { ...meta('H_muro'), nome: 'x_novo', secao: 'Sismo (NBR 15421)' };
    const s = montarSecoes([...PLANILHA, nova], ENTRADAS_DO_MODELO);
    const ids = s.map((x) => x.id);
    expect(ids).toContain('secao:Sismo');
    expect(ids.indexOf('secao:Sismo')).toBe(ids.length - 1);
  });
});

describe('visibilidade das seções por Tipo_muro', () => {
  const secoes = montarSecoes(PLANILHA, ENTRADAS_DO_MODELO);
  const visiveis = (tipo: Valor) => {
    const ler = leitorDeValores(META, { Tipo_muro: tipo }, {});
    return secoes.filter((s) => secaoVisivel(s, ler)).map((s) => s.id);
  };

  it('balanço esconde contrafortes e painel entre contrafortes', () => {
    const v = visiveis('Balanço');
    expect(v).not.toContain('contrafortes');
    expect(v).not.toContain('painelContrafortes');
    expect(v).toContain('fundacao');
    expect(v).toContain('painelNaoArmado');
  });

  it('contrafortes mostra as duas', () => {
    const v = visiveis('Contrafortes');
    expect(v).toContain('contrafortes');
    expect(v).toContain('painelContrafortes');
    expect(v.length).toBe(secoes.length);
  });

  it('o padrão da planilha (aula 12.2) é balanço', () => {
    const ler = leitorDeValores(META, {}, {});
    expect(ler('Tipo_muro')).toBe('Balanço');
    expect(secoes.filter((s) => secaoVisivel(s, ler)).length).toBe(secoes.length - 2);
  });
});

describe('entradas que a conta ignora ficam apagadas', () => {
  it('αv, αh e l só com travamento lateral', () => {
    const sem = leitorDeValores(META, { Trav_lat: 'Não' }, {});
    const com = leitorDeValores(META, { Trav_lat: 'Sim' }, {});
    for (const n of ['alfa_v', 'alfa_h', 'l_trav']) {
      expect(entradaAtiva(n, sem), n).toBe(false);
      expect(entradaAtiva(n, com), n).toBe(true);
    }
  });
  it('NA e γw só com água; balanço do contraforte só na extremidade', () => {
    expect(entradaAtiva('z_NA', leitorDeValores(META, {}, {}))).toBe(false);
    expect(entradaAtiva('gama_w', leitorDeValores(META, { Agua: 'Sim' }, {}))).toBe(true);
    expect(entradaAtiva('bal_cf', leitorDeValores(META, {}, {}))).toBe(false);
    expect(entradaAtiva('bal_cf', leitorDeValores(META, { tipo_cf: 'Extremidade' }, {}))).toBe(true);
  });
  it('γ do contraforte só com contrafortes; bw da seção I só com graute parcial (achados da revisão)', () => {
    expect(entradaAtiva('gama_cf', leitorDeValores(META, {}, {}))).toBe(false);
    expect(entradaAtiva('gama_cf', leitorDeValores(META, { Tipo_muro: 'Contrafortes' }, {}))).toBe(true);
    expect(entradaAtiva('bw_dir', leitorDeValores(META, {}, {}))).toBe(true);
    expect(entradaAtiva('bw_dir', leitorDeValores(META, { Graute: 'Total (seção cheia)' }, {}))).toBe(false);
  });
  it('entradas do modelo seguem as chaves do modelo', () => {
    expect(entradaAtiva('dreno_esp', leitorDeValores(META, {}, {}))).toBe(true);
    expect(entradaAtiva('dreno_esp', leitorDeValores(META, {}, { dreno_on: 'Não' }))).toBe(false);
    expect(entradaAtiva('H_muro', leitorDeValores(META, {}, {}))).toBe(true);
  });
  it('com contrafortes, o que é só do balanço se apaga (achado da revisão: aceso e não mexia em nada)', () => {
    const bal = leitorDeValores(META, {}, {});
    const cf = leitorDeValores(META, { Tipo_muro: 'Contrafortes' }, {});
    const soDoBalanco = ['Graute', 'bw_dir', 'phi_v', 's_dir', 'd_dir', 'K_dir', 'M2d_on', 'h_pan', 'caso_pan', 'beta_dir', 'sig_pan', 'sg_on'];
    for (const n of soDoBalanco) {
      expect(entradaAtiva(n, bal), n).toBe(true);
      expect(entradaAtiva(n, cf), n).toBe(false);
    }
    // continuam valendo com contrafortes (a conta do contraforte os lê)
    for (const n of ['arg_cls', 'AsMin_crit', 'fbk_', 'fpk_ref', 'zona_ad', 'gancho_', 'psi_els', 'div_adm', 'dxi']) {
      expect(entradaAtiva(n, cf), n).toBe(true);
    }
  });
  it('Ø da cinta: no balanço é o Ø de todas as canaletas (aceso mesmo sem cinta); com contrafortes, só com cinta', () => {
    expect(entradaAtiva('phi_cinta', leitorDeValores(META, {}, { cinta_topo: 'Não' }))).toBe(true);
    expect(entradaAtiva('phi_cinta', leitorDeValores(META, { Tipo_muro: 'Contrafortes' }, { cinta_topo: 'Não' }))).toBe(false);
    expect(entradaAtiva('phi_cinta', leitorDeValores(META, { Tipo_muro: 'Contrafortes' }, { cinta_topo: 'Sim' }))).toBe(true);
  });
});

describe('o controle de cada entrada', () => {
  it('Sim/Não vira a chave de dois estados', () => {
    for (const n of ['Trav_lat', 'Agua', 'M2d_on', 'gancho_', 'sg_on', 'q_est', 'pass_on', 'cinta_topo', 'dreno_on']) {
      expect(campoDe(meta(n), 'planilha').controle, n).toBe('simnao');
    }
  });
  it('poucas opções curtas → botões; longas, muitas ou dependentes → lista; sem lista → número', () => {
    expect(campoDe(meta('t_bloco'), 'planilha').controle).toBe('escolha');
    expect(campoDe(meta('fck_fund'), 'planilha').controle).toBe('escolha');
    expect(campoDe(meta('AsMin_crit'), 'planilha').controle).toBe('escolha');
    expect(campoDe(meta('Tipo_muro'), 'planilha').controle).toBe('lista');
    expect(campoDe(meta('Classe_G'), 'planilha').controle).toBe('lista');
    expect(campoDe(meta('phi_v'), 'planilha').controle).toBe('lista');
    expect(campoDe(meta('H_muro'), 'planilha').controle).toBe('lista');      // lista que depende do tipo de muro
    expect(campoDe(meta('B_sap'), 'planilha').controle).toBe('numero');
  });
  it('lista com número escrito como texto ("14", "19") vira número, como no Excel', () => {
    const c = campoDe(meta('t_bloco'), 'planilha');
    expect(c.opcoes.map((o) => o.valor)).toEqual([14, 19]);
    expect(mesmoValor(19, '19')).toBe(true);
    const phi = campoDe(meta('phi_v'), 'planilha');
    expect(phi.opcoes.map((o) => o.rotulo)).toEqual(['6,3', '8', '10', '12,5', '16', '20']);
    // Texto que só parece número continua texto.
    expect(campoDe(meta('arg_cls'), 'planilha').opcoes[0].valor).toBe('1,5 a 3,4 MPa');
  });
  it('o pairar é só o nome completo: sem a observação da planilha, sem "opcional"', () => {
    const c = campoDe(meta('s_dir'), 'planilha');
    expect(c.curto).toBe('Espaçamento s');
    expect(c.dica).toBe('Espaçamento das barras');
    expect(c.opcional).toBe(true);
    // a observação (aula, aba do Excel, "conferir") não vai para a tela
    for (const m of TODAS) {
      const d = campoDe(m, 'planilha').dica;
      if (m.nota.trim()) expect(d, m.nome).not.toContain(m.nota.trim());
      expect(d, m.nome).not.toMatch(/\n/);
    }
  });
  it('opção sem citação de fonte, mesmo valor por baixo', () => {
    const c = campoDe(meta('fpk_ref'), 'planilha');
    expect(c.opcoes.map((o) => o.rotulo)).toEqual(['Líquida', 'Bruta']);
    expect(c.opcoes.map((o) => o.valor)).toEqual(meta('fpk_ref').opcoes);
    // "Curso | NBR" é o nome do critério, não citação entre parênteses: fica
    expect(campoDe(meta('AsMin_crit'), 'planilha').opcoes.map((o) => o.rotulo)).toEqual(['Curso', 'NBR']);
    expect(campoDe(meta('Graute'), 'planilha').opcoes[0].rotulo).toBe('Parcial (seção I)');
  });
});

describe('o texto do campo → valor', () => {
  const obrig = { opcional: false };
  const opc = { opcional: true };
  it('"1,6" → 1,6', () => {
    expect(lerDoCampo('1,6', obrig)).toEqual({ ok: true, valor: 1.6 });
  });
  it('vazio em opcional → null ("auto"); em obrigatório → recusa', () => {
    expect(lerDoCampo('', opc)).toEqual({ ok: true, valor: null });
    expect(lerDoCampo('  ', opc)).toEqual({ ok: true, valor: null });
    expect(lerDoCampo('', obrig)).toEqual({ ok: false });
  });
  it('lixo e negativo são recusados', () => {
    expect(lerDoCampo('1,6m', obrig)).toEqual({ ok: false });
    expect(lerDoCampo('-1', opc)).toEqual({ ok: false });
    expect(lerDoCampo('0', obrig)).toEqual({ ok: true, valor: 0 });
  });
});

describe('zero e fração onde a conta não aguenta', () => {
  const c = (nome: string) => campoDe(meta(nome), PLANILHA.some((m) => m.nome === nome) ? 'planilha' : 'modelo');
  it('zero que divide a conta (medido) fica vermelho; zero que é "nada" passa', () => {
    // (altura e vão viraram lista em 09/10: zero não está nela)
    for (const n of ['gama_m', 'gama_s', 'gama_f', 'K_dir', 'fyk_', 'B_sap', 'L_total', 'barbaca_s']) {
      expect(lerDoCampo('0', c(n)), n).toEqual({ ok: false });
      expect(lerDoCampo('1,5', c(n)).ok, n).toBe(true);
    }
    // sobrecarga, coesão, junta e balanço podem ser zero
    for (const n of ['q_sobre', 'c_solo', 'junta_cada', 'bal_cf', 'P_topo']) {
      expect(lerDoCampo('0', c(n)), n).toEqual({ ok: true, valor: 0 });
    }
  });
  it('contagem de barras só inteira', () => {
    expect(lerDoCampo('2,5', c('n_cc'))).toEqual({ ok: false });
    expect(lerDoCampo('1,5', c('ramos_est'))).toEqual({ ok: false });
    expect(lerDoCampo('3', c('n_cf_dir'))).toEqual({ ok: true, valor: 3 });
    expect(lerDoCampo('', c('n_cf_dir'))).toEqual({ ok: true, valor: null });
    expect(lerDoCampo('2,5', c('B_sap')).ok).toBe(true);
  });
  it('todo nome com regra existe no catálogo (nome errado não protege nada)', () => {
    const nomes = [..._regras.POSITIVO, ..._regras.INTEIRO, ...Object.keys(_regras.FAIXA)];
    expect(nomes.filter((n) => !META.has(n))).toEqual([]);
    // e nenhum é de lista: a regra é de campo numérico
    expect(nomes.filter((n) => c(n).controle !== 'numero')).toEqual([]);
  });
});

describe('valor que inverteria o veredito (achado da revisão)', () => {
  const c = (nome: string) => campoDe(meta(nome), PLANILHA.some((m) => m.nome === nome) ? 'planilha' : 'modelo');
  it('γf, γm, γs e FS abaixo de 1 ficam vermelhos (vírgula escorregada: 0,14 no lugar de 1,4)', () => {
    for (const n of ['gama_f', 'gama_m', 'gama_s', 'FS_tomb', 'FS_desl']) {
      expect(lerDoCampo('0,14', c(n)), n).toEqual({ ok: false });
      expect(lerDoCampo('0,99', c(n)), n).toEqual({ ok: false });
      expect(lerDoCampo('1', c(n)), n).toEqual({ ok: true, valor: 1 });
      expect(lerDoCampo('1,4', c(n)), n).toEqual({ ok: true, valor: 1.4 });
    }
  });
  it('ângulo de atrito acima de 60° fica vermelho; o da base em branco continua "auto"', () => {
    for (const n of ['phi_solo', 'phi_base']) {
      expect(lerDoCampo('90', c(n)), n).toEqual({ ok: false });
      expect(lerDoCampo('300', c(n)), n).toEqual({ ok: false });
      expect(lerDoCampo('60', c(n)), n).toEqual({ ok: true, valor: 60 });
      expect(lerDoCampo('30', c(n)), n).toEqual({ ok: true, valor: 30 });
    }
    expect(lerDoCampo('0', c('phi_solo'))).toEqual({ ok: true, valor: 0 });
    expect(lerDoCampo('', c('phi_base'))).toEqual({ ok: true, valor: null });
  });
  it('junta: 0 é "sem junta"; com junta, no mínimo 2 m', () => {
    expect(lerDoCampo('0', c('junta_cada'))).toEqual({ ok: true, valor: 0 });
    expect(lerDoCampo('0,05', c('junta_cada'))).toEqual({ ok: false });
    expect(lerDoCampo('0,4', c('junta_cada'))).toEqual({ ok: false });
    expect(lerDoCampo('2', c('junta_cada'))).toEqual({ ok: true, valor: 2 });
    expect(lerDoCampo('8', c('junta_cada'))).toEqual({ ok: true, valor: 8 });
  });
  it('o arquivo passa pela mesma porta', () => {
    expect(validarValor(c('gama_f'), 0.14)).toEqual({ ok: false });
    expect(validarValor(c('phi_solo'), '90')).toEqual({ ok: false });
    expect(validarValor(c('gama_f'), 1.4)).toEqual({ ok: true, valor: 1.4 });
  });
  it('todo padrão está dentro da faixa (a faixa não recusa o muro de fábrica)', () => {
    for (const n of Object.keys(_regras.FAIXA)) {
      const p = meta(n).padrao;
      if (p !== null) expect(lerDoCampo(String(p), c(n)).ok, n).toBe(true);
    }
  });
});

describe('valor vindo de arquivo (validarValor)', () => {
  const c = (nome: string) => campoDe(meta(nome), 'planilha');
  it('texto de número vira número; lixo e negativo são recusados', () => {
    expect(validarValor(c('H_muro'), '2,6')).toEqual({ ok: true, valor: 2.6 });
    expect(validarValor(c('H_muro'), 2.6)).toEqual({ ok: true, valor: 2.6 });
    expect(validarValor(c('H_muro'), -1)).toEqual({ ok: false });
    expect(validarValor(c('H_muro'), 'abc')).toEqual({ ok: false });
    expect(validarValor(c('H_muro'), { a: 1 })).toEqual({ ok: false });
    expect(validarValor(c('H_muro'), Number.NaN)).toEqual({ ok: false });
    expect(validarValor(c('H_muro'), null)).toEqual({ ok: false });
    expect(validarValor(c('s_dir'), null)).toEqual({ ok: true, valor: null });
  });
  it('opção: a da lista, com a caixa da lista; fora da lista é recusada', () => {
    expect(validarValor(c('Tipo_muro'), 'contrafortes')).toEqual({ ok: true, valor: 'Contrafortes' });
    expect(validarValor(c('Agua'), 'SIM')).toEqual({ ok: true, valor: 'Sim' });
    expect(validarValor(c('t_bloco'), '14')).toEqual({ ok: true, valor: 14 });
    expect(validarValor(c('t_bloco'), 17)).toEqual({ ok: false });
    expect(validarValor(c('phi_v'), 12.5)).toEqual({ ok: true, valor: 12.5 });
    expect(validarValor(c('phi_v'), 11)).toEqual({ ok: false });
  });
});

describe('o ajuste da modulação acha a linha da entrada', () => {
  const existe = (n: string) => META.has(n);
  it('pelo nome da entrada, pelo nome da célula adotada e pelo nome sem "_dir"', () => {
    // Os nomes que modulacao/modular.ts publica em Modelo.ajustes (lidos em 08/10/2026).
    const daModulacao: Record<string, string> = {
      H_muro: 'H_muro',
      h_pan: 'h_pan',
      s_ph: 's_ph_dir',
      s_adot: 's_dir',
      s_pv: 's_pv_dir',
      s_est: 's_est',
      l_cf: 'l_cf',
      tenr_: 'tenr_',
      L_total: 'L_total',
    };
    for (const [ajuste, entrada] of Object.entries(daModulacao)) expect(entradaDoAjuste(ajuste, existe), ajuste).toBe(entrada);
    expect(entradaDoAjuste('nome_que_nao_existe', existe)).toBeNull();
  });
});

describe('o valor vira alteração', () => {
  it('igual ao padrão, a chave sai; diferente, entra', () => {
    const h = meta('H_muro');
    const a1 = aplicarValor({}, h, 2.6);
    expect(a1).toEqual({ H_muro: 2.6 });
    expect(aplicarValor(a1, h, 1.6)).toEqual({});
    expect(valorAtual(h, {})).toBe(1.6);
    expect(valorAtual(h, a1)).toBe(2.6);
  });
  it('opcional com padrão, apagado, grava null (a planilha decide)', () => {
    const s = meta('s_dir');
    expect(aplicarValor({}, s, null)).toEqual({ s_dir: null });
    expect(valorAtual(s, { s_dir: null })).toBeNull();
  });
  it('escolher "19" ou 19 na espessura do padrão não cria alteração', () => {
    expect(aplicarValor({}, meta('t_bloco'), 19)).toEqual({});
    expect(aplicarValor({}, meta('t_bloco'), 14)).toEqual({ t_bloco: 14 });
  });
});

describe('altura de solo ≤ altura do muro (Jose, 09/10)', () => {
  it('solo acima do muro vai para o topo do muro, com o "→"', () => {
    const t = ajustarAosTetos(META, { H_muro: 2.0, H_solo: 2.6 });
    expect(t.alteracoes).toEqual({ H_muro: 2.0, H_solo: 2.0 });
    expect(t.ajustes).toEqual([{ nome: 'H_solo', de: 2.6, para: 2.0 }]);
  });
  it('baixar o muro abaixo do solo do padrão (1,60) puxa o solo junto', () => {
    const t = ajustarAosTetos(META, { H_muro: 1.2 });
    expect(t.alteracoes).toEqual({ H_muro: 1.2, H_solo: 1.2 });
  });
  it('solo abaixo do muro, ou no topo, fica como está', () => {
    expect(ajustarAosTetos(META, { H_muro: 3.0, H_solo: 1.75 }).ajustes).toEqual([]);
    expect(ajustarAosTetos(META, { H_muro: 2.0, H_solo: 2.0 }).ajustes).toEqual([]);
    expect(ajustarAosTetos(META, {}).ajustes).toEqual([]);
  });
  it('o teto aponta para entradas que existem', () => {
    for (const [n, t] of Object.entries(_tetos)) {
      expect(META.has(n), n).toBe(true);
      expect(META.has(t), t).toBe(true);
    }
  });
  it('zero de solo é recusado no campo (a conta divide pela altura de solo)', () => {
    expect(lerDoCampo('0', campoDe(meta('H_solo'), 'planilha')).ok).toBe(false);
    expect(lerDoCampo('1,35', campoDe(meta('H_solo'), 'planilha'))).toEqual({ ok: true, valor: 1.35 });
  });
});

describe('classe de solo com argila (Jose, 09/10)', () => {
  const ler = (a: Record<string, Valor>) => leitorDeValores(META, a, {});
  it('com argila a classe se apaga e fica travada em "Não se aplica"', () => {
    expect(entradaAtiva('Classe_G', ler({ Tipo_solo: 'Argila' }))).toBe(false);
    expect(valorTravado('Classe_G', ler({ Tipo_solo: 'Argila', Classe_G: 'Areia densa' }))).toBe('Não se aplica');
  });
  it('com areia ou outro a classe volta, com o valor que estava', () => {
    expect(entradaAtiva('Classe_G', ler({ Tipo_solo: 'Areia' }))).toBe(true);
    expect(valorTravado('Classe_G', ler({ Tipo_solo: 'Outro', Classe_G: 'Areia densa' }))).toBeUndefined();
  });
  it('"Não se aplica" é opção da lista da planilha (o combo consegue mostrar)', () => {
    expect(campoDe(meta('Classe_G'), 'planilha').opcoes.map((o) => o.valor)).toContain('Não se aplica');
  });
});
