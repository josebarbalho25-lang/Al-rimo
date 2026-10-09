/*
  KaTeX → HTML. A saída fica com o MathML que o KaTeX publica junto (padrão 'htmlAndMathml'): é dele que o Word tira
  a equação editável — trocar `output` mata a exportação.
*/
import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Props {
  tex: string;
  /** Fórmula de bloco (centrada pelo KaTeX; a memória alinha à esquerda por CSS). */
  bloco?: boolean;
  /**
    Linha longa que pode quebrar: modo em linha com \displaystyle. O KaTeX só parte linha fora do modo de bloco,
    e só depois de "=" e de operador no nível de cima — exatamente onde a conta de mão quebraria.
  */
  quebra?: boolean;
  className?: string;
}

export function Tex({ tex, bloco = false, quebra = false, className }: Props) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(quebra ? `\\displaystyle ${tex}` : tex, {
        displayMode: bloco && !quebra,
        throwOnError: false,
      });
    } catch {
      return tex;
    }
  }, [tex, bloco, quebra]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
