/** Pure rasterizer for the hero map: turns GeoJSON polygons into a region-tagged dot grid. No I/O, so it is unit-testable. */
export type Ring=[number,number][];
export type Geometry={type:'Polygon';coordinates:Ring[]}|{type:'MultiPolygon';coordinates:Ring[][]};
export type Feature={properties:Record<string,unknown>;geometry:Geometry|null};
export type Spec={lon0:number;lon1:number;lat0:number;lat1:number;step:number};
/** Region codes: capital letters are interactive Indonesian groups, lower-case letters are faint neighbours. */
export const GROUPS:Record<string,string>={
 Aceh:'S','Sumatera Utara':'S','Sumatera Barat':'S',Riau:'S',Jambi:'S','Sumatera Selatan':'S',Bengkulu:'S',Lampung:'S','Bangka-Belitung':'S',
 'Kepulauan Riau':'B',
 Banten:'J','Jakarta Raya':'J','Jawa Barat':'J','Jawa Tengah':'J','Jawa Timur':'J',Yogyakarta:'J',
 'Kalimantan Barat':'K','Kalimantan Tengah':'K','Kalimantan Selatan':'K','Kalimantan Timur':'K','Kalimantan Utara':'K',
 'Sulawesi Utara':'L',Gorontalo:'L','Sulawesi Tengah':'L','Sulawesi Barat':'L','Sulawesi Selatan':'L','Sulawesi Tenggara':'L',
 Bali:'N','Nusa Tenggara Barat':'N','Nusa Tenggara Timur':'N',
 Maluku:'M','Maluku Utara':'M',
 Papua:'P','Papua Barat':'P','Papua Tengah':'P','Papua Pegunungan':'P','Papua Selatan':'P','Papua Barat Daya':'P',
};
export const NEIGHBOURS:Record<string,string>={MYS:'m',BRN:'b',PNG:'p',TLS:'t',SGP:'s'};
const polys=(g:Geometry)=>g.type==='Polygon'?[g.coordinates]:g.coordinates;
const inRing=(x:number,y:number,r:Ring)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const[xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
type Shape={code:string;polys:{bbox:[number,number,number,number];rings:Ring[]}[]};
function shapeOf(code:string,g:Geometry):Shape{return{code,polys:polys(g).map(rings=>{const o=rings[0];let a=1e9,b=1e9,c=-1e9,d=-1e9;for(const[x,y]of o){a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y);}return{bbox:[a,b,c,d] as [number,number,number,number],rings};})};}
const hit=(s:Shape,x:number,y:number)=>s.polys.some(p=>x>=p.bbox[0]&&x<=p.bbox[2]&&y>=p.bbox[1]&&y<=p.bbox[3]&&p.rings.reduce((n,r)=>n+(inRing(x,y,r)?1:0),0)%2===1);
/** Rasterizes provinces first (five samples per cell so Batam and Bali resolve), then neighbours (centre only). Returns one string per row, '.' for sea. */
export function rasterize(admin1:Feature[],admin0:Feature[],spec:Spec){
 const cols=Math.ceil((spec.lon1-spec.lon0)/spec.step),rows=Math.ceil((spec.lat1-spec.lat0)/spec.step);
 const prov:Shape[]=[];const unknown=new Set<string>();
 for(const f of admin1){if(f.properties.adm0_a3!=='IDN'||!f.geometry)continue;const name=String(f.properties.name),code=GROUPS[name];if(!code){unknown.add(name);continue;}prov.push(shapeOf(code,f.geometry));}
 const nb:Shape[]=admin0.flatMap(f=>{const code=NEIGHBOURS[String(f.properties.ADM0_A3)];return code&&f.geometry?[shapeOf(code,f.geometry)]:[];});
 const d=spec.step*.35,offs:[number,number][]=[[0,0],[-d,-d],[d,-d],[-d,d],[d,d]];
 const grid:string[]=[];
 for(let r=0;r<rows;r++){let line='';for(let c=0;c<cols;c++){
  const x=spec.lon0+(c+.5)*spec.step,y=spec.lat1-(r+.5)*spec.step;let ch='.';
  for(const s of prov){if(offs.some(([a,b])=>hit(s,x+a,y+b))){ch=s.code;break;}}
  if(ch==='.')for(const s of nb){if(hit(s,x,y)){ch=s.code;break;}}
  line+=ch;}grid.push(line);}
 // Tiny neighbours (Singapore) can fall between samples: guarantee one dot at the centre of their largest part.
 for(const s of nb){if(grid.some(l=>l.includes(s.code)))continue;const p=s.polys[0];if(!p)continue;const c=Math.floor(((p.bbox[0]+p.bbox[2])/2-spec.lon0)/spec.step),r=Math.floor((spec.lat1-(p.bbox[1]+p.bbox[3])/2)/spec.step);if(r>=0&&r<rows&&c>=0&&c<cols&&grid[r][c]==='.')grid[r]=grid[r].slice(0,c)+s.code+grid[r].slice(c+1);}
 return{cols,rows,grid,unknown:[...unknown]};
}
