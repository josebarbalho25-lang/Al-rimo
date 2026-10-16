// ═══════════════════════════════════════════════════════════════════════════
//  integracao.tsx — liga as peças das frentes nas tomadas da casca
// ---------------------------------------------------------------------------
//  A casca (ui/, estado/) nasceu sem importar ninguém; aqui é o único lugar
//  que conhece todo mundo. Se uma frente mudar de assinatura, quebra AQUI, na
//  compilação — e não espalhado pelas telas.
// ═══════════════════════════════════════════════════════════════════════════

import { useApp } from '@/estado/store';
import { gerarModelo } from '@/modulacao';
import { exportarIfc } from '@/ifc';
import { imprimirMemorial, vereditoDaMemoria, figuraDoCard } from '@/memoria';
import { Memoria } from '@/memoria/Memoria';
import { Visor3D } from '@/visor/Visor3D';
import { Desenhos } from '@/desenhos/Desenhos';
import { Quantitativo } from '@/quantitativo/Quantitativo';
import { TelaDasPranchas } from '@/pranchas/TelaDasPranchas';
import { ligarEnvioParaPrancha } from '@/pranchas/receber';
import type { Resultado } from '@/motor/tipos';

// A memória pede a figura do card por número ('Fig. 11'); o acervo é o mesmo do botão das entradas.
const urlDaFigura = (figura: string) => figuraDoCard(figura)?.url ?? null;

// A aba recebe só modelo e resultado; o nome do projeto vem do estado — sem isso o Imprimir/Word da própria aba
// saía "Projeto sem nome" enquanto o da barra de cima saía certo.
function MemoriaDoProjeto({ resultado }: { resultado: Resultado }) {
  const projeto = useApp((s) => s.titulo);
  return <Memoria resultado={resultado} info={{ projeto }} urlDaFigura={urlDaFigura} />;
}

export function ligarAsFrentes(): void {
  // o "Enviar para a prancha" do 3D e das vistas cai na folha ativa, com a aba Pranchas aberta ou não
  ligarEnvioParaPrancha();
  useApp.getState().ligar({
    gerador: gerarModelo,
    exportarIfc,
    veredito: (r) => vereditoDaMemoria(r),
    imprimirMemoria: (r, i) => imprimirMemorial(r, { info: { projeto: i.projeto }, urlDaFigura }),
    abas: {
      '3d': (c) => c.modelo && <Visor3D modelo={c.modelo} selecionado={c.selecionado} onSelecionar={c.selecionar} />,
      frontal: (c) => c.modelo && <Desenhos modelo={c.modelo} vista="frontal" selecionado={c.selecionado} onSelecionar={c.selecionar} />,
      corte: (c) => c.modelo && <Desenhos modelo={c.modelo} vista="corte" selecionado={c.selecionado} onSelecionar={c.selecionar} />,
      planta: (c) => c.modelo && <Desenhos modelo={c.modelo} vista="planta" selecionado={c.selecionado} onSelecionar={c.selecionar} />,
      iso: (c) => c.modelo && <Desenhos modelo={c.modelo} vista="iso" selecionado={c.selecionado} onSelecionar={c.selecionar} />,
      armacao: (c) => c.modelo && <Desenhos modelo={c.modelo} vista="armacao" selecionado={c.selecionado} onSelecionar={c.selecionar} />,
      memoria: (c) => c.resultado && <MemoriaDoProjeto resultado={c.resultado} />,
      quantitativo: (c) => c.modelo && <Quantitativo modelo={c.modelo} />,
      pranchas: (c) => <TelaDasPranchas modelo={c.modelo} resultado={c.resultado} />,
    },
  });
}
