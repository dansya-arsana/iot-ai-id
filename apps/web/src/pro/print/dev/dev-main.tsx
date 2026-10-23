/** Standalone Build Sheet on the farm fixture (vite config in this folder, port 9705). ?stress=1 adds a heavy node to test overflow; ?evidence=2/5 shows FLASHED. */
import {createRoot} from 'react-dom/client';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {PrintPage} from '../PrintPage';
import {BuildSheet} from '../BuildSheet';
import {devSpec} from '../../workspace/dev-fixture';
import {stressSpec} from './stress';

const q=new URLSearchParams(location.search);
const ev=q.get('evidence')?.split('/').map(Number);
function Dev(){
 if(q.get('stress'))return <BuildSheet spec={stressSpec(devSpec)} projectId="stress" revision={3} noSnapshots={q.get('nosnap')==='1'}/>;
 return <MemoryRouter initialEntries={['/pro/print/dev-farm/1']}><Routes><Route path="/pro/print/:projectId/:revision" element={ev?<EvidenceDemo/>:<PrintPage/>}/></Routes></MemoryRouter>;
}
function EvidenceDemo(){return <BuildSheet spec={devSpec} projectId="dev-farm" revision={1} evidence={{flashed:ev![0]!,total:ev![1]!}}/>;}
createRoot(document.getElementById('root')!).render(<Dev/>);
