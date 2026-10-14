// O estado do app sem tela: os três defeitos que a revisão reproduziu no store
// (Salvar no meio da digitação, aviso de conta antiga sumindo no F5, lembrete
// estragado no navegador). Cada teste "recarrega a página" (módulos novos) com
// um localStorage de mentira, que sobrevive à recarga como o de verdade.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { alteracoesDoExemplo } from './novo';

function armazenamento(m: Map<string, string>) {
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

async function abrirApp(m: Map<string, string>) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: armazenamento(m) });
  vi.resetModules();
  const store = await import('./store');
  const lembrete = await import('./lembrete');
  return { ...store, ...lembrete };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).localStorage;
});

const ID_A = '0b9f3c1e-6a2d-4c8e-9f10-2a3b4c5d6e7f';

describe('salvar', () => {
  it('o que se digita enquanto o disco grava continua marcado como não salvo', async () => {
    const app = await abrirApp(new Map());
    const s = app.useApp.getState();
    s.definir('H_muro', 2.2);
    const gravado = app.projetoAtual(app.useApp.getState());
    app.useApp.getState().definir('H_muro', 3); // o disco ainda não respondeu
    app.useApp.getState().marcarSalvo('Muro A.alrimo', 'Muro A', gravado);
    const d = app.useApp.getState();
    expect(d.arquivo).toBe('Muro A.alrimo');
    expect(d.sujo).toBe(true);
  });

  it('sem nada digitado no meio, fica salvo', async () => {
    const app = await abrirApp(new Map());
    app.useApp.getState().definir('H_muro', 2.2);
    app.useApp.getState().marcarSalvo('Muro A.alrimo', 'Muro A', app.projetoAtual(app.useApp.getState()));
    expect(app.useApp.getState().sujo).toBe(false);
  });
});

describe('o último projeto no navegador', () => {
  it('o aviso "salvo com outra versão da conta" sobrevive ao F5', async () => {
    const m = new Map<string, string>();
    let app = await abrirApp(m);
    app.lembrarUltimoProjeto();
    app.useApp.getState().carregar({ id: ID_A, titulo: 'Muro A', alteracoes: { H_muro: 2.2 }, extras: {} }, 'Muro A.alrimo', {
      contaDoArquivo: 'conta-antiga-0001',
    });
    app = await abrirApp(m);
    const s = app.useApp.getState();
    expect(s.arquivo).toBe('Muro A.alrimo');
    expect(s.alteracoes).toEqual({ H_muro: 2.2 });
    expect(s.contaDoArquivo).toBe('conta-antiga-0001');
    expect(s.idDoProjeto).toBe(ID_A);
  });

  it('volta com a conta refeita, a aba e o sujo', async () => {
    const m = new Map<string, string>();
    let app = await abrirApp(m);
    app.lembrarUltimoProjeto();
    app.useApp.getState().definir('H_muro', 2.2);
    app.useApp.getState().definir('Tipo_muro', 'Contrafortes');
    app.useApp.getState().escolherAba('memoria');
    app = await abrirApp(m);
    const s = app.useApp.getState();
    // a 1ª abertura é o exemplo (14/10): as alterações dele + as duas desta sessão
    expect(s.alteracoes).toEqual({ ...alteracoesDoExemplo(), H_muro: 2.2, Tipo_muro: 'Contrafortes' });
    expect(s.sujo).toBe(true);
    expect(s.aba).toBe('memoria');
    expect(s.resultado?.num('H_muro')).toBe(2.2);
  });

  it('lembrete estragado no navegador vira o padrão, sem derrubar nada', async () => {
    const m = new Map([
      ['alrimo.grupos.v1', 'null'],
      ['alrimo.aba.v1', '"aba-que-nao-existe"'],
      ['alrimo.largura.v2', '"larga"'],
      ['alrimo.ultimo.v1', '{"texto":42}'],
    ]);
    const app = await abrirApp(m);
    expect(app.lembrar(app.CHAVES.grupos, {}, app.ehMapaDeBooleanos)).toEqual({});
    expect(app.lembrarLarguraDoPainel()).toBeNull();
    const s = app.useApp.getState();
    expect(s.aba).toBe('3d');
    expect(s.alteracoes).toEqual(alteracoesDoExemplo());
    expect(s.resultado).not.toBeNull();
  });

  it('valor estragado dentro do último projeto não chega à conta', async () => {
    const m = new Map<string, string>();
    let app = await abrirApp(m);
    const texto = JSON.stringify({
      formato: 'alrimo',
      versaoDoArquivo: 1,
      versaoDaConta: app.VERSAO_DA_CONTA,
      titulo: 'x',
      alteracoes: { H_muro: '2,6', t_bloco: 17 },
      extras: {},
    });
    m.set('alrimo.ultimo.v1', JSON.stringify({ texto, arquivo: null, sujo: true }));
    app = await abrirApp(m);
    // arquivo v1 (uma altura só, a do solo): o solo vai para a mesma altura (estado/projeto.ts)
    expect(app.useApp.getState().alteracoes).toEqual({ H_muro: 2.6, H_solo: 2.6 });
    expect(app.useApp.getState().resultado?.num('H_muro')).toBe(2.6);
    expect(app.useApp.getState().resultado?.num('H_solo')).toBe(2.6);
  });
});

