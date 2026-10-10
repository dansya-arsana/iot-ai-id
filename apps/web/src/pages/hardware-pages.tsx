import {Link,useParams} from 'react-router-dom';
import {ArrowLeftIcon} from '@phosphor-icons/react';
import {HardwareLibraryBrowser} from '../hardware-library';
import {Page} from './legacy-page';

export function Hardware(){return <Page kicker="HARDWARE / REFERENCE LIBRARY" title="Know your hardware." subtitle="Boards, sensors and modules with specifications, sources and usage limits."><HardwareLibraryBrowser/></Page>;}
export function HardwareDetail(){const{slug}=useParams();return <Page kicker="HARDWARE / REFERENCE" title="Hardware reference." subtitle="Check the exact board and breakout variant before wiring."><Link to="/hardware" className="text-button"><ArrowLeftIcon/> Hardware library</Link><HardwareLibraryBrowser key={slug} initialId={slug}/></Page>;}
