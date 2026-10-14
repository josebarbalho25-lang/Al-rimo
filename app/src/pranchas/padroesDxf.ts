/*
  PADRÕES DE HACHURA DO DXF — os padrões do próprio CAD (acadiso.pat), para o cadista editar a hachura com as
  ferramentas de sempre: o nome é o do CAD (EARTH, AR-CONC, AR-SAND, GRAVEL, ANSI31), e as linhas de definição vão
  junto em cada HATCH (o DXF exige; quem abre não precisa ter o .pat).

  Por que a tabela é nossa e não a da biblioteca de DXF (@tarikjabiri/dxf 2.9.0): a tabela dela está embaralhada —
  o "EARTH" de lá é o DOTS (pontinhos), o "AR_SAND" é tijolo, e os nomes vêm com sublinhado (AR_CONC), que o CAD não
  reconhece como o padrão dele. Conferido em 14/10 contra o ezdxf.

  Origem dos números: ezdxf 1.4.4, `ezdxf/tools/_iso_pattern.py` (MIT, Manfred Moitzi), a versão ISO (métrica, a do
  $MEASUREMENT = 1) dos padrões do AutoCAD/BricsCAD. Formato DXF, já pronto para os grupos do HATCH:
    [ângulo (53), ponto base (43, 44), deslocamento (45, 46), traço/espaço (49…)]
  O deslocamento já vem GIRADO pelo ângulo da linha (é como o DXF guarda; no .pat ele vem no sistema da linha).
  Traço > 0, espaço < 0, ponto = 0. Lista vazia = linha contínua.

  ESCALA: o DXF é a folha em milímetros de papel (como plotado), então a escala de cada padrão é a que dá, no papel,
  o tamanho que o app desenha (desenhos/hachuras.ts e desenhos/prancha.ts, px de desenho ÷ PX_POR_MM = 4,4 px/mm).
  Mudou o tamanho lá, recalcular aqui. A conta de cada um está ao lado do número.
*/

import { PX_POR_MM, type PadraoHachura } from './tipos';

export type LinhaDoPadrao = [angulo: number, base: [number, number], deslocamento: [number, number], tracos: number[]];

