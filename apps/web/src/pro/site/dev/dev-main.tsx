import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {SitePlan,type SiteSelection} from '../SitePlan';
import spec from '../../../../../../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json';
function Dev(){const [sel,setSel]=useState<SiteSelection>(new URLSearchParams(location.search).get('sel')?{kind:'link',id:new URLSearchParams(location.search).get('sel')!}:null);
 return <SitePlan spec={spec as never} selection={sel} onSelect={setSel}/>;}
createRoot(document.getElementById('root')!).render(<Dev/>);
