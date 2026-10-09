// ═══════════════════════════════════════════════════════════════════════════
//  ui/Prancheta.tsx — a folha onde entra um desenho SVG (vistas 2D)
// ---------------------------------------------------------------------------
//  Para a integração ligar os desenhos sem reinventar a moldura:
//    ligar({ abas: { frontal: ({ modelo }) => modelo && <Prancheta svg={vistaFrontal(modelo)} /> } })
//  O desenho é autorado CLARO (papel); no tema escuro a folha inverte pela
//  receita do Pró-Viga (`.prancheta`, componentes.css). Desenho do próprio app,
//  então entra no documento como está.
// ═══════════════════════════════════════════════════════════════════════════

export function Prancheta({ svg }: { svg: string }) {
  return (
    <div className="folha">
      <div className="prancheta folha-desenho" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
