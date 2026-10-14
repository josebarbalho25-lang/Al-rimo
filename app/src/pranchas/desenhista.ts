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
    · 3D no Realista → foto (textura não vira linha).
*/
import type { Modelo } from '@/modelo/tipos';
import { refazerFoto } from '@/visor/fotoRefeita';
import { vista3dParaPrancha, vistaParaPrancha } from '@/desenhos/paraPrancha';
import type { ItemDesenhado } from './folha';
import type { ItemDaFolha } from './tipos';

export interface Desenhista {
  desenhar: (item: ItemDaFolha, prefixo: string) => ItemDesenhado | null;
  /** Solta o que ficou guardado (troca de muro). */
  descartar: () => void;
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

export function criarDesenhista(modelo: Modelo | null, aoMudar: () => void = () => {}): Desenhista {
  const fotos = new Map<string, { dataUrl: string; proporcao: number } | 'pedida' | 'falhou'>();
  // a última foto pronta de cada ponto de vista: ao redimensionar, a folha mostra a anterior enquanto a nova sai
  const ultima = new Map<string, { dataUrl: string; proporcao: number }>();
  let vivo = true;

  const foto3d = (item: ItemDaFolha): ItemDesenhado | null => {
    if (!modelo || item.conteudo.tipo !== '3d') return null;
    const { camera, proporcao } = item.conteudo;
    // a foto não muda com a posição nem com o tamanho na folha até a resolução pedir outra
    const [w, h] = tamanhoDaFoto(item.largura ?? 160, proporcao);
    const ponto = JSON.stringify(camera);
    const chave = `${ponto}|${w}x${h}`;
    const tem = fotos.get(chave);
    const imagem = (f: { dataUrl: string; proporcao: number }): ItemDesenhado => ({ tipo: 'imagem', dataUrl: f.dataUrl, arquivo: `foto-${item.id}.png`, proporcao: f.proporcao });
    if (tem && tem !== 'pedida' && tem !== 'falhou') return imagem(tem);
    const anterior = ultima.get(ponto);
    if (tem === 'pedida' || tem === 'falhou') return anterior ? imagem(anterior) : null;
    fotos.set(chave, 'pedida');
    refazerFoto(modelo, camera, w, h, { papel: true }).then(
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

  // vetor guardado por pedido + escala + prefixo (o prefixo entra: os ids dos padrões vão no desenho)
  const vetores = new Map<string, ItemDesenhado | null>();
  const vetor = (chave: string, fazer: () => ItemDesenhado | null): ItemDesenhado | null => {
    if (!vetores.has(chave)) {
      let d: ItemDesenhado | null = null;
      try {
        d = fazer();
      } catch {
        // muro que a vista não sabe desenhar: o lugar fica marcado, a folha segue
        d = null;
      }
      vetores.set(chave, d);
    }
    return vetores.get(chave) ?? null;
  };

  return {
    desenhar: (item, prefixo) => {
      if (!modelo) return null;
      const c = item.conteudo;
      if (c.tipo === '3d') {
        if (c.camera.estilo === 'realista') return foto3d(item);
        const largura = Math.round(item.largura ?? 160);
        return vetor(`3d|${JSON.stringify(c.camera)}|${largura}|${prefixo}`, () => ({ tipo: 'vetor', vista: vista3dParaPrancha(modelo, c.camera, largura, prefixo) }));
      }
      if (c.tipo === 'frontal' || c.tipo === 'corte' || c.tipo === 'planta' || c.tipo === 'iso') {
        const escala = item.escala ?? 50;
        return vetor(`${JSON.stringify(c)}|${escala}|${prefixo}`, () => ({ tipo: 'vetor', vista: vistaParaPrancha(modelo, c, escala, prefixo) }));
      }
      return null;
    },
    descartar: () => {
      vivo = false;
      fotos.clear();
      ultima.clear();
      vetores.clear();
    },
  };
}
