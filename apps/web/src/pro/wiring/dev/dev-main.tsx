import {createRoot} from 'react-dom/client';
import {proActions} from '../../api/spec-store';
import {devSpec} from '../../workspace/dev-fixture';
import {WiringPanel} from '../WiringPanel';
proActions.setSpec('dev-farm',1,devSpec);
const q=new URLSearchParams(location.search);
createRoot(document.getElementById('root')!).render(<WiringPanel nodeId={q.get('node')??undefined} evidence={q.get('flashed')?{flashed:Number(q.get('flashed')),total:5}:null}/>);
