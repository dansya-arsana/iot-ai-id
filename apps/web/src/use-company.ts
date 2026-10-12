import {useAccess} from './preview';
import {COMPANY,placeholdersAllowed,visibleValue,type CompanyKey,type Item} from './company';
/** Placeholders show only on local hosts, the desktop app, or the public host in staff presentation mode; see `placeholdersAllowed`. */
export function useCompany(){
 const{locked,publicHost}=useAccess();
 const allow=placeholdersAllowed(typeof window==='undefined'?'':window.location.hostname,publicHost,locked);
 return(key:CompanyKey,items:Record<CompanyKey,Item>=COMPANY)=>visibleValue(items[key],allow);
}
