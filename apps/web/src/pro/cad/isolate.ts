/** Isolate and hide logic, shared with the feature tree through ids (pure). */
export interface VisibilityState{hidden:ReadonlySet<string>;isolated:ReadonlySet<string>|null}
export const showAll=():VisibilityState=>({hidden:new Set(),isolated:null});
/** An item is drawn when it is not hidden and, if an isolation is active, is part of it. The enclosure is context and follows `ghostContext`. */
export function isVisible(id:string,v:VisibilityState):boolean{
 if(v.hidden.has(id))return false;
 if(v.isolated&&!v.isolated.has(id))return false;
 return true;
}
export const isGhost=(id:string,v:VisibilityState):boolean=>!!v.isolated&&!v.isolated.has(id)&&!v.hidden.has(id);
export function toggleHidden(v:VisibilityState,id:string):VisibilityState{
 const hidden=new Set(v.hidden);if(hidden.has(id))hidden.delete(id);else hidden.add(id);
 return {...v,hidden};
}
export function isolate(v:VisibilityState,ids:string[]):VisibilityState{return {...v,isolated:ids.length?new Set(ids):null};}
/** Esc: clears the isolation first; a second Esc shows hidden items again. Returns the next state. */
export function escape(v:VisibilityState):VisibilityState{
 if(v.isolated)return {...v,isolated:null};
 return {...v,hidden:new Set()};
}
export const hiddenCount=(ids:string[],v:VisibilityState):number=>ids.filter(i=>!isVisible(i,v)).length;