export const PADROES_ISO: Record<'EARTH' | 'AR-CONC' | 'AR-SAND' | 'GRAVEL' | 'ANSI31', LinhaDoPadrao[]> = {
  'EARTH': [
    [0, [0, 0], [6.35, 6.35], [6.35, -6.35]],
    [0, [0, 2.38125], [6.35, 6.35], [6.35, -6.35]],
    [0, [0, 4.7625], [6.35, 6.35], [6.35, -6.35]],
    [90, [0.79375, 5.55625], [-6.35, 6.35], [6.35, -6.35]],
    [90, [3.175, 5.55625], [-6.35, 6.35], [6.35, -6.35]],
    [90, [5.55625, 5.55625], [-6.35, 6.35], [6.35, -6.35]],
  ],
  'AR-CONC': [
    [50, [0, 0], [182.184668996, -15.9390855389], [19.05, -209.55]],
    [355, [0, 0], [-35.243421425, 191.056845239], [15.24, -167.64058417]],
    [100.4514447, [15.182007, -1.3282535], [146.9412470904, 175.1177519122], [16.1900088, -178.0902446]],
    [46.1842, [0, 50.8], [271.0790408921, -42.0423279327], [28.575, -314.325]],
    [96.63555761, [22.5899, 47.2965], [237.4041340515, 247.4261245977], [24.28502314, -267.13560816]],
    [351.18415117, [0, 50.8], [237.404134065, 247.4261245855], [22.85996707, -251.45973192]],
    [21, [25.4, 38.1], [151.6143912691, -102.2651981871], [19.05, -209.55]],
    [326, [25.4, 38.1], [61.8020283476, 184.1879661223], [15.24, -167.64]],
    [71.451445, [38.0345326, 29.5779001], [213.4164192787, 81.9227688859], [16.1900088, -178.0899376]],
    [37.5, [0, 0], [3.0886032506, 84.5550388732], [0, -165.608, 0, -170.18, 0, -168.275]],
    [7.5, [0, 0], [66.8196625103, 100.1805748181], [0, -97.028, 0, -161.798, 0, -64.135]],
    [-32.5, [-56.642, 0], [135.5905951669, -5.7287439927], [0, -63.5, 0, -198.12, 0, -262.89]],
    [-42.5, [-82.042, 0], [148.129181386, 25.4264910333], [0, -82.55, 0, -131.572, 0, -186.69]],
  ],
  'AR-SAND': [
    [37.5, [0, 0], [-1.600031296, 48.9413237329], [0, -38.608, 0, -43.18, 0, -41.275]],
    [7.5, [0, 0], [44.9523283138, 71.6825100568], [0, -20.828, 0, -34.798, 0, -13.335]],
    [-32.5, [-31.242, 0], [79.0992370241, 0.1437184679], [0, -12.7, 0, -45.72, 0, -59.69]],
    [-42.5, [-31.242, 0], [76.3556452472, 22.2929323257], [0, -6.35, 0, -29.972, 0, -34.29]],
  ],
  'GRAVEL': [
    [228.0127875, [18.288, 25.4], [-203.200000016, -228.5999999858], [3.4172144, -338.3048363956]],
    [184.969741, [16.002, 22.86], [304.7999998794, 25.400001447], [5.8640472, -580.5404889352]],
    [132.5104471, [10.16, 22.352], [254.0000001073, -279.3999999025], [4.1348152, -409.347227941]],
    [267.273689, [0.254, 16.002], [25.4000000532, 507.9999999973], [5.3400452, -528.6643742574]],
    [292.83365418, [0, 10.668], [-127.0000000106, 304.7999999956], [5.236337, -518.3980774534]],
    [357.273689, [2.032, 5.842], [-507.9999999973, 25.4000000532], [5.3400452, -528.6643742574]],
    [37.69424047, [7.366, 5.588], [-330.1999999854, -254.000000019], [7.0619366, -699.1311531425]],
    [72.25532837, [12.954, 9.906], [177.8000000478, 558.7999999848], [6.6671952, -660.0525660191]],
    [121.42956562, [14.986, 16.256], [-203.2000000288, 330.1999999823], [5.35813, -530.4554569871]],
    [175.2363583, [12.192, 20.828], [279.399999996, -25.4000000439], [6.1171328, -299.7393695]],
    [222.3974378, [6.096, 21.336], [-304.7999999902, -279.4000000106], [7.9107792, -783.1677251218]],
    [138.81407483, [25.4, 15.748], [-177.7999999893, 152.4000000124], [2.7000454, -267.3056582434]],
    [171.4692344, [23.368, 17.526], [330.2000000089, -50.7999999424], [5.1368198, -508.5463899704]],
    [225, [18.288, 18.288], [0, -25.4], [3.5920934, -32.3289310843]],
    [203.19859051, [16.51, 21.336], [127.0000000035, 50.7999999911], [1.9344132, -191.5062236889]],
    [291.80140949, [14.732, 20.574], [-25.4000000053, 76.1999999982], [2.7356562, -134.0475299]],
    [30.96375653, [15.748, 18.034], [76.2000000019, 50.7999999972], [4.4431966, -143.6629815291]],
    [161.56505118, [19.558, 20.32], [50.8000000013, -25.3999999973], [3.2128714, -77.1089811683]],
    [16.389540334, [0, 20.574], [254, 76.2], [4.50088, -445.5882667254]],
    [70.34617594, [4.318, 21.844], [-101.6000000093, -279.3999999967], [3.7759894, -373.822156782]],
    [293.19859051, [19.558, 25.4], [-50.7999999911, 127.0000000036], [3.868801, -189.5718358889]],
    [343.61045967, [21.082, 21.844], [-254.0000000053, 76.1999999822], [4.50088, -445.5882667254]],
    [339.44395478, [0, 4.826], [-127, 50.8], [4.340352, -212.6773431311]],
    [294.7751406, [4.064, 3.302], [-127.0000001512, 279.3999999313], [3.6367212, -360.0359338072]],
    [66.80140949, [19.812, 0], [50.799999992, 127.0000000032], [3.868801, -189.5718358889]],
    [17.35402464, [21.336, 3.556], [-330.1999999934, -101.6000000213], [4.2578274, -421.523759802]],
    [69.44395478, [7.366, 0], [-50.8000000009, -126.9999999996], [2.170176, -214.8475191311]],
    [101.309932474, [18.288, 0], [-25.4, 101.6], [1.295146, -128.2199496453]],
    [165.963756532, [18.034, 1.27], [76.2, -25.4], [5.236337, -99.4905458907]],
    [186.00900596, [12.954, 2.54], [253.9999999987, 25.4000000133], [4.85267, -480.4136486334]],
    [303.69006753, [15.748, 15.748], [-25.4000000035, 50.7999999982], [3.6632388, -87.9177635968]],
    [353.15722659, [17.78, 12.7], [431.8000000027, -50.7999999774], [6.3955676, -633.1600906503]],
    [60.9453959, [24.13, 11.938], [-101.6000000028, -177.7999999984], [2.6150824, -258.8939231811]],
    [90, [25.4, 14.224], [-25.4, 25.4], [1.524, -23.876]],
    [120.25643716, [12.446, 3.302], [101.5999999876, -177.8000000071], [3.5286696, -349.339407732]],
    [48.0127875, [10.668, 6.35], [203.2000000168, 228.5999999851], [6.8344288, -334.8876219957]],
    [0, [15.24, 11.43], [25.4, 25.4], [6.604, -18.796]],
    [325.3048465, [21.844, 11.43], [254.0000000962, -177.7999998625], [4.0160956, -397.5931672414]],
    [254.0546041, [25.146, 9.144], [-25.3999999982, -101.6000000004], [3.6982908, -181.2165003877]],
    [207.64597536, [24.13, 5.588], [-482.6000000177, -253.9999999663], [6.021451, -596.1246442294]],
    [175.42607874, [18.796, 2.794], [-330.2, 25.4], [6.3702946, -630.6584645624]],
  ],
  'ANSI31': [
    [45, [0, 0], [-2.2450640303, 2.2450640303], []],
  ],
};

