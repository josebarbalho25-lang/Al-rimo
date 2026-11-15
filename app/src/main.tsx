// ═══════════════════════════════════════════════════════════════════════════
//  main.tsx — a porta de entrada
// ---------------------------------------------------------------------------
//  A ordem importa:
//   1. o CSS, na ordem do A-PORT (tokens → base → layout → componentes);
//   2. as preferências da máquina aplicadas ANTES do primeiro quadro — senão o
//      app pisca no tema e no tamanho de fábrica e depois pula para o dele;
//   3. as peças das outras frentes ligadas nas tomadas (estado/ligacoes.ts);
//   4. o último projeto passa a ser lembrado;
//   5. a tela.
// ═══════════════════════════════════════════════════════════════════════════

import './estilo/tokens.css';
import './estilo/base.css';
import './estilo/layout.css';
import './estilo/componentes.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { aplicarPreferencias, preferenciasAtuais } from './estilo/preferenciasDaInterface';
import { lembrarUltimoProjeto } from './estado/store';
import { ligarOPrograma, ligarOsRecentes } from './estado/acoesDeArquivo';
import { ligarAsFrentes } from './integracao';

aplicarPreferencias(preferenciasAtuais());

// As peças das outras frentes entram nas tomadas antes do último projeto ser lembrado:
// o recálculo que ele dispara já sai com o muro, o veredito e as abas.
ligarAsFrentes();
lembrarUltimoProjeto();
// No programa instalado: o .alrimo do duplo clique entra DEPOIS do último muro lembrado (e pergunta, se ele tinha
// alteração não salva). No navegador, nada.
ligarOPrograma();
// Os Recentes do Início: a lista guardada (no perfil do programa, ou no navegador com a alça de cada arquivo).
ligarOsRecentes();

const raiz = document.getElementById('raiz');
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
