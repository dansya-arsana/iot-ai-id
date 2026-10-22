import type {WireColor} from '../contract';
import {defineLesson,c,co,pinRow,sp,b,w,extOf,extId,pill,RAILS,SEG_PINS} from './kit';

export const lesson=defineLesson({
 id:'remote',order:160,concept:'NEC IR',keyPins:['D2','D3','D4'],recordPins:['D2'],
 circuit:{parts:[{id:'ir1',kind:'ir-receiver',net:{OUT:'D2',GND:'GND',VCC:'5V'},props:{}},{id:'seg1',kind:'seven-segment',net:{a:'D3',b:'D4',c:'D5',d:'D6',e:'D7',f:'D8',g:'D9',COM:'GND'},props:{color:'red',seriesOhms:220}}],wires:[w('ir1','OUT','D2','yellow'),...SEG_PINS.map((p,i)=>w('seg1','abcdefg'[i]!,p,(['orange','green','blue','purple','white','yellow','orange'] as WireColor[])[i]!)),...RAILS]},
 firmware:{variants:[{id:'default',params:[]}]},
 check:(s,m)=>{
  const g=extOf(s,'seven-segment');
  if(g&&typeof g.glyph==='string'&&g.glyph!=='')m['digit:'+g.glyph]=1;
  return Object.keys(m).filter(k=>k.startsWith('digit:')).length>=2;
 },
 readouts:s=>{
  const r=extOf(s,'ir-receiver'),rid=extId(s,'ir-receiver'),g=extOf(s,'seven-segment'),gid=extId(s,'seven-segment');
  const out:{target:string;text:string}[]=[];
  if(r&&rid&&Number(r.frames)>0)out.push(pill(rid,`NEC 0x${Number(r.command).toString(16).toUpperCase().padStart(2,'0')}`));
  if(g&&gid&&g.glyph!=='')out.push(pill(gid,`digit ${String(g.glyph)}`));
  return out;
 },
 thumbnail:[{kind:'ir-receiver',x:0},{kind:'seven-segment',x:30}],
 title:c('Remote control','Remote kontrol'),tagline:c('Decode an IR remote and show the key.','Baca remote IR dan tampilkan tombolnya.'),
 overview:{body:c('A TV remote flashes an infrared LED in the NEC code: a 9 ms burst, a 4.5 ms pause, then 32 bits. A 0 is a short gap and a 1 is a long gap, and each byte is followed by its inverse so the receiver can check it. The IR receiver module removes the carrier and hands the sketch a clean signal on one pin. The sketch times the gaps, checks the frame and shows the digit of the pressed key on a 7-segment display. Open the receiver and press a key.','Remote TV mengedipkan LED inframerah dengan kode NEC: semburan 9 ms, jeda 4,5 ms, lalu 32 bit. Bit 0 adalah jeda pendek dan bit 1 jeda panjang, dan tiap byte diikuti kebalikannya agar penerima bisa memeriksanya. Modul penerima IR membuang gelombang pembawa dan memberi sketsa sinyal bersih di satu pin. Sketsa mengukur jeda, memeriksa bingkai, dan menampilkan angka tombol yang ditekan di display 7-segmen. Buka penerima dan tekan tombol.'),
  bullets:[b('wave','A frame is 9 ms, 4.5 ms, then 32 bits.','Satu bingkai: 9 ms, 4,5 ms, lalu 32 bit.'),b('check','The inverted bytes catch noisy frames.','Byte terbalik menangkap bingkai yang rusak.'),b('led','A digit is seven LEDs, a to g.','Satu angka adalah tujuh LED, a sampai g.')]},
 pinout:[pinRow('D2','IR receiver OUT','OUT penerima IR','Idle high, low during bursts.','Diam tinggi, rendah saat semburan.'),pinRow('D3 - D9','Segments a to g','Segmen a sampai g','One pin per segment.','Satu pin per segmen.'),pinRow('GND','Common cathode','Katoda bersama','Ground for the digit.','Ground untuk angka.')],
 walkthrough:[c('Wait until the receiver pulls the pin low.','Tunggu sampai penerima menarik pin ke rendah.'),c('A 9 ms low then a 4.5 ms high is a valid start.','Rendah 9 ms lalu tinggi 4,5 ms adalah awal yang sah.'),c('Measure 32 gaps: more than 1.1 ms is a 1.','Ukur 32 jeda: lebih dari 1,1 ms adalah 1.'),c('Check that the command byte matches its inverse.','Periksa byte perintah cocok dengan kebalikannya.'),c('Look the key up and light its segments.','Cari tombolnya dan nyalakan segmennya.')],
 specs:[sp('Receiver','Penerima','VS1838B, 38 kHz'),sp('Code','Kode','NEC, 32 bits','NEC, 32 bit'),sp('Display','Layar','7-segment, common cathode','7-segmen, katoda bersama')],
 callouts:[co('ir1','left','IR receiver','Penerima IR','Click it and pick a key of the remote.','Klik dan pilih tombol remote.'),co('seg1','right','7-segment digit','Digit 7-segmen','Shows the digit you pressed. The 220 ohm resistors of its segments are set in its popover.','Menampilkan angka yang kamu tekan. Resistor 220 ohm tiap segmen diatur di popover-nya.'),co('uno.digital-header','left','Pin 2 and 3-9','Pin 2 dan 3-9','The receiver in, the segments out.','Penerima masuk, segmen keluar.','D2'),co('uno.mcu','top','Your timing','Waktumu','Measures every gap of the code.','Mengukur setiap jeda kode.')],
 params:{},
 goal:{text:c('Press two different digits and see each one on the display.','Tekan dua angka berbeda dan lihat masing-masing di display.'),hint:c('Run, click the receiver and pick keys 3 and 7.','Jalankan, klik penerima dan pilih tombol 3 dan 7.')},
 seo:{title:'IR remote control to a 7-segment digit',description:'Decode an NEC infrared remote and show the pressed digit on a 7-segment display with an emulated Arduino UNO. The decoder is our own code.'},
});
