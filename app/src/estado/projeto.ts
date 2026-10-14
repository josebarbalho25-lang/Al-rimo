// ═══════════════════════════════════════════════════════════════════════════
//  estado/projeto.ts — o arquivo .alrimo, sem disco
// ---------------------------------------------------------------------------
//  O arquivo guarda o que o USUÁRIO decidiu, não o que a conta deu: as
//  alterações da planilha, as entradas do modelo e a versão da conta que as
//  recebeu. Resultado não se grava — abre-se o arquivo e a conta roda de novo.
//  Gravar resultado seria guardar um número que pode não bater mais com a
//  conta do dia em que o arquivo for aberto, e ninguém perceberia.
//
//  A versão da conta (hash do gerador da planilha) vai junto para o dia em que
//  a conta mudar: o arquivo abre do mesmo jeito, mas a barra de estado avisa
//  que a conta é outra — o mesmo muro pode dar outro número.
// ═══════════════════════════════════════════════════════════════════════════

import type { Alteracoes, Valor } from '@/motor/tipos';
import { validarValor, type Campo } from './campos';
import { alteracoesDoExemplo, alteracoesDoNovo, extrasDoNovo, TITULO_DO_EXEMPLO } from './novo';
import { ruim } from './recadoRuim';

export const EXTENSAO = '.alrimo';
/** A versão da conta de um arquivo que não diz qual é. */
export const VERSAO_DESCONHECIDA = 'desconhecida';
const FORMATO = 'alrimo';
/*
  2 (09/10/2026): duas alturas, a do muro (H_muro) e a de solo (H_solo). Na versão 1 a altura única era a do SOLO e o
  muro subia sozinho até fechar a fiada — o arquivo v1 abre com o solo nessa altura (ver desserializarProjeto). O
  número da versão é o que separa os dois casos: um arquivo novo com só H_muro gravado quer dizer "solo no padrão",
  porque a entrada igual ao padrão não se grava.
*/
const VERSAO_DO_ARQUIVO = 2;

export interface Projeto {
  /** A identidade do muro (ver novoIdDeProjeto). Não muda com o nome; nasce no Novo. */
  id: string;
  titulo: string;
  alteracoes: Alteracoes;
  extras: Record<string, Valor>;
}

interface Arquivo {
  formato: typeof FORMATO;
  versaoDoArquivo: number;
  /** Hash do gerador da planilha que fez a conta quando o arquivo foi salvo. */
  versaoDaConta: string;
  /*
    Campo novo sem subir a versão do arquivo: a falta dele não muda a leitura de mais nada — o arquivo antigo abre
    igual e só ganha um id (desserializarProjeto). Subir a versão faria um app anterior recusar o arquivo inteiro
    por causa de um campo que ele simplesmente ignoraria.
  */
  id: string;
  titulo: string;
  alteracoes: Alteracoes;
  extras: Record<string, Valor>;
}

/*
  A IDENTIDADE DO MURO. O IFC dá a cada peça um GUID, e o Revit/Navisworks reconhece a peça por ele: é o GUID que
  faz o vínculo recarregado achar "a mesma parede" e é ele que não pode se repetir entre dois muros no mesmo modelo
  federado. Os GUIDs saem desta identidade (ifc/exportarIfc.ts, `chave`), então ela precisa ser:
    · ÚNICA por muro — tirada do nome, todo muro novo se chamava "Sem título" e dois muros diferentes saíam com
      os MESMOS GUIDs, um por cima do outro no modelo federado;
    · FIXA na vida do muro — tirada do nome, renomear trocava todos os GUIDs e o vínculo perdia as peças.
  Por isso é sorteada quando o muro nasce (Novo, ou o app aberto pela primeira vez) e viaja no arquivo.
  Copiar o arquivo (Explorer, "Salvar como") leva a mesma identidade — é a mesma convenção do Revit, onde a
  cópia de um .rvt mantém os ids das peças.
*/
const FORMATO_DO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID v4. */
export function novoIdDeProjeto(): string {
  const c = globalThis.crypto;
  // randomUUID só existe em "contexto seguro" (https ou localhost); o app aberto pelo IP da rede ou de um
  // arquivo local não o tem — daí a reserva com getRandomValues, que existe em qualquer página.
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); // último recurso: ambiente sem crypto
  b[6] = (b[6] & 0x0f) | 0x40; // versão 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** O muro em branco do Novo e da primeira abertura — já com a identidade dele. */
