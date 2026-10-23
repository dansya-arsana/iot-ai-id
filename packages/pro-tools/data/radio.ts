/**
 * LoRa and radio data (agri-domain §3.1). Founder decision: the company holds an official licence, so the Kominfo
 * power and duty limits are INFORMATION only (never block, never warn). Band correctness still applies:
 * 920-923 MHz, and a 433/868 MHz module is an error in Pro. Default module: RFM95W.
 */
export const LORA_BAND={minMHz:920,maxMHz:923,plan:'AS923-2',defaultChannelsMHz:[921.4,921.6]} as const;
export const DEFAULT_LORA_MODULE='lora-rfm95w';
/** Kominfo 2018 consultation draft (grade A, status caveat). Printed as INFO; never enforced. */
export const KOMINFO_INFO={endNodeEirpDbm:20,gatewayConductedDbm:23,gatewayEirpDbm:26,uplinkDuty:0.01,downlinkDuty:0.1,maxBandwidthKHz:200,minHopChannels:6} as const;
export const REGULATORY_NOTE={
 en:'Indicative regulatory summary; confirm the current Komdigi rules and device certification before commercial deployment.',
 id:'Ringkasan regulasi indikatif; pastikan aturan Komdigi terbaru dan sertifikasi perangkat sebelum penggunaan komersial.',
} as const;
/** Part ids and kinds that run on 433 or 868 MHz (or are sold as SX1278). Error in Pro. */
export const WRONG_BAND_RE=/(^|[-_])(ra-?02|sx1278|sx1276-?(433|868)|rfm9[0-9]w?-?(433|868)|433|868)([-_]|$)/i;
export const isWrongBandId=(id:string):boolean=>WRONG_BAND_RE.test(id);
/** Does a catalog freq range cover the whole 920-923 MHz band? */
export const coversBand=(r:{min:number;max:number}|undefined):boolean=>!!r&&r.min<=LORA_BAND.minMHz&&r.max>=LORA_BAND.maxMHz;

/** SX127x sensitivity at 125 kHz (dBm) per spreading factor (Semtech datasheet figures, grade C). */
export const SENSITIVITY_125K:Record<number,number>={7:-123,8:-126,9:-129,10:-132,11:-134.5,12:-137};
/** Bandwidth correction relative to 125 kHz: 10*log10(bw/125). */
export const sensitivityDbm=(sf:number,bwKHz=125):number=>(SENSITIVITY_125K[sf]??SENSITIVITY_125K[12])+10*Math.log10(bwKHz/125);
/** Log-distance exponent by terrain (engineering defaults, grade M). */
export const PATH_LOSS_EXPONENT={open:2.2,rural:2.7,dense:3.3,indoor:3.5} as const;
export type Terrain=keyof typeof PATH_LOSS_EXPONENT;
/** Free-space loss at 1 m for a frequency in MHz: 20log10(d_km)+20log10(f_MHz)+32.44 with d=0.001 km. */
export const fspl1mDb=(fMHz:number):number=>20*Math.log10(0.001)+20*Math.log10(fMHz)+32.44;
export const pathLossDb=(distanceM:number,terrain:Terrain,fMHz=921.4):number=>fspl1mDb(fMHz)+10*PATH_LOSS_EXPONENT[terrain]*Math.log10(Math.max(distanceM,1));
/** Default antenna gains (dBi) and cable loss (dB) for an estimate. */
export const ANTENNA_DEFAULTS={nodeDbi:2,gatewayDbi:3,cableLossDb:1} as const;
export const LINK_MARGIN={okDb:18,warnDb:10} as const;

/** LoRa time on air in seconds (Semtech AN1200.13), explicit header, CRC on, 8 preamble symbols. */
export function loraAirtimeS(payloadBytes:number,sf:number,bwKHz=125,cr:1|2|3|4=1):number{
 const bw=bwKHz*1000,tSym=Math.pow(2,sf)/bw,de=sf>=11&&bwKHz===125?1:0;
 const nPayload=8+Math.max(Math.ceil((8*payloadBytes-4*sf+28+16)/(4*(sf-2*de)))*(cr+4),0);
 return (8+4.25)*tSym+nPayload*tSym;
}
