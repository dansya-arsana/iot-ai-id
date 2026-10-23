/**
 * site_climate: coarse regional climate defaults by region id or lat/lon (rounded to 0.01 degrees).
 * HONESTY: these are not station data. Rain is an engineering monsoon profile (annual total x monthly shape) and temperature and
 * humidity are broad regional ranges, all with confidence 'low'. `peakSunHours` is the DESIGN value (3.5, wet-season worst month,
 * plan D3), not the 4.8 annual average (ESDM, grade A), which must not be used for sizing. Replace with BMKG data when licensed.
 */
export type ClimateInput={regionId?:string;lat?:number;lon?:number};
export type ClimateOutput={peakSunHours:number;rainMmByMonth:number[];tempC:{min:number;max:number};rhPct:number;source:string;confidence:'high'|'medium'|'low'};

export const DESIGN_PEAK_SUN_HOURS=3.5;
export const ANNUAL_AVG_PSH=4.8;
type Shape=readonly number[];            // 12 monthly weights, normalised below
const MONSOON:Shape=[14,14,12,9,6,4,3,2,3,5,9,13];       // wet Nov-Mar (Java, Nusa Tenggara style)
const EQUATORIAL:Shape=[9,8,10,10,9,7,7,7,8,9,10,9];     // two weak peaks (Sumatra, Kalimantan)
const MALUKU:Shape=[5,5,6,8,11,13,13,11,8,6,5,5];        // reversed: wet around Jun-Aug
const ARCHIPELAGO:Shape=[11,11,10,9,8,7,7,7,8,8,7,7];
type Region={id:string;name:string;at:[number,number];annualMm:number;shape:Shape;tempC:{min:number;max:number};rhPct:number};
export const CLIMATE_REGIONS:Region[]=[
 {id:'java',name:'Java',at:[110.2,-7.7],annualMm:2000,shape:MONSOON,tempC:{min:21,max:34},rhPct:80},
 {id:'batam',name:'Batam & Riau Islands',at:[104.2,1.8],annualMm:2400,shape:EQUATORIAL,tempC:{min:23,max:33},rhPct:84},
 {id:'sumatra',name:'Sumatra',at:[101.6,-1.2],annualMm:2800,shape:EQUATORIAL,tempC:{min:22,max:33},rhPct:84},
 {id:'kalimantan',name:'Kalimantan',at:[114,-0.5],annualMm:3000,shape:EQUATORIAL,tempC:{min:23,max:33},rhPct:85},
 {id:'sulawesi',name:'Sulawesi',at:[121.3,-2.2],annualMm:2200,shape:ARCHIPELAGO,tempC:{min:22,max:33},rhPct:82},
 {id:'nusa-tenggara',name:'Bali & Nusa Tenggara',at:[118.5,-9.6],annualMm:1200,shape:MONSOON,tempC:{min:22,max:34},rhPct:72},
 {id:'maluku',name:'Maluku',at:[128.2,-3.4],annualMm:2500,shape:MALUKU,tempC:{min:23,max:32},rhPct:83},
 {id:'papua',name:'Papua',at:[137,-4.7],annualMm:3000,shape:ARCHIPELAGO,tempC:{min:21,max:32},rhPct:85},
 {id:'maritime',name:'Maritime Indonesia',at:[120,-11],annualMm:2500,shape:ARCHIPELAGO,tempC:{min:25,max:31},rhPct:80},
];
/** Province-style aliases used in specs (for example the fixture's `jatim`). */
export const REGION_ALIASES:Record<string,string>={jatim:'java',jateng:'java',jabar:'java',banten:'java',jakarta:'java',diy:'java',bali:'nusa-tenggara',ntb:'nusa-tenggara',ntt:'nusa-tenggara',riau:'sumatra',kepri:'batam',aceh:'sumatra',sumut:'sumatra',sumbar:'sumatra',sumsel:'sumatra',lampung:'sumatra',kalbar:'kalimantan',kaltim:'kalimantan',kalsel:'kalimantan',kalteng:'kalimantan',sulsel:'sulawesi',sulut:'sulawesi',sulteng:'sulawesi'};
export class ClimateError extends Error{constructor(public code:'unknown_region'|'bad_input',message:string){super(message);}}
export const round2=(n:number)=>Math.round(n*100)/100;

const rainOf=(r:Region):number[]=>{const sum=r.shape.reduce((a,b)=>a+b,0);const raw=r.shape.map(w=>Math.round(r.annualMm*w/sum));raw[0]=raw[0]!+(r.annualMm-raw.reduce((a,b)=>a+b,0));return raw;};

export function siteClimate(input:ClimateInput):ClimateOutput{
 let region:Region|undefined;let how:string;
 if(input.regionId){
  const id=REGION_ALIASES[input.regionId]??input.regionId;
  region=CLIMATE_REGIONS.find(r=>r.id===id);
  if(!region)throw new ClimateError('unknown_region',`Unknown regionId "${input.regionId}". Known: ${CLIMATE_REGIONS.map(r=>r.id).join(', ')}.`);
  how=`region ${region.id}`;
 }else if(input.lat!==undefined&&input.lon!==undefined){
  const lat=round2(input.lat),lon=round2(input.lon);
  let best=Infinity;
  for(const r of CLIMATE_REGIONS){const d=(r.at[0]-lon)**2+(r.at[1]-lat)**2;if(d<best){best=d;region=r;}}
  how=`nearest region ${region!.id} to ${lat.toFixed(2)},${lon.toFixed(2)}`;
 }else throw new ClimateError('bad_input','regionId or lat+lon is required');
 return {peakSunHours:DESIGN_PEAK_SUN_HOURS,rainMmByMonth:rainOf(region!),tempC:{...region!.tempC},rhPct:region!.rhPct,
  source:`Coarse regional defaults (${how}); engineering estimate, not station data. peakSunHours is the 3.5 h wet-season design value, not the ${ANNUAL_AVG_PSH} h annual average.`,confidence:'low'};
}
