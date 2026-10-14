// ═══════════════════════════════════════════════════════════════════════════
//  visor/materiaisDoEstilo.ts — o material de cada acabamento, em cada estilo
// ---------------------------------------------------------------------------
//  A GEOMETRIA É UMA SÓ (o InstancedMesh de cada lote); trocar de estilo é só
//  trocar o material dos lotes. Nada se remonta: 5.000 blocos mudam de cara no
//  mesmo quadro, e seleção, Raio-X e corte continuam valendo porque moram na
//  cor da instância e nos planos de cada material, não na malha.
//
//    · Cores — Lambert (recebe a luz chapada do visor: três tons nas três
//      faces da isométrica, que é o que separa as faces de um muro de cor só);
//    · Opaco — básico, SEM luz: o branco sai branco (lição do A-PORT);
//    · Realista — o padrão do three (rugosidade e metal) com a PELE do
//      material projetada das três direções do mundo (triplanar, como o
//      `materialRealista.ts` do A-PORT), e com sombra.
//
//  ⚠️ COR FINAL = MATERIAL (branco) × COR DA INSTÂNCIA × PELE. A cor da
//  instância continua sendo a cor do estilo (ou o azul da seleção); a pele só
//  varia em torno de 1. Por isso a seleção aparece igual nos três estilos.
// ═══════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import type { EstiloVisual } from './estiloVisual';
import { bytesDaPele, campoDaPele, type Pele } from './geracaoDasPeles';
import type { Acabamento } from './lotes';

/*
  QUEM GANHA QUANDO DUAS FACES MORAM NO MESMO LUGAR (recuo de profundidade, maior = mais para trás).
  O muro tem faces coincidentes de propósito: o graute enche o furo do bloco (a parede do furo e a casca do
  graute são a mesma superfície), a manta embrulha a brita, o aterro senta no talão da sapata. De fora não se
  vê nada disso; mas o CORTE abre os sólidos e mostra o miolo, e aí as duas faces brigavam pixel a pixel
  (listras de "chuva" no graute, vistas na bancada com o muro da aula 12.3). Com a ordem fixada:
    · graute à frente do bloco — o corte de um furo cheio lê como graute, não como furo vazio;
    · brita e areia à frente da manta — o corte do dreno lê como brita e areia;
    · bloco e sapata recuados 1 — o traço (que não recua) desenha por cima sem piscar (lição do A-PORT:
      o recuo é no sólido, nunca na linha);
    · terreno o mais recuado — é só referência, nunca tinge a sapata em que encosta;
    · barbacã puxado para a frente — a ponta do tubo fica rente à face do bloco.
*/
export const RECUO: Record<Acabamento, number> = {
  tubo: -2,
  graute: 0,
  brita: 0,
  areia: 0,
  alvenaria: 1,
  concreto: 1,
  manta: 1,
  terreno: 2,
};

/** A pele de cada acabamento no Realista (sem pele: cor lisa — a manta e o tubo de PVC são lisos de fato). */
const PELE: Partial<Record<Acabamento, Pele>> = {
  alvenaria: 'bloco',
  graute: 'concreto',
  concreto: 'concreto',
  brita: 'solo',
  areia: 'solo',
  terreno: 'solo',
};

/**
 * O lado do ladrilho de cada pele, em METROS: o poro do bloco tem o tamanho de
 * um poro em qualquer zoom, e o solo não vira papel de parede repetido.
 */
const LADRILHO_M: Record<Pele, number> = { bloco: 0.5, concreto: 1.0, solo: 1.2 };

/** Quanto a pele afasta a cor da média (0 = lisa). O graute, por dentro do furo, é mais fechado que o bloco. */
const CONTRASTE: Record<Pele, number> = { bloco: 0.8, concreto: 0.45, solo: 0.7 };

/** Rugosidade (0 espelho, 1 fosco). Concreto e solo são foscos; a manta geotêxtil e o PVC brilham um pouco. */
const RUGOSIDADE: Record<Acabamento, number> = {
  alvenaria: 0.95,
  graute: 0.9,
  concreto: 0.85,
  brita: 0.9,
  areia: 0.95,
  manta: 0.75,
  tubo: 0.45,
  terreno: 1,
};

/**
 * Bloco a bloco o tom muda um pouco (lote, cura, umidade): é o que faz a
 * parede parecer feita de peças e não pintada. ±5 % no bloco; a sapata é uma
 * peça só, e o solo já varia pela pele.
 */
