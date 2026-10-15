/*
  A tabela de gráficos guardada NO APP (Jose, 15/10: vale para todo muro, como os dados do escritório) — fica na
  máquina, não no arquivo do muro. Cada troca vai na hora para os desenhos (`usarGraficos`) e para o
  armazenamento; "Restaurar padrão" volta ao de fábrica e esquece o guardado.
*/
import { create } from 'zustand';
import { esquecer, guardar, lembrar } from '@/estado/lembrete';
import { GRAFICOS_DE_FABRICA, lerGraficos, usarGraficos, type Graficos } from './graficos';

const CHAVE = 'alrimo.graficos.v1';

const guardado = lembrar<unknown>(CHAVE, null, (x): x is unknown => x !== undefined);
const inicial = guardado === null ? GRAFICOS_DE_FABRICA : lerGraficos(guardado);
usarGraficos(inicial);

interface EstadoDosGraficos {
  dados: Graficos;
  mudar: (f: (g: Graficos) => Graficos) => void;
  restaurar: () => void;
}

export const useGraficos = create<EstadoDosGraficos>()((set, get) => ({
  dados: inicial,
  mudar(f) {
    const dados = f(get().dados);
    usarGraficos(dados);
    set({ dados });
    guardar(CHAVE, dados);
  },
  restaurar() {
    usarGraficos(GRAFICOS_DE_FABRICA);
    set({ dados: GRAFICOS_DE_FABRICA });
    esquecer(CHAVE);
  },
}));
