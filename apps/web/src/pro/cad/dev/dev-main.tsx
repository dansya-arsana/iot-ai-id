import {createRoot} from 'react-dom/client';
import '@fontsource/archivo/400.css';import '@fontsource/archivo/600.css';import '@fontsource/ibm-plex-mono/400.css';
import {CadViewport} from '../CadViewport';
import spec from '../../../../../../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json';
const q=new URLSearchParams(location.search);
const node=(spec as never as {nodes:{id:string}[]}).nodes.find(n=>n.id===(q.get('node')??'node-mango'))??spec.nodes[1];
createRoot(document.getElementById('root')!).render(<CadViewport node={node as never} defaultExplode={Number(q.get('explode')??55)} contextLabel="N1"/>);
