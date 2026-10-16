/*
  O DESENHISTA DAS PRANCHAS — quem entrega à folha o desenho de cada item, já pronto para o papel, e guarda o que já
  desenhou: arrastar um desenho pela folha não pode redesenhar o muro a cada passo do mouse (a folha só se recompõe;
  o corte, a planta e o 3D ficam no cache enquanto o muro, a escala e o pedido forem os mesmos).

  A prancha é VIVA (Jose, 14/10): um desenhista por muro (o Modelo é imutável — muro novo, desenhista novo, cache
  novo); o 3D é refeito do ponto de vista guardado, fora da tela (visor/fotoRefeita.ts), com o fundo transparente
  para cair na folha branca. A foto chega depois (100 a 200 ms): até lá a folha mostra o lugar tracejado e, quando
  chega, `aoMudar` pede para recompor.

  O que cada item vira (Jose, 14/10):
    · vista 2D (frontal, corte, planta, isométrico) → vetor, na escala pedida (desenhos/paraPrancha.ts);
    · 3D em Cores ou Opaco → VETOR também ("o 3D gerado a partir das vistas opaco e cores eu quero DXF"), o pintor
      do isométrico com a câmera do visor;
    · 3D no Realista → foto (textura não vira linha);
    · tabela de materiais (Jose, 15/10) → em mm de papel, do quantitativo do muro (tabelaDaFolha.ts). A figura de
      cada peça vem do arquivo do app (figurasDasPecas.ts), uma vez por desenhista: como a foto, chega depois — a
      tabela sai com o lugar da figura vazio e se recompõe quando ela chega; o PDF e o DXF esperam por ela.
*/
import { nomeDado } from './vistas';
import { versaoDosGraficos } from '@/desenhos/graficos';
import type { Modelo } from '@/modelo/tipos';
import { refazerFoto } from '@/visor/fotoRefeita';
import { vista3dParaPrancha, vistaParaPrancha } from '@/desenhos/paraPrancha';
import { cortesPadrao } from '@/desenhos/corteLateral';
import { metros } from '@/desenhos/formato';
import { quantificar, type Quantitativo } from '@/quantitativo';
import type { ItemDesenhado } from './folha';
import type { ItemDaFolha } from './tipos';
import { carregarFigura, type CarregarFigura, type FiguraPronta } from './figurasDasPecas';
import { TITULO_DA_TABELA, desenharTabela, tabelaParaFolha } from './tabelaDaFolha';

/** Desenhos guardados por desenhista (um por muro): o bastante para várias folhas com o PDF e a tela juntos. */
const MAXIMO_GUARDADO = 120;

export interface Desenhista {
  desenhar: (item: ItemDaFolha, prefixo: string, opcoes?: { legendaDeCores: boolean; vetorial?: boolean }) => ItemDesenhado | null;
  /** O título do desenho quando o projetista não escreveu um. */
  tituloAutomatico: (item: ItemDaFolha) => string;
  /** Solta o que ficou guardado (troca de muro). */
  descartar: () => void;
  /** Espera as fotos (e as figuras das peças) pedidas chegarem (PDF e DXF não podem sair com o lugar vazio). */
  esperarFotos: () => Promise<void>;
}


/** Resolução da foto no papel: 250 pontos por polegada (nítida no PDF de prancha), até 4000 px no lado maior. */
const PONTOS_POR_MM = 250 / 25.4;
const LADO_MAXIMO = 4000;

export function tamanhoDaFoto(larguraMm: number, proporcao: number): [number, number] {
  let w = Math.max(64, Math.round(larguraMm * PONTOS_POR_MM));
  let h = Math.max(64, Math.round(w / proporcao));
  const k = Math.min(1, LADO_MAXIMO / Math.max(w, h));
  w = Math.round(w * k);
  h = Math.round(h * k);
  return [w, h];
}

