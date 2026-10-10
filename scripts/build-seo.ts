/** Post-build: static per-route HTML for crawlers and AI agents, plus robots, sitemap and llms.txt. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {hardwareLibrary,type HardwareReference} from '../packages/hardware-library/index.js';

const SITE='https://iot.ai.id';
/** nginx serves route directories, so non-root routes resolve with a trailing slash. */
const slash=(path:string)=>path==='/'?'/':`${path}/`;
const OUT='dist/web';
const today=new Date().toISOString().slice(0,10);
const template=readFileSync(join(OUT,'index.html'),'utf8');
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const pitch='iot.ai.id tests robotics, sensor and IoT hardware in real Indonesian field conditions (heat, 70–90% humidity, unstable power, intermittent networks) and returns machine-readable, verifiable evidence for engineering and AI teams.';
const scenarios:[string,string,string[]][]=[
 ['Aquaculture ponds','Water quality telemetry over brackish water.',['Humidity','Corrosion','Remote power']],
 ['Greenhouses & plantations','Soil and climate sensing under tropical heat.',['Sensor drift','Heat','Intermittent network']],
 ['Cold-chain & warehouses','Temperature logging across loading and transit.',['Condensation','Door cycles','Battery life']],
 ['Factory floors','Industrial buses and actuators near heavy machinery.',['RS485 noise','Modbus quirks','EMI']],
 ['Smart buildings','Air quality and occupancy in mixed-use spaces.',['Power outages','Firmware crashes','Wi-Fi contention']],
 ['Remote telemetry','Unattended nodes far from the nearest technician.',['Signal loss','Solar power','Physical access']],
];
const steps:[string,string][]=[
 ['Specify','Hardware, target behaviour and environment are written as a machine-checkable contract, checked for pins, voltage and bus conflicts.'],
 ['Deploy','Operators install the setup at a lab bench or field site following generated instructions.'],
 ['Execute','The agent compiles, flashes, boots and measures, capturing serial output and readings.'],
 ['Record','Results, camera evidence and failures are stored as an identity-bound record, pass or fail.'],
];
const offers=['Environmental stress testing','Field pilot deployments','Failure and recovery datasets'];
const faq:[string,string][]=[
 ['What is iot.ai.id?',pitch],
 ['Who is it for?','Robotics companies (for example dexterous hand and tactile sensor makers), sensor and IoT hardware manufacturers, and AI teams that need verified physical-world data.'],
 ['Why Indonesia?','Tropical field environments, diverse deployment sites, close access to the low-cost component supply chain, and vocational electronics and mechatronics talent to operate lab benches and field sites.'],
 ['What do partners receive?','Evidence records linking a hardware configuration, the test conditions, measurements and the outcome, including failures and recovery history.'],
 ['Is it available now?','The hardware reference catalog and the verification loop exist. Lab cities (Bekasi, Bandung, Yogyakarta) are planned. Images on the website are concept renders, not products for sale.'],
 ['How do I start?',`Download the partnership brief at ${SITE}/partnership-brief.txt.`],
];