/** O muro novo: dados do terreno e do projeto em branco, automáticos seguros (estado/novo.ts — Jose, 13/10). */
export function projetoNovo(): Projeto {
  return { id: novoIdDeProjeto(), titulo: 'Sem título', alteracoes: alteracoesDoNovo(), extras: extrasDoNovo() };
}

/** O muro de exemplo: a aula 12.2, com a sapata rígida (estado/novo.ts). Identidade própria a cada abertura. */
export function projetoExemplo(): Projeto {
  return { id: novoIdDeProjeto(), titulo: TITULO_DO_EXEMPLO, alteracoes: alteracoesDoExemplo(), extras: {} };
}

export function serializarProjeto(p: Projeto, versaoDaConta: string): string {
  const a: Arquivo = {
    formato: FORMATO,
    versaoDoArquivo: VERSAO_DO_ARQUIVO,
    versaoDaConta,
    id: p.id,
    titulo: p.titulo,
    alteracoes: p.alteracoes,
    extras: p.extras,
  };
  return JSON.stringify(a, null, 2);
}

export type Aberto =
  | {
      ok: true;
      projeto: Projeto;
      /** Nomes que esta versão do app não conhece (a planilha mudou): ficaram de fora. */
      descartados: string[];
      /** Nomes conhecidos com valor que o campo não aceitaria (texto, negativo, fora da lista): ficaram no padrão. */
      recusados: string[];
      /** A conta que salvou o arquivo não é a de hoje. */
      outraVersao: boolean;
      versaoDaConta: string;
      /**
       * O arquivo não trazia identidade (salvo antes dela existir, ou estragado à mão) e ganhou uma agora. Quem
       * abre acende o "não salvo": enquanto ela não for para o disco, abrir o mesmo arquivo de novo sortearia
       * outra, e os GUIDs do IFC mudariam de uma exportação para a outra.
       */
      ganhouId: boolean;
    }
  | { ok: false; motivo: string };

/*
  ENTRADA QUE MUDOU DE FORMA. O arquivo guarda o valor como estava; se a planilha muda a entrada, o arquivo antigo
  cairia em "entrada ignorada" e abriria no padrão. Aqui o valor velho vira o novo antes da validação.
    · Graute (13/10): era texto ("Parcial (seção I)" / "Total (seção cheia)") e virou a grade "graute a cada X cm".
      Total → 20 (todos os furos). Parcial era o graute só nos furos com barra → a grade das barras que o arquivo
      tinha (s do balanço ou s vertical do painel), e o muro abre com os mesmos números; sem s digitado, 40.
*/
function renomeado(nome: string, v: unknown, todas: Record<string, unknown>): unknown {
  if (nome !== 'Graute' || typeof v !== 'string') return v;
  if (v.trim().toLowerCase().startsWith('total')) return 20;
  const contrafortes = todas.Tipo_muro === 'Contrafortes';
  const s = contrafortes ? todas.s_pv_dir : todas.s_dir;
  // a lista do graute vai até 6t, na grade de 20: bloco 19 → 100, bloco 14 → 80
  const t = typeof todas.t_bloco === 'number' ? todas.t_bloco : 19;
  const teto = Math.floor((6 * t) / 20) * 20;
  return typeof s === 'number' && s >= 20 && s <= teto && s % 20 === 0 ? s : 40;
}

/**
 * Lê o texto do arquivo. Cada valor passa pela MESMA porta do campo da tela
 * (`validarValor`): o arquivo é texto, pode ter sido editado à mão, e a conta
 * não pode receber o que o formulário recusaria. Nome que a conta de hoje não
 * conhece SAI (a conta recusaria o arquivo inteiro por ele); valor que o campo
 * não aceita também sai, e a entrada fica no padrão. Os dois voltam contados,
 * para a barra de estado dizer quantos.
 *
 * `campos` é o catálogo do painel: a ORIGEM de cada campo diz se o nome vale
 * nas alterações (planilha) ou nos extras (modelo) — H_muro dentro de extras
 * não vale.
 */
