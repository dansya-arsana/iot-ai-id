import type {LabScene,LessonId,SimSnapshot} from '../contract';
import type {PinHistory} from './pin-history';

/** V2 scene methods are all optional here so the UI never depends on the scene track's timing (feature-detect before calling). */
export interface SceneExtras{
 setSafeArea(i:{top:number;right:number;bottom:number;left:number}):void;
 contentRect():{x:number;y:number;w:number;h:number}|null;
 thumbnails(o:{width:number;height:number;dpr:number;order?:LessonId[];onEach?:(id:LessonId,url:string)=>void}):Promise<Partial<Record<LessonId,string>>>;
 celebrate():void;
}
export type SceneV2=LabScene&Partial<SceneExtras>;

/** Per-frame subscription provided by the page's single rAF loop. */
export type Subscribe=(cb:()=>void)=>()=>void;
export type GetScene=()=>SceneV2|null;
export interface StageApi{subscribe:Subscribe;getScene:GetScene;stage:()=>HTMLElement|null;snapshot:()=>SimSnapshot|null;history:()=>PinHistory}