type Page={path:string,title:string,description:string,body:string,jsonld?:object,lang?:'en'|'id',alternates?:boolean};
/** The global (EN) home and the Indonesian SMK landing are language alternates of each other. */
const hreflang=`<link rel="alternate" hreflang="en" href="${SITE}/">\n<link rel="alternate" hreflang="id" href="${SITE}/id/">\n<link rel="alternate" hreflang="x-default" href="${SITE}/">`;
function render(p:Page){
 const url=SITE+slash(p.path);
 let html=template
  .replace(/<title>[^<]*<\/title>/,`<title>${esc(p.title)}</title>`)
  .replace(/(<meta name="description" content=")[^"]*/,`$1${esc(p.description)}`)
  .replace(/(<link rel="canonical" href=")[^"]*/,`$1${url}`)
  .replace(/(<meta property="og:title" content=")[^"]*/,`$1${esc(p.title)}`)
  .replace(/(<meta property="og:description" content=")[^"]*/,`$1${esc(p.description)}`)
  .replace(/(<meta property="og:url" content=")[^"]*/,`$1${url}`)
  .replace(/(<meta name="twitter:title" content=")[^"]*/,`$1${esc(p.title)}`)
  .replace(/(<meta name="twitter:description" content=")[^"]*/,`$1${esc(p.description)}`)
  .replace('<!--prerender-->',`<div class="seo-prerender">${p.body}</div>`);
 if(p.lang==='id')html=html.replace('<html lang="en"','<html lang="id"').replace(/(<meta property="og:locale" content=")[^"]*/,'$1id_ID');
 if(p.alternates)html=html.replace('</head>',`${hreflang}\n</head>`);
 if(p.jsonld)html=html.replace('</head>',`<script type="application/ld+json">${JSON.stringify(p.jsonld)}</script>\n</head>`);
 const file=p.path==='/'?join(OUT,'index.html'):join(OUT,p.path,'index.html');
 mkdirSync(dirname(file),{recursive:true});writeFileSync(file,html);
}
const nav=`<nav><a href="/">Home</a> · <a href="/hardware">Hardware library</a> · <a href="/learn">Learn</a> · <a href="/docs">Docs</a> · <a href="/llms.txt">llms.txt</a></nav>`;
const list=(xs:string[])=>`<ul>${xs.map(x=>`<li>${x}</li>`).join('')}</ul>`;

const home=`<main>${nav}
<h1>Testing robots and sensors where the world is messy.</h1>
<p>${esc(pitch)}</p>
<h2>The gap</h2><p>AI can write firmware, but it has never felt a monsoon. Real deployments fail on drift, corrosion, noise and power loss, and that experience is rarely recorded in a form a machine can use.</p>
<h2>Scenario atlas</h2>${list(scenarios.map(([n,d,t])=>`<strong>${esc(n)}</strong>: ${esc(d)} Failure modes: ${t.join(', ')}.`))}
<h2>Verification loop</h2><ol>${steps.map(([h,d])=>`<li><strong>${h}</strong>: ${esc(d)}</li>`).join('')}</ol>
<h2>Verification network</h2><p>Vocational electronics and mechatronics students operate lab benches and field sites. Planned lab cities: Bekasi, Bandung, Yogyakarta.</p>
<h2>For robotics, sensor and AI teams</h2>${list(offers)}<p><a href="/partnership-brief.txt">Download the partnership brief</a></p>
<h2>FAQ</h2>${faq.map(([q,a])=>`<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}
</main>`;
render({path:'/',alternates:true,title:'iot.ai.id — Testing robots and sensors where the world is messy.',description:'Real-world hardware verification from Indonesia. We test robotics, sensor and IoT hardware in humid, hot, unstable field conditions and return verifiable evidence for engineering and AI teams.',body:home,
 jsonld:{'@context':'https://schema.org','@type':'FAQPage',mainEntity:faq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}});

const idFaq:[string,string][]=[
 ['Apa itu Program Lab Mitra?','Program iot.ai.id untuk SMK: guru dan siswa dilatih IoT, lalu lab sekolah menerima tugas uji hardware berbayar dari perusahaan robotika, sensor, dan AI.'],
 ['Berapa biayanya?','Paket Guru Rp1.490.000 per guru. Paket Lab Mitra Sekolah Rp9.900.000 per sekolah (3 guru, 10 siswa operator, 5 kit uji, verifikasi lab, akses tugas berbayar). Paket agency dan yayasan sesuai penawaran.'],
 ['Berapa honor tugas uji?','Uji modul dasar Rp75.000–150.000, uji lingkungan dan berulang Rp250.000–500.000, pilot lapangan Rp1–3 juta per lokasi. Dibagi 60% siswa, 25% kas TEFA sekolah, 15% guru pembimbing. Jumlah tugas tidak dijamin per bulan.'],
 ['Apakah sertifikatnya BNSP?','Bukan. Sertifikat pelatihan 32 JP diterbitkan oleh iot.ai.id.'],
 ['Bagaimana cara daftar?','Chat WhatsApp +62 812-114-040. Kami kirim penawaran resmi dan invoice atas nama sekolah.'],
];
render({path:'/id',lang:'id',alternates:true,title:'Program Lab Mitra SMK — pelatihan IoT & tugas uji berbayar | iot.ai.id',description:'Lab SMK Anda bisa dibayar untuk menguji hardware. Pelatihan IoT untuk guru dan siswa, lalu tugas uji berbayar mulai Rp75.000 per tugas. Daftar via WhatsApp.',
 body:`<main><nav><a href="/">Global site (EN)</a> · <a href="/hardware">Hardware library</a></nav>
