/*
  O OUVIDO DA PRANCHA — o "Enviar para a prancha" do 3D (e das vistas 2D) publica no canal (envio.ts); aqui o pedido
  vira desenho na folha ativa. Fica ligado o tempo todo (integracao.tsx), não só com a aba Pranchas aberta: quem
  envia do 3D está no 3D. A barra de estado diz para qual folha foi.
*/
import { useApp } from '@/estado/store';
import { itemDaVista, itemDo3d, porNaFolha } from './acoes';
import { ouvirEnvioParaPrancha, type PedidoParaPrancha } from './envio';
import { usePranchasUi } from './ui';

export function receberNaPrancha(pedido: PedidoParaPrancha): void {
  const app = useApp.getState();
  const ui = usePranchasUi.getState();
  const r = porNaFolha(app.pranchas, ui.ativa, (folha) =>
    pedido.tipo === '3d' ? itemDo3d(folha, pedido.camera, pedido.proporcao) : itemDaVista(folha, pedido.pedido),
  );
  app.mudarPranchas(() => r.pranchas);
  ui.definirAtiva(r.folha);
  const n = r.pranchas.folhas.findIndex((f) => f.id === r.folha) + 1;
  app.dizer(`Enviado para a folha ${String(n).padStart(2, '0')}`);
}

/** Liga o ouvido (uma vez, na partida do app). Devolve o desligador. */
export function ligarEnvioParaPrancha(): () => void {
  return ouvirEnvioParaPrancha(receberNaPrancha);
}
