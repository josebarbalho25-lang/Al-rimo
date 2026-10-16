/*
  Os gráficos guardados NO APP (Jose, 15/10: vale para todo muro, como os dados do escritório) — fica na máquina, não
  no arquivo do muro: a tabela GERAL (a da engrenagem), as cores das bitolas e a sobreposição do 3D do visor. A
  sobreposição de cada vista vai no arquivo, com a vista (pranchas/vistas.ts). Cada troca vai na hora para os
  desenhos (`usarGraficos`) e para o armazenamento; "Restaurar padrão" volta ao de fábrica e esquece o guardado.
*/
import { create } from 'zustand';
import { esquecer, guardar, lembrar } from '@/estado/lembrete';
import { GRAFICOS_DE_FABRICA, lerGraficos, usarGraficos, type Graficos } from './graficos';
import { mesmoConteudo } from '@/pranchas/vistas';

// v3 desde 16/10 à noite (a geral e a sobreposição por vista); a v2 (uma tabela por tipo de vista) e a v1 (uma só)
// são lidas uma vez, se não há v3 (lerGraficos as converte) — nunca mais escritas: um app de antes aberto na mesma
// porta não estraga a de hoje.
const CHAVE = 'alrimo.graficos.v3';
const ANTIGAS = ['alrimo.graficos.v2', 'alrimo.graficos.v1'];

const algum = (x: unknown): x is unknown => x !== undefined;
const guardado = [CHAVE, ...ANTIGAS].reduce<unknown>((achado, k) => achado ?? lembrar<unknown>(k, null, algum), null);
const inicial = guardado === null ? GRAFICOS_DE_FABRICA : lerGraficos(guardado);
usarGraficos(inicial);

interface EstadoDosGraficos {
  dados: Graficos;
  mudar: (f: (g: Graficos) => Graficos) => void;
  /** De fábrica. `manterVisor`: a janela dos gráficos gerais restaura a geral e as bitolas, não o 3D (o 3D tem a dele). */
  restaurar: (manterVisor?: boolean) => void;
}

/**
 * Guarda — ou esquece, se é o de fábrica: o Cancelar que volta ao de fábrica não deixa a tabela de hoje gravada (a
 * guardada leva a tabela inteira, e um padrão de fábrica novo de uma versão futura não chegaria mais nesta máquina).
 */
function guardarOuEsquecer(dados: Graficos): void {
  if (mesmoConteudo(dados, GRAFICOS_DE_FABRICA)) {
    esquecer(CHAVE);
    for (const k of ANTIGAS) esquecer(k);
  } else guardar(CHAVE, dados);
}

export const useGraficos = create<EstadoDosGraficos>()((set, get) => ({
  dados: inicial,
  mudar(f) {
    const antes = get().dados;
    const dados = f(antes);
    if (dados === antes || mesmoConteudo(dados, antes)) return;
    usarGraficos(dados);
    set({ dados });
    guardarOuEsquecer(dados);
  },
  restaurar(manterVisor) {
    const dados = manterVisor ? { ...GRAFICOS_DE_FABRICA, visor: get().dados.visor } : GRAFICOS_DE_FABRICA;
    usarGraficos(dados);
    set({ dados });
    guardarOuEsquecer(dados);
  },
}));
