/** Machine-readable crop thresholds (agri-domain §1.5). `grade` is the lowest grade among the cited numbers. */
export type CropProfile={
 key:string;label:{en:string;id:string};setting:string;grade:string;
 altM?:[number,number];airTOpt?:[number,number];soilPH?:[number,number];rh?:[number,number];
 senseDepthCm?:[number,number];pDepletion?:number;
 airTWarnHi?:number;airTMin?:number;airTLimits?:[number,number];
 tensionKPa?:[number,number];irrigateWhenKPaGt?:number;irrigateTargetKPa?:number;
 feedEC?:[number,number];feedPH?:[number,number];
 nightBreak?:{start:string;end:string;hours:[number,number]};leafWetWarnH?:number;
 notes:{en:string;id:string}[];
};
export const CROP_PROFILES:Record<string,CropProfile>={
 mango:{key:'mango',label:{en:'Mango',id:'Mangga'},setting:'open',grade:'A/B/C/M',altM:[0,500],airTOpt:[24,27],soilPH:[5.5,7.5],senseDepthCm:[30,60],pDepletion:0.5,
  notes:[{en:'No auto-irrigation during flower induction; irrigate from fruit set to harvest.',id:'Jangan irigasi otomatis saat induksi bunga; irigasi dari fruit set sampai panen.'}]},
 melon:{key:'melon',label:{en:'Melon',id:'Melon'},setting:'greenhouse',grade:'C/M',airTOpt:[25,30],airTWarnHi:35,airTMin:18,rh:[70,85],feedEC:[2.0,2.5],feedPH:[5.5,6.5],pDepletion:0.4,
  notes:[{en:'Grown under cover; ventilation is mandatory.',id:'Ditanam di bawah atap; ventilasi wajib.'}]},
 banana:{key:'banana',label:{en:'Banana',id:'Pisang'},setting:'open',grade:'A/B',altM:[0,1300],soilPH:[4.5,7.5],senseDepthCm:[20,30],pDepletion:0.35,tensionKPa:[12,25],irrigateWhenKPaGt:25,irrigateTargetKPa:15,
  notes:[{en:'Keep root-zone tension at 12-25 kPa; irrigate at least daily in dry spells.',id:'Jaga tegangan zona akar 12-25 kPa; irigasi minimal harian saat kering.'}]},
 chrysanthemum:{key:'chrysanthemum',label:{en:'Chrysanthemum',id:'Krisan'},setting:'screenhouse_highland',grade:'A/C/M',altM:[700,1200],airTLimits:[17,30],rh:[70,80],leafWetWarnH:6,
  nightBreak:{start:'22:00',end:'02:00',hours:[3,4]},notes:[{en:'Night-break lamp 22:00-02:00 in the vegetative phase only.',id:'Lampu night-break 22:00-02:00 hanya fase vegetatif.'}]},
 rose:{key:'rose',label:{en:'Rose',id:'Mawar'},setting:'open_or_house_highland',grade:'C',altM:[560,1200],airTOpt:[15,30],soilPH:[6,7],notes:[]},
};
/** SystemSpec CROPS vocabulary -> profile (flowers default to chrysanthemum; other crops have no profile yet). */
export const cropProfile=(crop:string):CropProfile|undefined=>CROP_PROFILES[crop==='flowers'?'chrysanthemum':crop];
/** Grades C and M carry the "adjust to local agronomist advice" line (CROP-15). */
export const needsAgronomistNote=(p:CropProfile):boolean=>/[CM]/.test(p.grade);
export const AGRONOMIST_NOTE={en:'Adjust to local agronomist advice.',id:'Sesuaikan dengan saran agronom setempat.'} as const;