export interface PadraoNoDxf {
  /** Nome do padrão no CAD (o que o cadista vê no editor de hachura). */
  nome: keyof typeof PADROES_ISO | 'SOLID';
  /** Escala do padrão no papel (1 = o acadiso.pat como vem). */
  escala: number;
  /** Espessura do risco do padrão no papel, mm — a do traço que o app usa no ladrilho. */
  espessura: number;
}

const mm = (px: number): number => px / PX_POR_MM;

/**
 * O material do app → o padrão do CAD (o José escolheu os quatro primeiros no Revit dele, 14/10).
 *
 *  · terra → EARTH. A casa do trançado no app é 48 × 0,40 = 19,2 px = 4,36 mm de papel; no acadiso a casa é 6,35 mm
 *    (três riscos a 0, 3/8 e 3/4 da casa, igual ao app) → 4,36 / 6,35 = 0,687.
 *  · concreto → AR-CONC. O triângulo do app tem raio médio 2,2 × 1,7 = 3,74 px = 0,85 mm, lado √3 × 0,85 = 1,47 mm;
 *    os triângulos do AR-CONC têm lado médio ≈ 19,6 mm (dois de 16,8 e um de 25,2) → pelo tamanho, 0,075. Mas o app
 *    tem mais triângulos por área (22 num ladrilho de 31 mm = 0,023/mm²; o AR-CONC, 7,1·10⁻⁵/mm² → pela quantidade,
 *    0,056). Ficou 0,065, entre os dois (conferido lado a lado com o desenho do app no render do ezdxf).
 *  · areia → AR-SAND (pontos). O app põe 70 grãos num ladrilho de 30 px = 6,8 mm (1,5 grão/mm²); o AR-SAND tem
 *    0,0025 ponto/mm² → √(0,0025 / 1,5) = 0,04.
 *  · brita → GRAVEL. O app põe pedras SOLTAS de ≈ 1,4 mm a cada 2,25 mm (64 num ladrilho de 79 px = 18 mm); o GRAVEL
 *    é de pedras ENCOSTADAS, de tamanhos variados (≈ 6 num ladrilho de 25,4 mm). Pelo passo daria 0,18–0,22, mas aí
 *    a pedra grande sai com 3 mm, o dobro da do app; medido no render do ezdxf, 0,15 dá a pedra do tamanho da do app.
 *  · alvenaria → ANSI31 (45°). O app risca a cada 6 px = 1,36 mm; o ANSI31 a cada 3,175 mm → 0,43.
 *  · graute → ANSI31, na cor do risco e sem fundo (o graute visto atrás da face do bloco). O app risca a cada 5 px =
 *    1,14 mm → 0,36.
 *  · solido → SOLID.
 */
export const PADRAO_DO_MATERIAL: Record<PadraoHachura, PadraoNoDxf> = {
  terra: { nome: 'EARTH', escala: mm(48 * 0.4) / 6.35, espessura: mm(0.8) },
  concreto: { nome: 'AR-CONC', escala: 0.065, espessura: mm(0.6) },
  areia: { nome: 'AR-SAND', escala: 0.04, espessura: mm(0.6) },
  brita: { nome: 'GRAVEL', escala: 0.15, espessura: mm(0.7) },
  alvenaria: { nome: 'ANSI31', escala: mm(6) / 3.175, espessura: mm(0.9) },
  graute: { nome: 'ANSI31', escala: mm(5) / 3.175, espessura: mm(1.6) },
  solido: { nome: 'SOLID', escala: 1, espessura: 0 },
};

/**
 * As linhas de definição na escala pedida: ponto base, deslocamento e traços multiplicados (o ângulo não muda).
 * O DXF guarda o padrão JÁ escalado — o grupo 41 é só a etiqueta que o editor de hachura mostra.
 */
export function linhasNaEscala(nome: keyof typeof PADROES_ISO, escala: number): LinhaDoPadrao[] {
  return PADROES_ISO[nome].map(([a, [bx, by], [ox, oy], t]) => [
    a, [bx * escala, by * escala], [ox * escala, oy * escala], t.map((v) => v * escala),
  ]);
}