export function criarDesenhista(modelo: Modelo | null, aoMudar: () => void = () => {}, carregar: CarregarFigura = carregarFigura): Desenhista {
  const fotos = new Map<string, { dataUrl: string; proporcao: number } | 'pedida' | 'falhou'>();
  // a última foto pronta de cada ponto de vista: ao redimensionar, a folha mostra a anterior enquanto a nova sai
  const ultima = new Map<string, { dataUrl: string; proporcao: number }>();
  let vivo = true;
  // as fotos a caminho: quem exporta espera por elas
  const aCaminho = new Set<Promise<unknown>>();

  const foto3d = (item: ItemDaFolha): ItemDesenhado | null => {
    if (!modelo || item.conteudo.tipo !== '3d') return null;
    const { camera, proporcao } = item.conteudo;
    // a foto não muda com a posição nem com o tamanho na folha até a resolução pedir outra
    const [w, h] = tamanhoDaFoto(item.largura ?? 160, proporcao);
    const ponto = JSON.stringify(camera);
    // a versão da tabela de gráficos entra: o 3D Cores e o Opaco mudam de cor com ela (15/10)
    const chave = `${versaoDosGraficos()}|${ponto}|${w}x${h}`;
    const tem = fotos.get(chave);
    const imagem = (f: { dataUrl: string; proporcao: number }): ItemDesenhado => ({ tipo: 'imagem', dataUrl: f.dataUrl, arquivo: `foto-${item.id}.png`, proporcao: f.proporcao });
    if (tem && tem !== 'pedida' && tem !== 'falhou') return imagem(tem);
    const anterior = ultima.get(ponto);
    if (tem === 'pedida' || tem === 'falhou') return anterior ? imagem(anterior) : null;
    fotos.set(chave, 'pedida');
    const pedido = refazerFoto(modelo, camera, w, h, { papel: true, cancelado: () => !vivo });
    aCaminho.add(pedido);
    void pedido.finally(() => aCaminho.delete(pedido)).catch(() => undefined);
    pedido.then(
      (dataUrl) => {
        if (!vivo) return;
        fotos.set(chave, { dataUrl, proporcao: w / h });
        ultima.set(ponto, { dataUrl, proporcao: w / h });
        aoMudar();
      },
      () => {
        if (!vivo) return;
        fotos.set(chave, 'falhou');
        aoMudar();
      },
    );
    return anterior ? imagem(anterior) : null;
  };

  // o quantitativo do muro, uma vez (o muro deste desenhista não muda); e as figuras das peças, por endereço
  let quant: Quantitativo | null | undefined;
  const quantitativo = (): Quantitativo | null => {
    if (quant === undefined) {
      try {
        quant = modelo ? quantificar(modelo) : null;
      } catch {
        quant = null;
      }
    }
    return quant;
  };
  const figuras = new Map<string, FiguraPronta | 'pedida' | 'falhou'>();
  const figura = (url: string): FiguraPronta | null => {
    const tem = figuras.get(url);
    if (tem === undefined) {
      // a que já chegou para o muro de antes vale para este: a tabela não pisca sem as peças a cada tecla
      const ja = carregar.pronta?.(url);
      if (ja) {
        figuras.set(url, ja);
        return ja;
      }
      figuras.set(url, 'pedida');
      const pedido = carregar(url);
      aCaminho.add(pedido);
      void pedido.finally(() => aCaminho.delete(pedido)).catch(() => undefined);
      pedido.then(
        (f) => {
          if (!vivo) return;
          figuras.set(url, f);
          aoMudar();
        },
        () => {
          // sem a figura a tabela sai igual, com o lugar dela vazio
          if (vivo) figuras.set(url, 'falhou');
        },
      );
      return null;
    }
    return typeof tem === 'object' ? tem : null;
  };

  // vetor guardado por pedido + escala + prefixo (o prefixo entra: os ids dos padrões vão no desenho)
  const vetores = new Map<string, ItemDesenhado | null>();
  const vetor = (pedido: string, fazer: () => ItemDesenhado | null): ItemDesenhado | null => {
    // a tabela de gráficos (cores, hachuras, o que aparece) também: trocou na tela, a folha redesenha
    const chave = `${versaoDosGraficos()}|${pedido}`;
    if (!vetores.has(chave)) {
      let d: ItemDesenhado | null = null;
      try {
        d = fazer();
      } catch {
        // muro que a vista não sabe desenhar: o lugar fica marcado, a folha segue
        d = null;
      }
      vetores.set(chave, d);
      // cada arrasto de chamada é uma chave nova: sem teto, uma tarde ajeitando a folha guardava centenas de desenhos
      // iguais (o Map anda na ordem de entrada: sai o mais antigo)
      if (vetores.size > MAXIMO_GUARDADO) vetores.delete(vetores.keys().next().value!);
    }
    return vetores.get(chave) ?? null;
  };

  return {
    desenhar: (item, prefixo, opcoes = { legendaDeCores: false }) => {
      if (!modelo) return null;
      const c = item.conteudo;
      const leg = opcoes.legendaDeCores;
      // para o arquivo (PDF), a hachura sai em traços de verdade (o padrão SVG o Chrome imprime como imagem de ~37 dpi)
      const vet = opcoes.vetorial === true;
      if (c.tipo === '3d') {
        if (c.camera.estilo === 'realista') return foto3d(item);
        const largura = Math.round(item.largura ?? 160);
        return vetor(`3d|${JSON.stringify(c.camera)}|${largura}|${prefixo}|${leg}|${vet}`, () => ({ tipo: 'vetor', vista: vista3dParaPrancha(modelo, c.camera, largura, prefixo, { legendaDeCores: leg, hachuraVetorial: vet }) }));
      }
      if (c.tipo === 'frontal' || c.tipo === 'corte' || c.tipo === 'planta' || c.tipo === 'iso' || c.tipo === 'armacao') {
        // isométrico sem escala: a projeção isométrica encurta as medidas (0,82), então não há "1:50" verdadeiro —
        // desenha-se na letra de 1:50 e a folha encaixa no tamanho pedido
        const escala = item.escala ?? 50;
        // o que o projetista fez nas anotações deste desenho entra na chave: arrastou, é outro desenho
        const { chamadas, anotacoes, cotas, textos, etiquetas, graficos } = item;
        const editado = JSON.stringify({ chamadas, anotacoes, cotas, textos, etiquetas, graficos });
        return vetor(`${JSON.stringify(c)}|${escala}|${prefixo}|${leg}|${vet}|${editado}`, () => ({
          tipo: 'vetor',
          vista: vistaParaPrancha(modelo, c, escala, prefixo, { legendaDeCores: leg, hachuraVetorial: vet, chamadas, anotacoes, cotas, textos, etiquetas, graficos }),
        }));
      }
      if (c.tipo === 'tabela') {
        // sem guardar: a tabela é pouca linha, e a figura que chega muda o desenho
        const q = quantitativo();
        if (!q) return null;
        return { tipo: 'papel', vista: desenharTabela(tabelaParaFolha(q, c.id), item.titulo.trim() || TITULO_DA_TABELA[c.id], figura) };
      }
      return null;
    },
    tituloAutomatico: (item) => {
      const c = item.conteudo;
      // a vista com nome dado pelo projetista ("Corte A") tem o nome de título, como no Revit
      if (item.nomeDaVista && nomeDado(item.nomeDaVista, c.tipo)) return item.nomeDaVista;
      switch (c.tipo) {
        case 'frontal':
          return 'Vista frontal';
        case 'corte': {
          if (!modelo) return 'Corte';
          const cortes = cortesPadrao(modelo);
          const x = c.x ?? cortes[0]?.x;
          const achado = x === undefined ? undefined : cortes.find((q) => Math.abs(q.x - x) <= modelo.familia.t / 2);
          if (achado?.rotulo.startsWith('Contraforte')) return `Corte no ${achado.rotulo.replace('Contraforte', 'contraforte')}`;
          return x === undefined ? 'Corte' : `Corte em x = ${metros(x)} m`;
        }
        case 'planta':
          return `Planta — ${c.fiada + 1}ª fiada`;
        case 'iso':
          return 'Isométrico';
        case 'armacao':
          return 'Armação da sapata';
        case '3d':
          return 'Perspectiva';
        case 'tabela':
          return TITULO_DA_TABELA[c.id];
        default:
          return '';
      }
    },
    esperarFotos: async () => {
      while (aCaminho.size) await Promise.allSettled([...aCaminho]);
    },
    descartar: () => {
      vivo = false;
      fotos.clear();
      ultima.clear();
      vetores.clear();
      figuras.clear();
    },
  };
}