describe('largura do painel', () => {
  it('a da v1 (px de tela a 110%) vira px na escala 100%, uma vez, e a velha some', async () => {
    const m = new Map([['alrimo.largura.v1', '495']]);
    const app = await abrirApp(m);
    expect(app.lembrarLarguraDoPainel()).toBe(450);
    expect(m.has('alrimo.largura.v1')).toBe(false);
    expect(m.get('alrimo.largura.v2')).toBe('450');
    expect(app.lembrarLarguraDoPainel()).toBe(450);
  });

  it('a de fábrica (null, duplo clique) continua de fábrica', async () => {
    const app = await abrirApp(new Map([['alrimo.largura.v2', 'null']]));
    expect(app.lembrarLarguraDoPainel()).toBeNull();
  });
});

describe('listas que dependem de outra entrada (montagens fechadas)', () => {
  it('trocar o bloco leva contraforte e vão para a opção mais próxima, e o "→" fica até mexer no campo', async () => {
    const app = await abrirApp(new Map());
    app.useApp.getState().definir('Tipo_muro', 'Contrafortes');
    app.useApp.getState().definir('t_bloco', 14);
    let s = app.useApp.getState();
    // padrões do bloco 19 (contraforte 59, vão 1,60) fora das listas do 14 (34/54; 0,95 … 3,75)
    expect(s.alteracoes).toMatchObject({ t_bloco: 14, tenr_: 54, l_cf: 1.75 });
    expect(s.ajustesDeLista.tenr_).toEqual({ nome: 'tenr_', de: 59, para: 54 });
    expect(s.ajustesDeLista.l_cf).toEqual({ nome: 'l_cf', de: 1.6, para: 1.75 });
    expect(s.resultado?.v('tenr_adot')).toBe(54);
    app.useApp.getState().definir('tenr_', 34);
    s = app.useApp.getState();
    expect(s.ajustesDeLista.tenr_).toBeUndefined();
    expect(s.ajustesDeLista.l_cf).toBeDefined();
    // de volta ao 19: 34 → 59 (o mais perto, e o padrão: a chave sai), 1,75 → 1,80
    app.useApp.getState().definir('t_bloco', 19);
    s = app.useApp.getState();
    expect(app.leitorDoEstado(s)('tenr_')).toBe(59);
    expect(s.alteracoes.l_cf).toBe(1.8);
  });

  it('Ø com espera: a sapata baixa leva ao maior que cabe, e o Ø escolhido volta quando cabe de novo', async () => {
    // digitar "0,25" na altura da sapata passa por "0,2" (o campo manda a conta a cada tecla)
    const app = await abrirApp(new Map());
    app.useApp.getState().definir('phi_v', 16);
    app.useApp.getState().definir('h_sap', 0.2);
    let s = app.useApp.getState();
    expect(s.alteracoes.phi_v).toBe(12.5);
    expect(s.ajustesDeLista.phi_v).toEqual({ nome: 'phi_v', de: 16, para: 12.5 });
    app.useApp.getState().definir('h_sap', 0.205);               // 20,83 > 20,5: continua 12,5, "→" do 16
    s = app.useApp.getState();
    expect(s.alteracoes.phi_v).toBe(12.5);
    expect(s.ajustesDeLista.phi_v).toEqual({ nome: 'phi_v', de: 16, para: 12.5 });
    app.useApp.getState().definir('h_sap', 0.25);                // 2·4 + 1,63 + 11,2 = 20,83 ≤ 25: volta
    s = app.useApp.getState();
    expect(s.alteracoes.phi_v).toBe(16);
    expect(s.ajustesDeLista.phi_v).toBeUndefined();
    // escolhido na lista depois do "→", fica o escolhido
    app.useApp.getState().definir('h_sap', 0.2);
    app.useApp.getState().definir('phi_v', 10);
    app.useApp.getState().definir('h_sap', 0.3);
    s = app.useApp.getState();
    expect(app.leitorDoEstado(s)('phi_v')).toBe(10);
    expect(s.ajustesDeLista.phi_v).toBeUndefined();
  });

  it('arquivo salvo com valor fora da lista abre ajustado e marcado como alterado', async () => {
    const app = await abrirApp(new Map());
    app.useApp.getState().carregar({ id: ID_A, titulo: 'Antigo', alteracoes: { Tipo_muro: 'Contrafortes', l_cf: 1.5 }, extras: {} }, 'Antigo.alrimo');
    const s = app.useApp.getState();
    expect(app.leitorDoEstado(s)('l_cf')).toBe(1.6);
    expect(s.sujo).toBe(true);
    expect(s.ajustesDeLista.l_cf).toEqual({ nome: 'l_cf', de: 1.5, para: 1.6 });
  });
});

