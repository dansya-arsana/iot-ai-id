/** Crisp 5x5 dot glyph for the header and rail: integer-pixel dots (2px on a 3px pitch), one live dot. */
const CELLS=[[0,0],[3,0],[6,0],[9,0],[12,0],[0,3],[0,6],[0,9],[0,12],[3,3],[9,3],[6,6],[3,9],[9,9],[12,12],[12,6],[6,12]] as const;
export function LabGlyph(){
 return (
  <svg className="lab-glyph" viewBox="0 0 14 14" width="28" height="28" aria-hidden="true">
   {CELLS.map(([x,y])=><rect key={`${x}-${y}`} className={x===6&&y===6?'lab-glyph-live':'lab-glyph-dot'} x={x} y={y} width="2" height="2"/>)}
  </svg>
 );
}