<h1>Lab SMK Anda bisa dibayar untuk menguji hardware.</h1>
<p>Program Lab Mitra iot.ai.id melatih guru dan siswa SMK di bidang IoT, lalu mengirim tugas uji hardware dari perusahaan robotika dan sensor ke lab sekolah. Setiap tugas yang lulus dibayar.</p>
<h2>Paket</h2>${list(['Paket Guru: Rp1.490.000 per guru','Paket Lab Mitra Sekolah: Rp9.900.000 per sekolah','Agency & yayasan: hubungi kami'])}
<h2>Pertanyaan</h2>${idFaq.map(([q,a])=>`<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}
<p><a href="https://wa.me/62812114040">Daftar via WhatsApp +62 812-114-040</a></p></main>`,
 jsonld:{'@context':'https://schema.org','@type':'FAQPage',inLanguage:'id',mainEntity:idFaq.map(([q,a])=>({'@type':'Question',name:q,acceptedAnswer:{'@type':'Answer',text:a}}))}});

const hwLine=(h:HardwareReference)=>`<a href="/hardware/${h.id}/">${esc(h.name)}</a> (${h.kind}, ${h.protocols.join('/')}): ${esc(h.summary)}`;
render({path:'/hardware',title:'Hardware library | iot.ai.id',description:`Reference specifications for ${hardwareLibrary.length} boards, sensors and modules: ESP32, Arduino, Raspberry Pi and common I2C/SPI sensors.`,
 body:`<main>${nav}<h1>Hardware library</h1><p>${hardwareLibrary.length} hardware references. Specifications only; listing does not imply verified firmware support.</p>${list(hardwareLibrary.map(hwLine))}</main>`,
 jsonld:{'@context':'https://schema.org','@type':'ItemList',name:'iot.ai.id hardware library',numberOfItems:hardwareLibrary.length,itemListElement:hardwareLibrary.map((h,i)=>({'@type':'ListItem',position:i+1,url:`${SITE}/hardware/${h.id}/`,name:h.name}))}});

for(const h of hardwareLibrary){
 const body=`<main>${nav}<article><h1>${esc(h.name)}</h1><p>${esc(h.summary)}</p>
<p>Kind: ${h.kind}. Family: ${esc(h.family)}. Category: ${esc(h.category)}. Protocols: ${h.protocols.join(', ')}.</p>
<h2>Specifications</h2>${list(h.specifications.map(s=>`${esc(s.label)}: ${esc(s.value)}`))}
<h2>Electrical</h2>${list(h.electrical.map(esc))}
<h2>Pinout</h2>${list(h.pinout.map(esc))}
${h.software.length?`<h2>Software</h2>${list(h.software.map(esc))}`:''}
<h2>Use cases</h2>${list(h.useCases.map(esc))}
<h2>Limitations</h2>${list(h.limitations.map(esc))}
<h2>Sources</h2>${list(h.sources.map(s=>`<a href="${esc(s.url)}" rel="nofollow">${esc(s.title)}</a>`))}
<p>Review status: ${h.reviewStatus}. Support: ${h.support}.</p></article></main>`;
 render({path:`/hardware/${h.id}`,title:`${h.name} — specifications, pinout and limits | iot.ai.id`,description:`${h.name}: ${h.summary}`.slice(0,300),body,
  jsonld:{'@context':'https://schema.org','@type':'TechArticle',headline:`${h.name} reference specification`,about:{'@type':'Thing',name:h.name,alternateName:h.aliases},description:h.summary,url:`${SITE}/hardware/${h.id}/`,publisher:{'@id':`${SITE}/#org`},citation:h.sources.map(s=>s.url)}});
}
render({path:'/learn',title:'Learn | iot.ai.id',description:'Practical guides for sensors, wiring and testing with ESP32 and common modules.',body:`<main>${nav}<h1>Learn</h1><p>Practical learning material for sensors, circuits and testing.</p></main>`});
render({path:'/docs',title:'Documentation | iot.ai.id',description:'Documentation for the iot.ai.id hardware workspace, hardware contract, validation and evidence.',body:`<main>${nav}<h1>Documentation</h1><p>Documentation for the hardware contract, deterministic validation, evidence verification and desktop workspace.</p></main>`});

