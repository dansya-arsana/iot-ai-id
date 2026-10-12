/** Shared types and vocabularies for the global home hero map. Facts are editorial copies of docs/research/hero-map-spec.md; every one carries source, year and confidence. */
import {TEST_BUILDS,TEST_MONTHS,TEST_REGIONS,TEST_STRESSORS} from '../../../../packages/ops-contract/index';
export type RegionId=typeof TEST_REGIONS[number];
export type Build=typeof TEST_BUILDS[number];
export type Stressor=typeof TEST_STRESSORS[number];
export type Month=typeof TEST_MONTHS[number];
export type Conf='H'|'M'|'L';
/** `hero` facts may appear in a panel (H or M only, at most three); everything else lives in the Sources drawer. */
export type Fact={t:string;src:string;year:string;url:string;conf:Conf;hero?:boolean;/** a figure taken from `t` (may be abbreviated, never a new number; a unit test checks the digits), shown as a tile; the full sentence stays in the Why tab and the Sources drawer */stat?:{v:string;l:string}};
export type Season='wet'|'dry'|'haze'|'none';
export type Region={id:RegionId;name:string;/** grid char in hero-map-data */code:string;identity:string;facts:Fact[];tests:string[];fit:Build[];stress:Stressor[];/** 12 months, jan..dec */season:Season[];cta:string;note?:string;/** label anchor, lon/lat */at:[number,number]};
export type HotspotKind='city'|'industrial'|'agri'|'marine'|'energy-mining'|'special-zone';
export type Hotspot={id:string;name:string;region:RegionId;lon:number;lat:number;kind:HotspotKind;identity:string;facts:Fact[];tests:string[];fit:Build[];stress:Stressor[];/** a planned AIoT lab city: no lab operates yet */planned?:boolean;/** shown on the map before anything is selected */pin?:boolean;/** Access lens: what makes it an access point (KEK, free trade zone) */access?:string;/** short pin label */short?:string};
export const BUILD_LABEL:Record<Build,string>={ground:'Ground / ag robot',drone:'Drone',amr:'Industrial AMR / cobot',marine:'Marine',sensors:'Sensors & IoT',humanoid:'Humanoid / manipulation'};
export const STRESS_LABEL:Record<Stressor,string>={heat:'Heat & humidity',haze:'Haze & dust',flood:'Flood & rain',salt:'Salt & corrosion',power:'Unstable power',connectivity:'Weak connectivity'};
export const MONTH_LABEL:Record<Month,string>={jan:'Jan',feb:'Feb',mar:'Mar',apr:'Apr',may:'May',jun:'Jun',jul:'Jul',aug:'Aug',sep:'Sep',oct:'Oct',nov:'Nov',dec:'Dec'};
export const KIND_LABEL:Record<HotspotKind,string>={city:'City',industrial:'Industrial area',agri:'Agriculture',marine:'Marine',['energy-mining']:'Energy & mining','special-zone':'Special zone'};
/** Wet Nov–Apr, haze Jul–Oct (peaking Aug–Sep) for Sumatra and Kalimantan; the rest of the year dry. */
const wetDry:Season[]=['wet','wet','wet','wet','dry','dry','dry','dry','dry','dry','wet','wet'];
export const SEASONS={monsoon:wetDry,hazeBelt:wetDry.map((s,i)=>i>=6&&i<=9?'haze':s) as Season[],maluku:['none','none','none','none','none','wet','wet','wet','none','none','none','none'] as Season[],none:Array<Season>(12).fill('none')};