const VARIACAO_DO_TOM: Partial<Record<Acabamento, number>> = { alvenaria: 0.1, graute: 0.04 };

/** Lado da textura da pele, em pontos. */
const LADO_DA_PELE = 512;

/** Os bytes de cada pele: a parte cara (512² leva ~0,1 s), feita uma vez por sessão e repartida por toda textura. */
const bytes = new Map<Pele, Uint8Array>();
const bytesDe = (pele: Pele): Uint8Array => {
  let b = bytes.get(pele);
  if (!b) bytes.set(pele, (b = bytesDaPele(campoDaPele(pele, LADO_DA_PELE))));
  return b;
};

function novaTextura(pele: Pele): THREE.DataTexture {
  const t = new THREE.DataTexture(bytesDe(pele), LADO_DA_PELE, LADO_DA_PELE, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // Mipmap: de longe a pele vira a média (o tom do material), não chiado que pisca ao girar.
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  // É um modulador, não uma cor: lido cru (sem conversão de sRGB).
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** De onde o material do Realista tira a textura de cada pele. */
export type FonteDasPeles = (pele: Pele) => THREE.Texture;

const texturas = new Map<Pele, THREE.DataTexture>();

/**
 * A textura de uma pele, gerada na PRIMEIRA vez que o Realista é escolhido e
 * guardada pela sessão: mil blocos leem o mesmo mapa. É a fonte do visor.
 */
export function texturaDaPele(pele: Pele): THREE.DataTexture {
  let t = texturas.get(pele);
  if (!t) texturas.set(pele, (t = novaTextura(pele)));
  return t;
}

/*
  ⚠️ A FOTO REFEITA (fotoRefeita.ts) NÃO PODE USAR AS TEXTURAS DO VISOR. Cada renderizador do three que usa uma
  textura pendura nela um ouvinte de descarte, e só o tira quando a TEXTURA é descartada — descartar o
  renderizador não tira. A textura do visor vive a sessão inteira: cada foto refeita deixaria pendurado nela o
  renderizador morto (com tudo o que ele segura), e a prancha viva refaz a foto a cada conta. Por isso a foto
  ganha texturas próprias, feitas dos MESMOS bytes (o que custa é gerar os bytes, não a textura), e as descarta
  no fim.
*/
/** Texturas de pele só de quem pede (a foto refeita), com o descarte junto. */
export function pelesProprias(): { fonte: FonteDasPeles; dispose(): void } {
  const minhas = new Map<Pele, THREE.DataTexture>();
  return {
    fonte: (pele) => {
      let t = minhas.get(pele);
      if (!t) minhas.set(pele, (t = novaTextura(pele)));
      return t;
    },
    dispose: () => {
      for (const t of minhas.values()) t.dispose();
      minhas.clear();
    },
  };
}

const VERTICE_PREFIXO = /* glsl */ `
varying vec3 vPosMundo;
varying vec3 vSorteio;
`;

/*
  ⚠️ A POSIÇÃO NO MUNDO PASSA PELA MATRIZ DA INSTÂNCIA: o molde está no
  sistema da peça; sem ela todos os blocos leriam a pele no mesmo lugar.
  E cada instância ganha um SORTEIO (da sua posição): desloca a pele e
  varia o tom — sem ele a textura correria contínua de um bloco para o
  vizinho, como se a parede fosse uma placa só com riscos de junta.
*/
const VERTICE_MUNDO = /* glsl */ `
#include <begin_vertex>
{
  vec4 pMundo = vec4(transformed, 1.0);
  vSorteio = vec3(0.5);
  #ifdef USE_INSTANCING
    pMundo = instanceMatrix * pMundo;
    vec3 t = instanceMatrix[3].xyz;
    vSorteio = fract(sin(vec3(dot(t, vec3(12.9898, 78.233, 37.719)), dot(t, vec3(39.346, 11.135, 83.155)), dot(t, vec3(73.156, 52.235, 9.151)))) * 43758.5453);
  #endif
  vPosMundo = (modelMatrix * pMundo).xyz;
}
`;

const FRAGMENTO_PREFIXO = /* glsl */ `
uniform sampler2D mapaDaPele;
uniform float metrosPorLadrilho;
uniform float contrasteDaPele;
uniform float variacaoDoTom;
varying vec3 vPosMundo;
varying vec3 vSorteio;
`;

/*
  A pele projetada das três direções do mundo, pesada pela normal da FACE
  (tirada da variação da posição no pixel, como no A-PORT: exata em qualquer
  malha, e a quina do bloco não estica a textura). O bloco é todo de faces
  alinhadas aos eixos, então na prática cada face lê uma projeção só.
*/
const FRAGMENTO_COR = /* glsl */ `
vec3 nVistaPele = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
vec3 nMundoPele = normalize(nVistaPele * mat3(viewMatrix));
vec3 pesoPele = abs(nMundoPele);
pesoPele *= pesoPele;
pesoPele *= pesoPele;
pesoPele /= (pesoPele.x + pesoPele.y + pesoPele.z + 1e-5);
vec3 qPele = vPosMundo / metrosPorLadrilho + vSorteio * 7.0;
float pele = texture2D(mapaDaPele, qPele.yz).r * pesoPele.x
           + texture2D(mapaDaPele, qPele.xz).r * pesoPele.y
           + texture2D(mapaDaPele, qPele.xy).r * pesoPele.z;
diffuseColor.rgb *= (1.0 - contrasteDaPele + 2.0 * contrasteDaPele * pele) * (1.0 + variacaoDoTom * (vSorteio.x - 0.5));
`;

// O poro (escuro) é mais áspero que a face lisa entre poros: a luz rasante acende a face e apaga o poro.
const FRAGMENTO_RUGOSIDADE = /* glsl */ `
float roughnessFactor = clamp(roughness * (1.2 - 0.4 * pele), 0.0, 1.0);
`;

function materialRealista(a: Acabamento, peles: FonteDasPeles): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: RUGOSIDADE[a],
    metalness: 0,
    side: THREE.DoubleSide,
    polygonOffset: RECUO[a] !== 0,
    polygonOffsetFactor: RECUO[a],
    polygonOffsetUnits: RECUO[a],
    // O pedaço que o corte apagou também não faz sombra.
    clipShadows: true,
  });
  const pele = PELE[a];
  if (!pele) return m;
  const uniformes = {
    mapaDaPele: { value: peles(pele) },
    metrosPorLadrilho: { value: LADRILHO_M[pele] },
    contrasteDaPele: { value: CONTRASTE[pele] },
    variacaoDoTom: { value: VARIACAO_DO_TOM[a] ?? 0 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniformes);
    shader.vertexShader = VERTICE_PREFIXO + shader.vertexShader.replace('#include <begin_vertex>', VERTICE_MUNDO);
    shader.fragmentShader =
      FRAGMENTO_PREFIXO +
      shader.fragmentShader.replace('#include <map_fragment>', FRAGMENTO_COR).replace('#include <roughnessmap_fragment>', FRAGMENTO_RUGOSIDADE);
  };
  // O código do shader é o mesmo para todas as peles (o que muda são os uniformes, que são de cada material):
  // uma chave só, um programa só para o bloco, o graute, a sapata e o solo.
  m.customProgramCacheKey = () => 'alrimo-realista-pele-v1';
  return m;
}