describe('o "l" da esbeltez é o muro desenhado (Jose, 12/10)', () => {
  it('balanço travado: a conta recebe o comprimento do muro, já no módulo do bloco', async () => {
    const app = await abrirApp(new Map());
    const { gerarModelo } = await import('@/modulacao');
    app.useApp.getState().ligar({ gerador: gerarModelo });
    app.useApp.getState().definir('Trav_lat', 'Sim');
    expect(app.useApp.getState().resultado?.v('l_trav')).toBe(6);          // padrão do comprimento: 6,00 fecha
    app.useApp.getState().definir('L_total', 6.1);                          // não fecha: "→ 6,2"
    const s = app.useApp.getState();
    expect(s.modelo?.ajustes).toContainEqual({ nome: 'L_total', de: 6.1, para: 6.2, unidade: 'm' });
    expect(s.resultado?.v('l_trav')).toBe(6.2);
  });

  it('contrafortes: trocar o espaçamento refaz o muro (o 3D anda junto)', async () => {
    const app = await abrirApp(new Map());
    const { gerarModelo } = await import('@/modulacao');
    app.useApp.getState().ligar({ gerador: gerarModelo });
    app.useApp.getState().definir('Tipo_muro', 'Contrafortes');
    app.useApp.getState().definir('t_bloco', 14);
    const passo = () => {
      const xs = app.useApp.getState().modelo!.dims.contrafortes.map((c) => c.x);
      return xs[1] - xs[0];
    };
    app.useApp.getState().definir('l_cf', 1.35);
    expect(passo()).toBe(1350);
    app.useApp.getState().definir('l_cf', 2.15);
    expect(passo()).toBe(2150);
    // a esbeltez usa o adotado: o he_ muda com o espaçamento (travamento lateral = Sim)
    app.useApp.getState().definir('Trav_lat', 'Sim');
    const he215 = app.useApp.getState().resultado?.num('he_');
    app.useApp.getState().definir('l_cf', 1.35);
    expect(app.useApp.getState().resultado?.num('he_')).not.toBe(he215);
  });
});
