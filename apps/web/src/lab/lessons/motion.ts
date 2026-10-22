import {defineLesson,c,co,pinRow,sp,b,w,P,extOf,extId,pill,RAILS} from './kit';

export const lesson=defineLesson({
 id:'motion',order:140,concept:'RELAY',keyPins:['D2','D7'],recordPins:['D2','D7'],
 circuit:{parts:[{id:'rel1',kind:'relay-module',net:{VCC:'5V',GND:'GND',IN:'D7'},props:{trigger:'low'}},{id:'pir1',kind:'pir-hc-sr501',net:{VCC:'5V',OUT:'D2',GND:'GND'},props:{warmupS:2,holdS:1,retrigger:'H'}},{id:'bulb1',kind:'load-lamp',net:{},props:{target:'rel1'}}],wires:[w('pir1','OUT','D2','yellow'),w('rel1','IN','D7','orange'),...RAILS]},
 firmware:{variants:[{id:'default',params:[P('holdMs','uint16',3000,500,10000,500)]}]},
 check:(s,m)=>{
  const r=extOf(s,'relay-module');
  if(!r)return false;
  if(r.energized===true)m.closed=1;
  return !!m.closed&&r.energized===false;   // the contact closed on motion and opened again after the hold time
 },
 readouts:s=>{
  const p=extOf(s,'pir-hc-sr501'),pid=extId(s,'pir-hc-sr501'),r=extOf(s,'relay-module'),rid=extId(s,'relay-module');
  const out:{target:string;text:string}[]=[];
  if(p&&pid)out.push(pill(pid,p.phase==='warmup'?`settling ${Number(p.warmLeftS).toFixed(0)} s`:p.out===true?'motion: OUT high':'OUT low'));
  if(r&&rid)out.push(pill(rid,r.energized===true?'COM → NO · lamp on':'COM → NC · lamp off'));
  return out;
 },
 thumbnail:[{kind:'pir-hc-sr501',x:0},{kind:'relay-module',x:46}],
 title:c('Motion light','Lampu gerak'),tagline:c('A PIR wakes a relay that powers a lamp.','PIR membangunkan relay yang menyalakan lampu.'),
 overview:{body:c('A PIR sensor sees heat moving across its view and raises its OUT wire. A pin can not power a lamp, so the sketch drives a relay: a small electromagnet that closes a switch with its own supply. Many boards switch on LOW, so pulling the relay input low turns the lamp on. The sketch keeps the lamp on for a hold time after the last movement, so it does not flicker. Tick Motion in view on the sensor, then clear it and wait.','Sensor PIR melihat panas yang bergerak di depannya dan menaikkan kabel OUT. Satu pin tidak sanggup menyalakan lampu, jadi sketsa menggerakkan relay: elektromagnet kecil yang menutup saklar dengan catu sendiri. Banyak modul aktif saat LOW, jadi menarik input relay ke rendah menyalakan lampu. Sketsa menjaga lampu tetap menyala selama waktu tahan setelah gerakan terakhir, agar tidak berkedip. Centang Ada gerakan di sensor, lalu hapus dan tunggu.'),
  bullets:[b('eye','The PIR needs a few seconds to settle after power-up.','PIR butuh beberapa detik untuk stabil setelah dinyalakan.'),b('gear','The relay isolates the lamp from the Arduino.','Relay memisahkan lampu dari Arduino.'),b('loop','Each new movement restarts the hold timer.','Tiap gerakan baru mengulang timer tahan.')]},
 pinout:[pinRow('D2','PIR OUT','OUT PIR','High while it sees motion.','Tinggi saat melihat gerakan.'),pinRow('D7','Relay IN','IN relay','LOW closes the contact.','LOW menutup kontak.'),pinRow('5V','Power','Daya','Feeds the PIR and the relay coil.','Memberi daya ke PIR dan kumparan relay.')],
 walkthrough:[c('Keep the relay input HIGH (off) before the pin becomes an output.','Jaga input relay HIGH (mati) sebelum pin menjadi output.'),c('Read the PIR: HIGH means motion.','Baca PIR: HIGH berarti ada gerakan.'),c('On motion, remember the time and pull the relay LOW.','Saat ada gerakan, catat waktunya dan tarik relay ke LOW.'),c('When holdMs have passed without motion, release the relay.','Setelah holdMs lewat tanpa gerakan, lepas relay.')],
 specs:[sp('Sensor','Sensor','HC-SR501 PIR'),sp('Switch','Saklar','1-channel relay, active low','Relay 1 kanal, aktif low'),sp('Pins','Pin','D2, D7')],
 callouts:[co('pir1','left','PIR sensor','Sensor PIR','Click it and tick Motion in view.','Klik dan centang Ada gerakan.'),co('rel1','top','Relay','Relay','Hear the click: COM joins NO.','Dengar kliknya: COM tersambung ke NO.'),co('bulb1','right','Lamp','Lampu','Powered through the relay contact, not by the Arduino.','Dayanya lewat kontak relay, bukan dari Arduino.'),co('uno.digital-header','left','Pins 2 and 7','Pin 2 dan 7','PIR in, relay out.','PIR masuk, relay keluar.','D7')],
 params:{holdMs:{label:c('Hold time','Waktu tahan'),unit:'ms',hint:c('How long the lamp stays on after the last movement.','Berapa lama lampu menyala setelah gerakan terakhir.')}},
 goal:{text:c('Switch the lamp on with motion and watch it switch off again.','Nyalakan lampu dengan gerakan dan lihat ia mati lagi.'),hint:c('Run, click the PIR, tick Motion in view, then untick it and wait.','Jalankan, klik PIR, centang Ada gerakan, lalu hapus centang dan tunggu.')},
 seo:{title:'Motion light with a PIR and a relay',description:'Switch a lamp with a PIR motion sensor and a relay module on an emulated Arduino UNO. Tune the hold time and hear the relay click.'},
});
