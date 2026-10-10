import {useState} from 'react';
import {ArrowRightIcon,ArrowUpRightIcon,DownloadSimpleIcon,MagnifyingGlassIcon} from '@phosphor-icons/react';
import {useLang} from './i18n';
import {PageShell} from './site-shell';
import {AnchorButton,Button,Card,CodeBlock,EmptyState,Eyebrow,IconButton,Input,LangToggle,Notice,SectionHeader,Segmented,Select,SpecList,Spinner,Stat,StatGrid,Tag,TagList,Textarea} from './ui';
import './design-page.css';

const swatches=['ground','surface','surface-raised','sunken','ink','ink-2','ink-3','line','line-strong','inverse','ok','warn','error','signal'];

/** Living reference for the design system. Not linked from navigation; excluded from indexing. */
export function DesignSystemPage(){
 const{tr}=useLang();const[view,setView]=useState<'grid'|'list'>('grid');
 return <PageShell eyebrow={tr('DESIGN SYSTEM / V1','DESIGN SYSTEM / V1')} title={tr('One system for every page.','Satu sistem untuk semua halaman.')} lead={tr('Tokens, primitives and patterns used across the landing page, the hardware library, the workspace and the backoffice.','Token, komponen dasar, dan pola yang dipakai di landing, pustaka hardware, workspace, dan backoffice.')}>
  <section className="dsp-section"><SectionHeader eyebrow="01 / COLOUR" title={tr('Monochrome ground, rationed signal.','Dasar monokrom, sinyal secukupnya.')}/>
   <div className="dsp-swatches">{swatches.map(s=><div key={s}><span style={{background:`var(--ds-${s})`}}/><code>--ds-{s}</code></div>)}</div></section>

  <section className="dsp-section"><SectionHeader eyebrow="02 / TYPE" title="Archivo + IBM Plex Mono"/>
   <div className="dsp-type"><p className="dsp-display">Testing robots where the world is messy.</p><p className="dsp-h1">Heading one, tight tracking</p><p className="dsp-h2">Heading two for sections</p><p className="dsp-h3">Heading three for cards</p><p className="ds-lead">Lead paragraph for page introductions, held to a readable measure.</p><p>Body copy at sixteen pixels with comfortable leading for longer reading.</p><Eyebrow>Mono label · 11px · tracked</Eyebrow><Eyebrow rule>Section index with rule</Eyebrow></div></section>

  <section className="dsp-section"><SectionHeader eyebrow="03 / ACTIONS" title={tr('Buttons and links','Tombol dan tautan')}/>
   <div className="dsp-row"><Button>{tr('Primary action','Aksi utama')} <ArrowRightIcon/></Button><Button variant="secondary">{tr('Secondary','Sekunder')}</Button><Button variant="ghost">Ghost</Button><Button size="sm">{tr('Small','Kecil')} <ArrowUpRightIcon/></Button><Button disabled>{tr('Disabled','Nonaktif')}</Button><AnchorButton href="/partnership-brief.txt" download variant="secondary"><DownloadSimpleIcon/> Download</AnchorButton><IconButton label={tr('Search','Cari')}><MagnifyingGlassIcon size={18}/></IconButton></div>
   <div className="dsp-row dsp-inverse"><Button variant="inverse">{tr('Inverse on dark','Inverse di gelap')}</Button></div>
   <div className="dsp-row"><Segmented label="View" value={view} onChange={setView} options={[{value:'grid',label:'Grid'},{value:'list',label:'List'}]}/><LangToggle/></div></section>

  <section className="dsp-section"><SectionHeader eyebrow="04 / FORMS" title={tr('Fields','Isian')}/>
   <div className="dsp-grid-3"><Input id="dsp-q" label={tr('Search hardware','Cari hardware')} placeholder="ESP32, BME280, CO2…"/><Select id="dsp-kind" label={tr('Kind','Jenis')}><option>{tr('All','Semua')}</option><option>Board</option><option>Sensor</option></Select><Input id="dsp-err" label="Email" defaultValue="name@" error={tr('Enter a complete email address.','Masukkan alamat email lengkap.')}/></div>
   <Textarea id="dsp-goal" label={tr('Describe your build','Jelaskan rakitanmu')} placeholder="Build an ESP32 room monitor…" hint={tr('Up to 2,000 characters.','Maksimal 2.000 karakter.')}/></section>

  <section className="dsp-section"><SectionHeader eyebrow="05 / SURFACES" title={tr('Cards, tags and specs','Kartu, tag, dan spesifikasi')}/>
   <div className="dsp-grid-3"><Card><Eyebrow>SC-01</Eyebrow><h3>{tr('Surface card','Kartu surface')}</h3><p>{tr('Default container for grouped content.','Wadah standar untuk konten berkelompok.')}</p></Card><Card brackets interactive tabIndex={0}><Eyebrow>HW-3921</Eyebrow><h3>{tr('Bracketed, interactive','Ber-bracket, interaktif')}</h3><TagList items={['I2C','3.3V','Sensor']}/></Card><Card tone="inverse"><Eyebrow className="dsp-on-inverse">STATUS</Eyebrow><h3>{tr('Inverse panel','Panel inverse')}</h3><p>{tr('For one emphatic block per page.','Untuk satu blok penekanan per halaman.')}</p></Card></div>
   <div className="dsp-row"><Tag>Neutral</Tag><Tag tone="ok">Verified</Tag><Tag tone="warn">Planned</Tag><Tag tone="error">Failed</Tag><Tag tone="inverse">Preview</Tag></div>
   <SpecList rows={[[tr('Interface','Antarmuka'),'I2C · 0x76 / 0x77'],[tr('Supply','Catu daya'),'1.71–3.6 V'],[tr('Range','Rentang'),'-40…85 °C, 0–100 %RH, 300–1100 hPa']]}/></section>

  <section className="dsp-section"><SectionHeader eyebrow="06 / FEEDBACK" title={tr('Status and empty states','Status dan state kosong')}/>
   <div className="dsp-stack"><Notice tone="info" title={tr('Read-only catalog','Katalog hanya-baca')}>{tr('Showing bundled reference data. Project data is not loaded.','Menampilkan data referensi bawaan. Data proyek tidak dimuat.')}</Notice><Notice tone="ok" title={tr('Verified','Terverifikasi')}>{tr('Compile, flash, boot and data checks passed.','Pemeriksaan compile, flash, boot, dan data lolos.')}</Notice><Notice tone="warn" title={tr('Local session unavailable','Sesi lokal tidak tersedia')} action={<Button size="sm" variant="secondary">{tr('Retry','Coba lagi')}</Button>}>{tr('Start the desktop app to use the workspace.','Jalankan aplikasi desktop untuk memakai workspace.')}</Notice><Notice tone="error" title={tr('Upload failed','Upload gagal')}>{tr('The board did not respond on the selected port.','Board tidak merespons di port yang dipilih.')}</Notice><EmptyState eyebrow={tr('NO PROJECTS YET','BELUM ADA PROYEK')} title={tr('Your first experiment starts with a prompt.','Eksperimen pertamamu dimulai dari sebuah prompt.')} action={<Button size="sm">{tr('Start building','Mulai membangun')} <ArrowRightIcon/></Button>}>{tr('Describe a device and inspect the generated plan before anything touches hardware.','Jelaskan perangkat dan periksa rencana yang dihasilkan sebelum menyentuh hardware.')}</EmptyState><div className="dsp-row"><Spinner label="Loading"/><span className="dsp-muted">{tr('Loading state','State memuat')}</span></div></div></section>

  <section className="dsp-section"><SectionHeader eyebrow="07 / DATA" title={tr('Stats and code','Statistik dan kode')}/>
   <StatGrid><Stat value="56" label={tr('Hardware references','Referensi hardware')}/><Stat value="6" label={tr('Field environments','Lingkungan lapangan')}/><Stat value="4" label={tr('Verification steps','Langkah verifikasi')}/></StatGrid>
   <CodeBlock label="EXAMPLE RECORD">{'RECORD   HW-3921 · soil moisture\nBOARD    ESP32 DevKit V1 · ADC GPIO34\nSTATUS   VERIFIED'}</CodeBlock></section>
 </PageShell>;
}
