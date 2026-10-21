import type {LabScene,SimSnapshot} from '../contract';

/** Per-frame subscription provided by the page's single rAF loop. */
export type Subscribe=(cb:()=>void)=>()=>void;
export type GetScene=()=>LabScene|null;
export interface StageApi{subscribe:Subscribe;getScene:GetScene;stage:()=>HTMLElement|null;snapshot:()=>SimSnapshot|null}
