/** Standalone dev harness for the chat panel (fixture turn). Not part of the production bundle. */
import {createRoot} from 'react-dom/client';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '../../design/tokens.css';
import {ChatPanel} from './ChatPanel';
import {fixtureTransport} from './transport';

const params=new URLSearchParams(location.search);
createRoot(document.getElementById('root')!).render(
 <div style={{display:'grid',gridTemplateColumns:'1fr 400px',height:'100vh',background:'var(--ds-ground)'}}>
  <div/>
  <div style={{borderLeft:'1px solid var(--ds-line)',height:'100vh',minHeight:0,overflow:'hidden'}}>
   <ChatPanel transport={fixtureTransport(Number(params.get('delay')??120))} initialMessage="I'm building IoT for my farm. It has 4 fields: mango, melon, banana and chili."/>
  </div>
 </div>);