/** O material de um acabamento num estilo. Branco: a cor vem da instância. `peles`: só a foto refeita troca. */
export function materialDoAcabamento(
  estilo: EstiloVisual,
  a: Acabamento,
  peles: FonteDasPeles = texturaDaPele,
): THREE.MeshLambertMaterial | THREE.MeshBasicMaterial | THREE.MeshStandardMaterial {
  if (estilo === 'realista') return materialRealista(a, peles);
  const base = {
    color: 0xffffff,
    // Dupla face: com o corte, o miolo do bloco aberto aparece em vez de sumir.
    side: THREE.DoubleSide,
    polygonOffset: RECUO[a] !== 0,
    polygonOffsetFactor: RECUO[a],
    polygonOffsetUnits: RECUO[a],
  };
  return estilo === 'opaco' ? new THREE.MeshBasicMaterial(base) : new THREE.MeshLambertMaterial(base);
}

/**
 * O material do aço (as barras de um Ø juntas numa malha, cor por vértice).
 * No Realista é aço de verdade: um pouco metálico e meio liso, que a luz
 * rasante faz brilhar na nervura.
 */
export function materialDoAco(estilo: EstiloVisual): THREE.MeshLambertMaterial | THREE.MeshBasicMaterial | THREE.MeshStandardMaterial {
  if (estilo === 'realista') return new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.55, roughness: 0.5, clipShadows: true });
  if (estilo === 'opaco') return new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  return new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
}
