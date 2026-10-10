import {useState} from 'react';
import {useParams} from 'react-router-dom';
import {ArrowLeftIcon} from '@phosphor-icons/react';
import {HardwareLibraryBrowser} from '../hardware-library';
import {useLang} from '../i18n';
import {PageShell} from '../site-shell';
import {TextLink} from '../ui';
import type {HardwareReference} from '../../../../packages/hardware-library/index';

export function Hardware(){
 const {tr}=useLang();
 return <PageShell eyebrow={tr('HARDWARE / REFERENCE LIBRARY','HARDWARE / PUSTAKA REFERENSI')} title={tr('Know your hardware.','Kenali hardware-mu.')} lead={tr('Boards, sensors and modules with specifications, sources and usage limits.','Board, sensor, dan modul lengkap dengan spesifikasi, sumber, dan batas penggunaannya.')}>
  <HardwareLibraryBrowser linkSheets/>
 </PageShell>;
}

export function HardwareDetail(){
 const {slug}=useParams();const {tr}=useLang();
 const [loaded,setLoaded]=useState<HardwareReference>();
 const record=loaded&&loaded.id===slug?loaded:undefined;
 const kind=record?(record.kind==='board'?tr('Board','Board'):record.kind==='sensor'?tr('Sensor','Sensor'):tr('Module','Modul')):'';
 return <PageShell
  eyebrow={<span className="hwp-crumbs"><TextLink to="/hardware" className="hwp-back"><ArrowLeftIcon aria-hidden="true"/>{tr('Hardware library','Pustaka hardware')}</TextLink><span aria-hidden="true">/</span><span>{record?`${kind} / ${record.family}`:tr('Reference','Referensi')}</span></span>}
  title={record?.name??tr('Hardware reference','Referensi hardware')}
  lead={record?.summary??tr('Check the exact board and breakout variant before wiring.','Periksa varian board dan breakout yang tepat sebelum merangkai kabel.')}>
  <HardwareLibraryBrowser key={slug} initialId={slug} variant="sheet" onSelected={setLoaded}/>
 </PageShell>;
}