const urls=['/','/id','/hardware','/learn','/docs',...hardwareLibrary.map(h=>`/hardware/${h.id}`)];
writeFileSync(join(OUT,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`<url><loc>${SITE}${slash(u)}</loc><lastmod>${today}</lastmod><priority>${u==='/'||u==='/id'?'1.0':u==='/hardware'?'0.8':'0.6'}</priority></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(OUT,'robots.txt'),`# iot.ai.id — crawlers and AI agents are welcome on public pages.
User-agent: *
Allow: /
Disallow: /api/
Disallow: /backoffice
Disallow: /build
Disallow: /project/
Disallow: /site/
Disallow: /sites
Disallow: /design

# AI crawlers: explicitly allowed
User-agent: GPTBot
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: ClaudeBot
User-agent: Claude-User
User-agent: Claude-SearchBot
User-agent: PerplexityBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: CCBot
Allow: /
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`);

const llms=`# iot.ai.id

> ${pitch}

iot.ai.id is based in Indonesia and serves robotics, sensor and AI teams worldwide. Images on the website are concept renders, not products for sale. Planned lab cities: Bekasi, Bandung, Yogyakarta.

## Core pages

- [Home](${SITE}/): positioning, scenario atlas, verification loop, network and partnership offer
- [Partnership brief](${SITE}/partnership-brief.txt): services, what partners provide, current limits
- [Program Lab Mitra (Indonesian)](${SITE}/id/): IoT training and paid hardware-testing tasks for Indonesian vocational schools (SMK)
- [Hardware library](${SITE}/hardware/): ${hardwareLibrary.length} board, sensor and module reference specifications
- [Full LLM context](${SITE}/llms-full.txt): everything on this site in one plain-text file

## Services

${offers.map(o=>`- ${o}`).join('\n')}

## Field scenarios

${scenarios.map(([n,d,t])=>`- ${n}: ${d} Failure modes: ${t.join(', ')}.`).join('\n')}

## Verification loop

${steps.map(([h,d],i)=>`${i+1}. ${h}: ${d}`).join('\n')}

## FAQ

${faq.map(([q,a])=>`- ${q} ${a}`).join('\n')}

## Optional

- [Source code](https://github.com/dansya-arsana/iot-ai-id): open-source hardware workspace (hardware contract, validation, evidence)
- [Sitemap](${SITE}/sitemap.xml)
`;
writeFileSync(join(OUT,'llms.txt'),llms);
const hwFull=hardwareLibrary.map(h=>`### ${h.name}
URL: ${SITE}/hardware/${h.id}/
Kind: ${h.kind} · Family: ${h.family} · Category: ${h.category} · Protocols: ${h.protocols.join(', ')}
Aliases: ${h.aliases.join(', ')||'-'}
Summary: ${h.summary}
Specifications: ${h.specifications.map(s=>`${s.label}: ${s.value}`).join('; ')}
Electrical: ${h.electrical.join(' ')}
Pinout: ${h.pinout.join(' ')}
Use cases: ${h.useCases.join(', ')}
Limitations: ${h.limitations.join(' ')}
Sources: ${h.sources.map(s=>s.url).join(', ')}
Status: ${h.reviewStatus}, ${h.support}`).join('\n\n');
writeFileSync(join(OUT,'llms-full.txt'),`${llms}\n## Partnership brief\n\n${readFileSync(join(OUT,'partnership-brief.txt'),'utf8')}\n## Hardware library (${hardwareLibrary.length} references)\n\n${hwFull}\n`);
console.log(`seo: ${urls.length} pages, sitemap, robots, llms.txt, llms-full.txt`);
