/*
  ENTRADAS PRÓPRIAS DO MODELO — o que o 3D, os desenhos e o quantitativo precisam e a conta não usa.

  Ficam no app, não na planilha: na planilha elas não fariam nada (não há 3D no Excel) e virariam campo
  morto. O formulário junta estas com as da planilha, pela seção. Mesmo formato (EntradaMeta), mesma regra
  de figura: toda entrada tem o botão da imagem de referência.

  Decisões do Jose (08/10/2026): contraforte nas DUAS pontas; junta de controle configurável (0 = sem);
  cinta (canaleta) no topo nos dois tipos de muro, com a canaleta passando direto pelo contraforte;
  drenagem no 3D e no quantitativo, toda configurável ("cada projetista se vira com isso").
*/
import type { EntradaMeta } from '@/motor/tipos';

const MODELO = 'Modelo (3D, desenhos e quantitativo)';
const DRENAGEM = 'Drenagem';

export const ENTRADAS_DO_MODELO: EntradaMeta[] = [
  { nome: 'L_total', rotulo: 'Comprimento do muro', padrao: 6, unidade: 'm', nota: 'Arredonda ao módulo do bloco; com contrafortes, a um número inteiro de vãos (contraforte nas duas pontas).', figura: 'Fig. 16', opcoes: null, formato: '0.00', secao: MODELO, ref: 'modelo!L_total' },
  { nome: 'junta_cada', rotulo: 'Junta de controle a cada', padrao: 0, unidade: 'm', nota: '0 = sem junta. Com contrafortes, a junta fica entre dois contrafortes encostados; muro e sapata cortados juntos.', figura: 'Fig. 16', opcoes: null, formato: '0.00', secao: MODELO, ref: 'modelo!junta_cada' },
  { nome: 'cinta_topo', rotulo: 'Cinta no topo (canaleta)', padrao: 'Sim', unidade: '', nota: 'Última fiada em canaleta grauteada com barra horizontal.', figura: 'Fig. 5', opcoes: ['Sim', 'Não'], formato: 'General', secao: MODELO, ref: 'modelo!cinta_topo' },
  { nome: 'phi_cinta', rotulo: 'Ø da barra da cinta', padrao: 10, unidade: 'mm', nota: '', figura: 'Fig. 5', opcoes: [6.3, 8, 10, 12.5, 16], formato: '0.0', secao: MODELO, ref: 'modelo!phi_cinta' },
  { nome: 'traspasse_dir', rotulo: 'Traspasse espera × barra — opcional', padrao: null, unidade: 'cm', nota: 'Em branco = ℓb adotado na conta da ancoragem.', figura: 'Fig. 9', opcoes: null, formato: '0', secao: MODELO, ref: 'modelo!traspasse_dir' },

  { nome: 'barbaca_on', rotulo: 'Barbacãs', padrao: 'Sim', unidade: '', nota: '', figura: 'Fig. 17', opcoes: ['Sim', 'Não'], formato: 'General', secao: DRENAGEM, ref: 'modelo!barbaca_on' },
  { nome: 'barbaca_phi', rotulo: 'Ø do barbacã', padrao: 50, unidade: 'mm', nota: '', figura: 'Fig. 17', opcoes: null, formato: '0', secao: DRENAGEM, ref: 'modelo!barbaca_phi' },
  { nome: 'barbaca_s', rotulo: 'Espaçamento dos barbacãs', padrao: 1.5, unidade: 'm', nota: 'Na 1ª fiada, em célula sem graute.', figura: 'Fig. 17', opcoes: null, formato: '0.00', secao: DRENAGEM, ref: 'modelo!barbaca_s' },
  { nome: 'dreno_on', rotulo: 'Dreno no tardoz (brita + manta)', padrao: 'Sim', unidade: '', nota: '', figura: 'Fig. 17', opcoes: ['Sim', 'Não'], formato: 'General', secao: DRENAGEM, ref: 'modelo!dreno_on' },
  { nome: 'dreno_esp', rotulo: 'Espessura do dreno', padrao: 0.2, unidade: 'm', nota: '', figura: 'Fig. 17', opcoes: null, formato: '0.00', secao: DRENAGEM, ref: 'modelo!dreno_esp' },
  { nome: 'dreno_folga', rotulo: 'Dreno termina abaixo do topo do solo', padrao: 0.3, unidade: 'm', nota: '', figura: 'Fig. 17', opcoes: null, formato: '0.00', secao: DRENAGEM, ref: 'modelo!dreno_folga' },
  { nome: 'imper_on', rotulo: 'Impermeabilização do tardoz', padrao: 'Sim', unidade: '', nota: 'Só no quantitativo (área).', figura: 'Fig. 17', opcoes: ['Sim', 'Não'], formato: 'General', secao: DRENAGEM, ref: 'modelo!imper_on' },
];
