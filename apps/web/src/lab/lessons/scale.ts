import {defineLesson,c,co,pinRow,sp,b,w,P,extOf,extId,pill,RAILS} from './kit';

/** The number the TM1637 shows (blank digits ignored, a left minus sign kept), or NaN while it shows letters or dashes. */
const shownGrams=(text:string):number=>/^ *-?\d+$/.test(text)?parseInt(text.replace(/ /g,''),10):NaN;

export const lesson=defineLesson({
 id:'scale',order:230,concept:'HX711',keyPins:['D4','D5'],recordPins:['D4','D5','D8'],
 circuit:{
  parts:[
   {id:'hx1',kind:'hx711-loadcell',net:{GND:'GND',DT:'D5',SCK:'D4',VCC:'5V'},props:{weight:0,capacity:'5'}},
   {id:'disp1',kind:'tm1637-4digit',net:{CLK:'D8',DIO:'D9',VCC:'5V',GND:'GND'},props:{}},
   {id:'btn1',kind:'button',net:{'1':'5V','2':'D2'},props:{pull:'down'}},
   {id:'r2',kind:'resistor',net:{'1':'D2','2':'GND'},props:{ohms:10000,role:'pull-down'}},
  ],
  wires:[w('hx1','DT','D5','yellow'),w('hx1','SCK','D4','green'),w('hx1','VCC','5V','red'),w('hx1','GND','GND','black'),w('disp1','CLK','D8','blue'),w('disp1','DIO','D9','purple'),w('btn1','2','D2','orange'),...RAILS],
 },
 firmware:{variants:[{id:'default',params:[P('countsPer10g','uint16',4295,500,10000,5),P('averages','uint8',4,1,16,1)]}]},
 check:(s,m)=>{
  const h=extOf(s,'hx711-loadcell'),d=extOf(s,'tm1637-4digit');
  if(!h||!d)return false;
  const grams=Number(h.weight),n=shownGrams(String(d.text));
  if(!Number.isFinite(n)||grams<200)return false;
  // 1) the display follows the weight on the bar (within 2 %), 2) with weight still on, the tare button brought it back to zero
  if(Math.abs(n-grams)<=Math.max(2,grams*0.02))m.shown=1;
  if(m.shown&&n===0)m.tared=1;
  return !!m.shown&&!!m.tared;
 },
 readouts:s=>{
  const h=extOf(s,'hx711-loadcell'),id=extId(s,'hx711-loadcell'),d=extOf(s,'tm1637-4digit'),did=extId(s,'tm1637-4digit');
  const out:{target:string;text:string}[]=[];
  if(h&&id&&h.powered)out.push(pill(id,`${Math.round(Number(h.weight))} g on the bar`));
  if(d&&did&&d.on)out.push(pill(did,`shows ${String(d.text).trim()||'blank'}`));
  return out;
 },
 thumbnail:[{kind:'hx711-loadcell',x:-10},{kind:'tm1637-4digit',x:18}],
 title:c('Kitchen scale','Timbangan dapur'),tagline:c('Weigh with a load cell, zero it with a button, read grams.','Timbang dengan sel beban, nolkan dengan tombol, baca gram.'),
 overview:{
  body:c('A load cell is a metal bar with strain gauges glued on. Press on it and it bends a hair, so the gauges change their resistance and the bridge makes a tiny voltage, at most 1 mV for each volt of supply. The HX711 chip amplifies that voltage 128 times and converts it into a 24-bit number. The chip has its own two-wire protocol: when DT goes LOW a reading is ready, then the sketch pulses SCK 24 times to shift the bits out, MSB first, plus a 25th pulse to choose the gain. The raw number is not grams yet. The sketch remembers the raw value of the empty scale (the tare), subtracts it, and divides by a calibration factor of about 429.5 counts per gram for a 5 kg bar. Finally it sends the grams to a TM1637 display, which has its own two-wire bus with START, STOP and an ACK after each byte. Open the load cell and slide the weight, then put a bowl on it and press the button to start from zero.','Sel beban adalah batang logam dengan strain gauge yang ditempel. Saat ditekan, batang melengkung sedikit, hambatan gauge berubah, dan jembatan menghasilkan tegangan sangat kecil, paling banyak 1 mV untuk tiap volt catu. Chip HX711 menguatkannya 128 kali dan mengubahnya menjadi angka 24 bit. Chip ini punya protokol dua kabel sendiri: saat DT LOW, bacaan siap, lalu sketsa mendenyutkan SCK 24 kali untuk menggeser bit keluar, MSB dulu, ditambah denyut ke-25 untuk memilih gain. Angka mentah itu belum gram. Sketsa mengingat nilai mentah timbangan kosong (tare), menguranginya, lalu membaginya dengan faktor kalibrasi sekitar 429,5 hitungan per gram untuk batang 5 kg. Terakhir gramnya dikirim ke tampilan TM1637, yang punya bus dua kabel sendiri dengan START, STOP, dan ACK setelah tiap byte. Buka sel beban dan geser beratnya, lalu taruh mangkuk dan tekan tombol untuk mulai dari nol.'),
  bullets:[b('scale','Full scale is 1 mV per volt, so 5 kg on a 5 kg bar gives about 5 mV.','Skala penuh 1 mV per volt, jadi 5 kg pada batang 5 kg memberi sekitar 5 mV.'),b('hash','The raw reading is 24 bits, two\'s complement, MSB first.','Bacaan mentah 24 bit, komplemen dua, MSB dulu.'),b('hand','Tare = remember the raw value now and subtract it later.','Tare = ingat nilai mentah sekarang dan kurangkan nanti.')],
 },
 pinout:[
  pinRow('D5','HX711 DT','DT HX711','Input: LOW means a reading is ready, then it carries the bits.','Input: LOW berarti bacaan siap, lalu membawa bit-bit.'),
  pinRow('D4','HX711 SCK','SCK HX711','Output: 24 clocks read the bits, the 25th picks gain 128.','Output: 24 clock membaca bit, ke-25 memilih gain 128.'),
  pinRow('D8 / D9','TM1637 CLK / DIO','CLK / DIO TM1637','Two-wire bus to the display.','Bus dua kabel ke tampilan.'),
  pinRow('D2','Tare button','Tombol tare','Input with a pull-down: HIGH while pressed.','Input dengan pull-down: HIGH saat ditekan.'),
 ],
 walkthrough:[
  c('Wait for DT to go LOW: the HX711 has a new reading.','Tunggu DT turun LOW: HX711 punya bacaan baru.'),
  c('Pulse SCK 24 times and read DT after each rising edge, then pulse once more for gain 128.','Denyutkan SCK 24 kali dan baca DT tiap tepi naik, lalu sekali lagi untuk gain 128.'),
  c('Average a few readings, subtract the tare offset and scale by countsPer10g.','Rata-ratakan beberapa bacaan, kurangi offset tare dan skalakan dengan countsPer10g.'),
  c('A press of the button stores the current raw value as the new zero.','Tekan tombol menyimpan nilai mentah saat ini sebagai nol baru.'),
  c('Send the digits to the TM1637 with a data command, an address command and four segment bytes.','Kirim digit ke TM1637 dengan perintah data, perintah alamat, dan empat byte segmen.'),
 ],
 specs:[sp('Bar','Batang','5 kg load cell, 1 mV/V'),sp('Converter','Konverter','HX711, 24 bit, gain 128, 10 readings/s'),sp('Display','Tampilan','TM1637, 4 digits'),sp('Pins','Pin','D2, D4, D5, D8, D9')],
 callouts:[
  co('hx1','right','Load cell + HX711','Sel beban + HX711','Click it and slide the weight in grams.','Klik dan geser berat dalam gram.'),
  co('disp1','top','TM1637 display','Tampilan TM1637','Shows the grams the sketch worked out.','Menampilkan gram hasil hitungan sketsa.'),
  co('btn1','left','Tare button','Tombol tare','Press it to make the weight on the bar read zero.','Tekan agar berat di batang terbaca nol.'),
  co('uno.digital-header','top','D4 and D5','D4 dan D5','SCK out, DT in: the HX711 bus.','SCK keluar, DT masuk: bus HX711.','D4'),
 ],
 params:{
  countsPer10g:{label:c('Counts per 10 grams','Hitungan per 10 gram'),unit:'counts',hint:c('Calibration factor. A 5 kg bar at 5 V gives about 4295 (429.5 per gram); change it and every reading scales.','Faktor kalibrasi. Batang 5 kg pada 5 V memberi sekitar 4295 (429,5 per gram); ubah dan semua bacaan ikut berubah.')},
  averages:{label:c('Readings averaged','Bacaan dirata-rata'),unit:'x',hint:c('How many chip readings make one displayed value. More is calmer but slower.','Berapa bacaan chip untuk satu nilai tampil. Lebih banyak lebih tenang tapi lebih lambat.')},
 },
 goal:{text:c('Put a weight on the scale and see its grams, then press tare so the display reads zero with the weight still on.','Taruh beban di timbangan dan lihat gramnya, lalu tekan tare agar tampilan terbaca nol saat beban masih di atas.'),hint:c('Run, click the load cell and slide the weight to at least 200 g, then click the tare button.','Jalankan, klik sel beban dan geser berat sedikitnya 200 g, lalu klik tombol tare.')},
 seo:{title:'Kitchen scale with HX711 load cell and TM1637',description:'Build a digital kitchen scale on an emulated Arduino UNO: read an HX711 load cell, tare with a button and show grams on a TM1637 display.'},
});
