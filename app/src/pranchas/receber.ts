/*
  O OUVIDO DA PRANCHA — o "Enviar para a prancha" do 3D (e das vistas 2D) publica no canal (envio.ts); aqui o pedido
  vira desenho na folha ativa. Fica ligado o tempo todo (integracao.tsx), não só com a aba Pranchas aberta: quem
  envia do 3D está no 3D. A barra de estado diz para qual folha foi.
*/
import { useApp } from '@/estado/store';
import { itemDaTabela, porNaFolha, porVistaNaFolha } from './acoes';
import { ouvirEnvioParaPrancha, type PedidoParaPrancha } from './envio';
import { usePranchasUi } from './ui';
import { acharVista, novaVista3d, ondeEstaAVista } from './vistas';

const folhaN = (n: number) => `folha ${String(n).padStart(2, '0')}`;

/**
 * O pedido vira desenho na folha ativa. A vista da aba vai UMA vez (como no Revit, uma vista mora numa folha só):
 * já colocada, a barra diz onde ela está e nada muda — outra visualização é "Duplicar" na aba. O 3D enviado vira uma
 * vista nova ("3D", "3D (2)"…) com a câmera daquela hora: fica na lista para voltar se sair da folha.
 */
export function receberNaPrancha(pedido: PedidoParaPrancha): void {
  const app = useApp.getState();
  const ui = usePranchasUi.getState();
  let r: ReturnType<typeof porNaFolha>;
  if (pedido.tipo === 'vista') {
    const vista = acharVista(app.pranchas, pedido.id);
    if (!vista) return;
    const ja = ondeEstaAVista(app.pranchas, vista.id);
    if (ja) {
      app.dizer(`${vista.nome} já está na ${folhaN(ja.numero)}`);
      return;
    }
    r = porVistaNaFolha(app.pranchas, ui.ativa, vista);
  } else if (pedido.tipo === '3d') {
    const nova = novaVista3d(app.pranchas, { tipo: '3d', camera: pedido.camera, proporcao: pedido.proporcao });
    r = porVistaNaFolha(nova.pranchas, ui.ativa, nova.vista);
  } else {
    r = porNaFolha(app.pranchas, ui.ativa, (folha) => itemDaTabela(folha, pedido.id));
  }
  app.mudarPranchas(() => r.pranchas);
  ui.definirAtiva(r.folha);
  const n = r.pranchas.folhas.findIndex((f) => f.id === r.folha) + 1;
  app.dizer(`Enviado para a ${folhaN(n)}`);
}

/** Liga o ouvido (uma vez, na partida do app). Devolve o desligador. */
export function ligarEnvioParaPrancha(): () => void {
  return ouvirEnvioParaPrancha(receberNaPrancha);
}
