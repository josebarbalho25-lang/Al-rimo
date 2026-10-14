// ═══════════════════════════════════════════════════════════════════════════
//  visor/BancadaDaFoto.tsx — bancada da foto refeita (só desenvolvimento)
// ---------------------------------------------------------------------------
//  `npm run dev` e abrir /bancada/foto.html. À esquerda, o visor de verdade
//  com o muro de exemplo; "Enviar para a prancha" (o botão novo da barra)
//  manda a foto para cá, e à direita aparecem a foto ENVIADA e a REFEITA fora
//  da tela pelo ponto de vista guardado (`refazerFoto`), com a diferença
//  ponto a ponto. Mudar o comprimento ou o tipo do muro refaz a foto do mesmo
//  ponto de vista (a prancha viva); "Tamanho" refaz em outro tamanho de foto
//  (o enquadramento tem de ser o mesmo).
//
//  Não entra no app (o build só leva o index.html). A store é a do app, com
//  o muro de exemplo carregado; nada é gravado (o lembrete do último projeto
//  não é ligado aqui).
// ═══════════════════════════════════════════════════════════════════════════

import '../estilo/tokens.css';
import '../estilo/base.css';
import '../estilo/layout.css';
import '../estilo/componentes.css';

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { projetoExemplo } from '@/estado/projeto';
import { useApp } from '@/estado/store';
import { gerarModelo } from '@/modulacao';
import { ouvirEnvioParaPrancha, type PedidoParaPrancha } from '@/pranchas/envio';
import { refazerFoto } from './fotoRefeita';
import { Visor3D } from './Visor3D';

type PedidoDo3d = Extract<PedidoParaPrancha, { tipo: '3d' }>;

const carregarImagem = (url: string) =>
  new Promise<HTMLImageElement>((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error('imagem ilegível'));
    img.src = url;
  });

/** Diferença ponto a ponto entre duas fotos do mesmo tamanho: % de pontos com algum canal > 8/255 e a média. */
async function diferenca(a: string, b: string): Promise<string> {
  const [ia, ib] = await Promise.all([carregarImagem(a), carregarImagem(b)]);
  if (ia.naturalWidth !== ib.naturalWidth || ia.naturalHeight !== ib.naturalHeight) return `tamanhos diferentes (${ia.naturalWidth}×${ia.naturalHeight} × ${ib.naturalWidth}×${ib.naturalHeight})`;
  const w = ia.naturalWidth;
  const h = ia.naturalHeight;
  const ler = (img: HTMLImageElement) => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d')!;
    g.drawImage(img, 0, 0);
    return g.getImageData(0, 0, w, h).data;
  };
  const da = ler(ia);
  const db = ler(ib);
  let fora = 0;
  let soma = 0;
  for (let i = 0; i < da.length; i += 4) {
    const d = Math.max(Math.abs(da[i]! - db[i]!), Math.abs(da[i + 1]! - db[i + 1]!), Math.abs(da[i + 2]! - db[i + 2]!));
    soma += d;
    if (d > 8) fora++;
  }
  const n = da.length / 4;
  return `${((100 * fora) / n).toFixed(2)} % dos pontos diferem (> 8/255); média ${(soma / n).toFixed(2)}/255`;
}