export function desserializarProjeto(
  texto: string,
  campos: ReadonlyMap<string, Campo>,
  versaoDeHoje: string,
): Aberto {
  let a: Partial<Arquivo>;
  try {
    a = JSON.parse(texto) as Partial<Arquivo>;
  } catch {
    return { ok: false, motivo: 'arquivo ilegível' };
  }
  if (!a || typeof a !== 'object' || a.formato !== FORMATO) return { ok: false, motivo: 'não é um arquivo do Al-rimo' };
  if (typeof a.versaoDoArquivo === 'number' && a.versaoDoArquivo > VERSAO_DO_ARQUIVO) {
    return { ok: false, motivo: 'arquivo de uma versão mais nova do Al-rimo' };
  }

  const descartados: string[] = [];
  const recusados: string[] = [];
  const filtrar = (fonte: unknown, origem: Campo['origem']): Record<string, Valor> => {
    const saida: Record<string, Valor> = {};
    if (!fonte || typeof fonte !== 'object' || Array.isArray(fonte)) return saida;
    for (const [k, v] of Object.entries(fonte as Record<string, unknown>)) {
      const c = campos.get(k);
      if (!c || c.origem !== origem) {
        descartados.push(k);
        continue;
      }
      const lido = validarValor(c, renomeado(k, v, fonte as Record<string, unknown>));
      if (lido.ok) saida[k] = lido.valor;
      else recusados.push(k);
    }
    return saida;
  };

  // Arquivo sem versão (feito à mão, ou de formato antigo): a conta que o
  // salvou é DESCONHECIDA, e isso tem de acender o aviso como "outra versão".
  // Texto vazio aqui passava por "sem aviso" na barra de estado, enquanto o
  // recado dizia "outra versão" — a tela se contradizia.
  const versaoDaConta = typeof a.versaoDaConta === 'string' && a.versaoDaConta ? a.versaoDaConta : VERSAO_DESCONHECIDA;
  const alteracoes = filtrar(a.alteracoes, 'planilha');
  // Arquivo v1 (antes das duas alturas): a altura gravada era a do solo. O solo vai para ela, e o muro antigo abre
  // calculando o mesmo empuxo (o muro, se a altura não fechava a fiada, a lista sobe — como o desenho de antes subia).
  const versaoDoArquivo = typeof a.versaoDoArquivo === 'number' ? a.versaoDoArquivo : 1;
  if (versaoDoArquivo < 2 && typeof alteracoes.H_muro === 'number' && !('H_solo' in alteracoes) && campos.has('H_solo')) {
    alteracoes.H_solo = alteracoes.H_muro;
  }
  // Só UUID: um id qualquer escrito à mão ("1", "muro") se repetiria em outro arquivo e voltaria a colisão de
  // GUIDs. O que vem no formato fica como veio, letra por letra — é o texto exato que vira GUID.
  const ganhouId = !(typeof a.id === 'string' && FORMATO_DO_ID.test(a.id));
  return {
    ok: true,
    projeto: {
      id: ganhouId ? novoIdDeProjeto() : (a.id as string),
      titulo: typeof a.titulo === 'string' && a.titulo.trim() ? a.titulo : 'Sem título',
      alteracoes,
      extras: filtrar(a.extras, 'modelo'),
    },
    descartados,
    recusados,
    outraVersao: versaoDaConta !== versaoDeHoje,
    versaoDaConta,
    ganhouId,
  };
}

/**
 * A frase da barra de estado depois de abrir. Notícia ruim tem prioridade: o
 * que ficou de fora (nome desconhecido ou valor que o campo recusaria) e a
 * conta de outra versão.
 */
export function recadoDeAbertura(
  nome: string,
  a: { descartados: string[]; recusados: string[]; outraVersao: boolean },
): string {
  const fora = a.descartados.length + a.recusados.length;
  if (fora) return ruim(`${nome} aberto · ${fora} ${fora === 1 ? 'entrada ignorada' : 'entradas ignoradas'}`);
  if (a.outraVersao) return ruim(`${nome} aberto · salvo com outra versão da conta`);
  return `${nome} aberto`;
}

/** "Muro da rua 3.alrimo" → "Muro da rua 3". */
export function tituloDoArquivo(nome: string): string {
  return nome.replace(/\.[^.\\/]+$/, '').trim() || 'Sem título';
}

/** Nome de arquivo sem os caracteres que o Windows recusa. */
export function nomeDeArquivo(titulo: string, extensao: string): string {
  const base = titulo.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim() || 'Sem título';
  return base + extensao;
}
