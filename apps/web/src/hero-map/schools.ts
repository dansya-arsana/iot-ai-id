/** Vocational schools (SMK) per region and hotspot area: EXISTING schools, i.e. potential Lab Mitra field-test reach. They are NOT AIoT partners.
 * Source: Data Referensi Kemendikdasmen (Jalur Formal, SMK), read 12 Oct 2026; the page shows no semester label. Generated from docs/research/smk-dossier.json: regions are the sums of its province rows, hotspot areas are the listed districts. */
import type {Conf} from './model';
export type SchoolCount={n:number;area:string;src:string;year:string;url:string;conf:Conf};
const SRC={src:'Data Referensi Kemendikdasmen',year:'accessed 12 Oct 2026',url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/000000/0/jf/15/all',conf:'H' as Conf};
/** National total is our sum of the official rows (the page shows no grand total): 3,813 negeri and 10,632 swasta, one of them listed abroad. Maritime Indonesia has no school count. */
export const NATIONAL={n:14445,negeri:3813,swasta:10632,...SRC};
export const REGION_SCHOOLS:Record<string,SchoolCount>={
 'batam':{n:110,area:'the Riau Islands province',...SRC},
 'java':{n:8149,area:'Java (6 provinces)',...SRC},
 'kalimantan':{n:759,area:'Kalimantan (5 provinces)',...SRC},
 'maluku':{n:277,area:'Maluku and North Maluku',...SRC},
 'nusa-tenggara':{n:902,area:'Bali, NTB and NTT',...SRC},
 'papua':{n:220,area:'the Papua provinces (6)',...SRC},
 'sulawesi':{n:1148,area:'Sulawesi (6 provinces)',...SRC},
 'sumatra':{n:2879,area:'Sumatra (9 provinces, without Riau Islands)',...SRC},
};
export const SPOT_SCHOOLS:Record<string,SchoolCount>={
 'jakarta':{n:559,area:'DKI Jakarta province',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/010000/1/jf/15/all'},
 'bekasi-karawang':{n:447,area:'Kab. Bekasi, Kota Bekasi and Kab. Karawang',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/020000/1/jf/15/all'},
 'bandung':{n:107,area:'Kota Bandung',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/020000/1/jf/15/all'},
 'cilegon':{n:26,area:'Kota Cilegon',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/280000/1/jf/15/all'},
 'semarang-kendal':{n:135,area:'Kota Semarang and Kab. Kendal only',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/030000/1/jf/15/all'},
 'yogyakarta':{n:205,area:'DI Yogyakarta province',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/040000/1/jf/15/all'},
 'surabaya-perak':{n:106,area:'Kota Surabaya',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/050000/1/jf/15/all'},
 'gresik-jiipe':{n:62,area:'Kab. Gresik',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/050000/1/jf/15/all'},
 'malang-singhasari':{n:194,area:'Kota Malang and Kab. Malang',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/050000/1/jf/15/all'},
 'medan':{n:137,area:'Kota Medan',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/070000/1/jf/15/all'},
 'sei-mangkei-kuala-tanjung':{n:67,area:'Kab. Simalungun and Kab. Batu Bara',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/070000/1/jf/15/all'},
 'pekanbaru-riau-palm':{n:65,area:'Kota Pekanbaru',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/090000/1/jf/15/all'},
 'palembang':{n:81,area:'Kota Palembang',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/110000/1/jf/15/all'},
 'batam':{n:70,area:'Kota Batam',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/310000/1/jf/15/all'},
 'balikpapan-ikn':{n:46,area:'Kota Balikpapan and Kab. Penajam Paser Utara',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/160000/1/jf/15/all'},
 'makassar':{n:79,area:'Kota Makassar',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/190000/1/jf/15/all'},
 'denpasar-sanur':{n:34,area:'Kota Denpasar',...SRC,url:'https://referensi.data.kemendikdasmen.go.id/pendidikan/dikmen/220000/1/jf/15/all'},
};
export const regionSchools=(id:string)=>REGION_SCHOOLS[id];
export const spotSchools=(id:string)=>SPOT_SCHOOLS[id];
/** Density 0..4 of a region against the largest count, for the dot shading. */
export function density(id:string,ids:string[]){const n=regionSchools(id)?.n;if(!n)return 0;const max=Math.max(...ids.map(i=>regionSchools(i)?.n??0));return max?Math.max(1,Math.ceil(n/max*4)):0;}