function Bancada() {
  const modelo = useApp((s) => s.modelo);
  const [pedido, setPedido] = useState<PedidoDo3d | null>(null);
  const [tamanho, setTamanho] = useState<[number, number] | null>(null);
  const [escala, setEscala] = useState(1);
  const [refeita, setRefeita] = useState<{ url: string; ms: number; w: number; h: number } | null>(null);
  const [dif, setDif] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [comprimento, setComprimento] = useState(6);
  const [tipo, setTipo] = useState<'Balanço' | 'Contrafortes'>('Balanço');

  useEffect(
    () =>
      ouvirEnvioParaPrancha((p) => {
        if (p.tipo === '3d') setPedido(p);
      }),
    [],
  );

  useEffect(() => {
    if (!pedido) return;
    let vivo = true;
    void carregarImagem(pedido.dataUrl).then((img) => vivo && setTamanho([img.naturalWidth, img.naturalHeight]));
    return () => {
      vivo = false;
    };
  }, [pedido]);

  // A prancha viva: a foto se refaz quando chega pedido novo, quando o muro muda e quando o tamanho pedido muda.
  useEffect(() => {
    if (!pedido || !tamanho || !modelo) return;
    let vivo = true;
    const w = Math.round(tamanho[0] * escala);
    const h = Math.round(tamanho[1] * escala);
    const t0 = performance.now();
    setErro(null);
    refazerFoto(modelo, pedido.camera, w, h).then(
      async (url) => {
        if (!vivo) return;
        const img = await carregarImagem(url);
        setRefeita({ url, ms: performance.now() - t0, w: img.naturalWidth, h: img.naturalHeight });
      },
      (e: unknown) => vivo && setErro(String(e)),
    );
    return () => {
      vivo = false;
    };
  }, [pedido, tamanho, modelo, escala]);

  useEffect(() => {
    if (!pedido || !refeita) return setDif('');
    let vivo = true;
    void diferenca(pedido.dataUrl, refeita.url).then((t) => vivo && setDif(t));
    return () => {
      vivo = false;
    };
  }, [pedido, refeita]);

  const mudarComprimento = (v: number) => {
    setComprimento(v);
    if (Number.isFinite(v) && v > 0) useApp.getState().definir('L_total', v);
  };
  const mudarTipo = (t: 'Balanço' | 'Contrafortes') => {
    setTipo(t);
    useApp.getState().definir('Tipo_muro', t);
  };

  const quadro: React.CSSProperties = { border: '1px solid var(--line-strong, #3a3a45)', background: 'var(--surface, #17171b)', minHeight: 120 };
  const img: React.CSSProperties = { display: 'block', width: '100%', height: 'auto' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '760px 1fr', gap: 16, padding: 16, height: '100vh', boxSizing: 'border-box', color: 'var(--ink, #e8e8ee)', background: 'var(--bg, #121216)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ width: 760, height: 480 }} data-bancada="visor">
          {modelo ? <Visor3D modelo={modelo} /> : 'sem muro'}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <label>
            Comprimento (m){' '}
            <input type="number" step={0.4} min={1} value={comprimento} onChange={(e) => mudarComprimento(Number(e.target.value))} style={{ width: 70 }} data-bancada="comprimento" />
          </label>
          <label>
            Tipo{' '}
            <select value={tipo} onChange={(e) => mudarTipo(e.target.value as 'Balanço' | 'Contrafortes')} data-bancada="tipo">
              <option>Balanço</option>
              <option>Contrafortes</option>
            </select>
          </label>
          <label>
            Tamanho da refeita{' '}
            <select value={escala} onChange={(e) => setEscala(Number(e.target.value))} data-bancada="escala">
              <option value={0.5}>½ × a enviada</option>
              <option value={1}>= a enviada</option>
              <option value={2}>2 × a enviada</option>
            </select>
          </label>
        </div>
        {pedido && <pre style={{ fontSize: 11, margin: 0, whiteSpace: 'pre-wrap' }} data-bancada="camera">{JSON.stringify({ ...pedido.camera, proporcao: pedido.proporcao }, null, 1)}</pre>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start', overflow: 'auto' }}>
        <div>
          <div>Enviada {tamanho && `(${tamanho[0]}×${tamanho[1]})`}</div>
          <div style={quadro}>{pedido && <img src={pedido.dataUrl} style={img} alt="" data-bancada="enviada" />}</div>
        </div>
        <div>
          <div>Refeita {refeita && `(${refeita.w}×${refeita.h}, ${refeita.ms.toFixed(0)} ms)`}</div>
          <div style={quadro}>{refeita && <img src={refeita.url} style={img} alt="" data-bancada="refeita" />}</div>
        </div>
        <div style={{ gridColumn: '1 / 3' }} data-bancada="diferenca">
          {erro ? `erro: ${erro}` : dif}
        </div>
      </div>
    </div>
  );
}

// O muro de exemplo, com a modulação ligada (no app quem liga é `integracao.tsx`).
useApp.getState().ligar({ gerador: gerarModelo });
useApp.getState().carregar(projetoExemplo(), null);

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <Bancada />
    </StrictMode>,
  );
}
