import {defineLesson,c,co,pinRow,sp,b,w,P,extOf,extId,pill,RAILS} from './kit';

/** Colours of the ring in one frame: [count lit, distinct colours, mean of the strongest channel of every lit LED]. */
const ringStats=(leds:string):{lit:number;distinct:number;avg:number}=>{
 const seen=new Set<string>();let lit=0,sum=0;
 for(let i=0;i+6<=leds.length;i+=6){
  const px=leds.slice(i,i+6),r=parseInt(px.slice(0,2),16),g=parseInt(px.slice(2,4),16),bl=parseInt(px.slice(4,6),16);
  if(r+g+bl===0)continue;
  lit++;seen.add(px);sum+=Math.max(r,g,bl);
 }
 return {lit,distinct:seen.size,avg:lit?sum/lit:0};
};

export const lesson=defineLesson({
 id:'neopixel',order:210,concept:'WS2812',keyPins:['D6','D2','D3','D4'],recordPins:['D6','D2'],
 view:{az:24,elev:42,board:true},
 circuit:{
  parts:[
   {id:'ring1',kind:'ws2812-strip',net:{VCC:'5V',DIN:'D6',GND:'GND'},props:{shape:'ring'}},
   {id:'enc1',kind:'rotary-encoder-ky040',net:{CLK:'D2',DT:'D3',SW:'D4','+':'5V',GND:'GND'},props:{position:0}},
  ],
  wires:[w('ring1','DIN','D6','yellow'),w('ring1','VCC','5V','red'),w('ring1','GND','GND','black'),w('enc1','CLK','D2','green'),w('enc1','DT','D3','blue'),w('enc1','SW','D4','orange'),...RAILS],
 },
 firmware:{variants:[{id:'default',params:[P('frameMs','uint16',30,10,100,5),P('level','uint8',64,16,240,16)]}]},
 check:(s,m)=>{
  const ring=extOf(s,'ws2812-strip'),enc=extOf(s,'rotary-encoder-ky040');
  if(!ring||!enc||typeof ring.leds!=='string')return false;
  const st=ringStats(ring.leds);
  if(st.lit>=12&&st.distinct>=8)m.rainbow=1;     // a real rainbow reached the pixels
  if(m.rainbow&&m.base===undefined&&Number(ring.frames)>0)m.base=st.avg;
  if(m.base&&Number(enc.steps)>=2&&st.lit>0){
   const ratio=st.avg/m.base;
   if(ratio>=1.3||ratio<=0.7)m.dimmed=1;       // the knob changed how bright the ring is
  }
  return !!m.rainbow&&!!m.dimmed;
 },
 readouts:s=>{
  const r=extOf(s,'ws2812-strip'),rid=extId(s,'ws2812-strip'),e=extOf(s,'rotary-encoder-ky040'),eid=extId(s,'rotary-encoder-ky040');
  const out:{target:string;text:string}[]=[];
  if(r&&rid&&typeof r.leds==='string'&&Number(r.frames)>0){const st=ringStats(r.leds);out.push(pill(rid,`${st.lit} LEDs · peak ${Math.round(st.avg)}`));}
  if(e&&eid)out.push(pill(eid,`${Number(e.steps)} detents`));
  return out;
 },
 thumbnail:[{kind:'ws2812-strip',props:{shape:'ring'},x:0},{kind:'rotary-encoder-ky040',x:46}],
 title:c('Rainbow pixels','Piksel pelangi'),tagline:c('A WS2812 ring animated with a rotary knob.','Cincin WS2812 beranimasi dengan kenop putar.'),
 overview:{body:c('A WS2812 LED has its own tiny chip. The whole ring hangs on one wire: the sketch sends 24 bits per LED (green, red, blue) at 800 kHz, and each LED keeps the first 24 bits and passes the rest on. A bit is a pulse of 0.4 us for a 0 or 0.8 us for a 1, so the sketch times it with two assembly instructions per edge. To make a rainbow it spreads a colour wheel over the 16 LEDs and moves it a little every frame. The rotary knob is read with a tiny state machine: two square waves a quarter cycle apart, and the one that leads tells you the direction. Turn the knob to change the brightness and push it for the next animation.','LED WS2812 punya chip kecil sendiri. Seluruh cincin tergantung pada satu kabel: sketsa mengirim 24 bit per LED (hijau, merah, biru) pada 800 kHz, dan tiap LED menyimpan 24 bit pertama lalu meneruskan sisanya. Satu bit adalah pulsa 0,4 us untuk 0 atau 0,8 us untuk 1, jadi sketsa mengatur waktunya dengan dua instruksi assembly per tepi. Untuk membuat pelangi, sketsa membagi roda warna ke 16 LED dan menggesernya sedikit tiap bingkai. Kenop putar dibaca dengan mesin status kecil: dua gelombang kotak berselisih seperempat siklus, dan yang mendahului menunjukkan arah. Putar kenop untuk mengubah kecerahan dan tekan untuk animasi berikutnya.'),
  bullets:[b('wave','One wire carries 16 colours at 800 kHz.','Satu kabel membawa 16 warna pada 800 kHz.'),b('chip','No library: the pulse timing and the knob decoder are ours.','Tanpa pustaka: pewaktuan pulsa dan pembaca kenop adalah milik kita.'),b('check','Four steps in one direction make one detent.','Empat langkah searah membentuk satu detent.')]},
 pinout:[pinRow('D6','Ring DIN','DIN cincin','The 800 kHz pixel stream goes out here.','Aliran piksel 800 kHz keluar dari sini.'),pinRow('D2 and D3','Knob CLK and DT','CLK dan DT kenop','Two square waves a quarter cycle apart.','Dua gelombang kotak berselisih seperempat siklus.'),pinRow('D4','Knob SW','SW kenop','Low while the knob is pushed.','Rendah saat kenop ditekan.'),pinRow('5V / GND','Power','Daya','Feeds the ring and the knob.','Memberi daya ke cincin dan kenop.')],
 walkthrough:[c('Send 16 pixels of 24 bits each, green first.','Kirim 16 piksel masing-masing 24 bit, hijau dulu.'),c('Hold the wire low for 80 us to latch the frame.','Tahan kabel rendah 80 us untuk mengunci bingkai.'),c('Spread a colour wheel over the ring and move it every frame.','Bagi roda warna ke seluruh cincin dan geser tiap bingkai.'),c('Read CLK and DT as a 2 bit code: four steps make one turn click.','Baca CLK dan DT sebagai kode 2 bit: empat langkah membuat satu klik putar.'),c('A turn changes the brightness and a push picks the next animation.','Putaran mengubah kecerahan dan tekanan memilih animasi berikutnya.')],
 specs:[sp('LEDs','LED','WS2812 ring, 16 pixels','Cincin WS2812, 16 piksel'),sp('Signal','Sinyal','800 kHz, GRB order','800 kHz, urutan GRB'),sp('Knob','Kenop','20 detents per turn, push switch','20 detent per putaran, saklar tekan'),sp('Pins','Pin','D6, D2, D3, D4')],
 callouts:[co('ring1','right','LED ring','Cincin LED','Sixteen pixels, one wire. Each takes 24 bits.','Enam belas piksel, satu kabel. Tiap piksel 24 bit.'),co('enc1','left','Rotary knob','Kenop putar','Drag round to turn, click to push.','Seret untuk memutar, klik untuk menekan.'),co('uno.digital-header','left','Pins 2, 3, 4 and 6','Pin 2, 3, 4 dan 6','Knob in, pixels out.','Kenop masuk, piksel keluar.','D6'),co('uno.mcu','top','Your timing','Waktumu','Every bit is 20 clock cycles of exact timing.','Setiap bit adalah 20 siklus clock dengan waktu tepat.')],
 params:{frameMs:{label:c('Frame time','Waktu bingkai'),unit:'ms',hint:c('Time between animation frames.','Jeda antar bingkai animasi.')},level:{label:c('Start brightness','Kecerahan awal'),unit:'',hint:c('Brightness before you touch the knob (16 to 240).','Kecerahan sebelum kenop disentuh (16 sampai 240).')}},
 goal:{text:c('See the rainbow, then turn the knob two detents or more and watch the ring get brighter or dimmer.','Lihat pelangi, lalu putar kenop dua detent atau lebih dan lihat cincin makin terang atau redup.'),hint:c('Run, click the knob and drag its position slider to 4.','Jalankan, klik kenop dan geser slider posisinya ke 4.')},
 seo:{title:'WS2812 rainbow ring with a rotary encoder',description:'Drive a 16 LED WS2812 ring from an emulated Arduino UNO and steer its brightness and animation with a rotary encoder. All drivers are our own code.'},
});
