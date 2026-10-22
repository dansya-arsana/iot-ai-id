import {defineLesson,c,co,pinRow,sp,b,w,P,byKind,extOf,extId,idOf,pill,RAILS} from './kit';

/** UIDs of the two cards the sketch allows (the white card and the sticker tag); the blue key fob is refused. */
const GRANTED=['4ba21f93','046ab12c5f7180'];
const DENIED='07c56e2d';

export const lesson=defineLesson({
 id:'rfid-door',order:190,concept:'RFID',keyPins:['D10','D13','D11','D12'],recordPins:['D10','D4'],
 circuit:{
  parts:[
   {id:'rc1',kind:'rc522-rfid',net:{SDA:'D10',SCK:'D13',MOSI:'D11',MISO:'D12',RST:'D9',GND:'GND'},props:{card:'none'}},
   {id:'sv1',kind:'servo',net:{SIG:'D6',V:'5V',GND:'GND'},props:{}},
   {id:'rel1',kind:'relay-module',net:{VCC:'5V',GND:'GND',IN:'D4'},props:{trigger:'low',deskX:-62}},
   {id:'bulb1',kind:'load-lamp',net:{},props:{target:'rel1'}},
  ],
  wires:[
   w('rc1','SDA','D10','yellow'),w('rc1','SCK','D13','orange'),w('rc1','MOSI','D11','green'),w('rc1','MISO','D12','blue'),w('rc1','RST','D9','purple'),
   w('rc1','3V3','3V3','red'),w('rc1','GND','GND','black'),
   w('sv1','SIG','D6','orange'),w('rel1','IN','D4','white'),
   ...RAILS,
  ],
 },
 firmware:{variants:[{id:'default',params:[P('unlockMs','uint16',3000,1000,8000,500),P('openDeg','uint8',90,90,180,10)]}]},
 check:(s,m)=>{
  const rc=extOf(s,'rc522-rfid'),rel=extOf(s,'relay-module'),sv=byKind(s,'servo');
  if(!rc||!rel||!sv)return false;
  const open=sv.angleDeg>=80&&rel.energized===true;
  const shut=sv.angleDeg<10&&rel.energized===false;
  if(open&&GRANTED.includes(String(rc.uid)))m.opened=1;
  if(m.opened&&shut)m.relocked=1;
  if(shut&&rc.uid===DENIED&&rc.cardState==='halt')m.denied=1;   // the fob was read to the end and the door never moved
  return m.relocked===1&&m.denied===1;
 },
 readouts:s=>{
  const rc=extOf(s,'rc522-rfid'),rid=extId(s,'rc522-rfid'),sv=byKind(s,'servo'),svid=idOf(s,'servo');
  const out:{target:string;text:string}[]=[];
  if(rc&&rid&&rc.uid!=='')out.push(pill(rid,`UID ${String(rc.uid).toUpperCase()}`));
  if(sv&&svid)out.push(pill(svid,sv.angleDeg>=80?'open':sv.angleDeg<10?'locked':`${Math.round(sv.angleDeg)}°`));
  return out;
 },
 thumbnail:[{kind:'rc522-rfid',x:0},{kind:'servo',x:40}],
 title:c('RFID door','Pintu RFID'),tagline:c('An allow-list of card numbers opens a servo lock and a relay.','Daftar kartu yang diizinkan membuka kunci servo dan relay.'),
 overview:{body:c('The RC522 reader talks to the Arduino over SPI. Every card carries a serial number (a UID). The sketch asks the reader for the card in range, reads its UID through the anti-collision steps, and compares it with a short allow-list in the code. A known card turns the servo to the open position and closes the relay contact, so a lamp lights. After the unlock time the door locks again. An unknown card is only logged as denied. Open the reader, hold a card over it, then take it away before trying the next one.','Pembaca RC522 bicara dengan Arduino lewat SPI. Setiap kartu membawa nomor seri (UID). Sketsa meminta kartu yang ada di jangkauan, membaca UID-nya lewat langkah anti-tabrakan, lalu mencocokkannya dengan daftar izin pendek di kode. Kartu yang dikenal memutar servo ke posisi terbuka dan menutup kontak relay, sehingga lampu menyala. Setelah waktu buka habis, pintu terkunci lagi. Kartu yang tidak dikenal hanya dicatat sebagai ditolak. Buka pembaca, tahan kartu di atasnya, lalu angkat sebelum mencoba kartu berikutnya.'),
  bullets:[b('chip','SPI carries the reader registers.','SPI membawa register pembaca.'),b('check','The allow-list is plain data in the sketch.','Daftar izin hanyalah data di sketsa.'),b('gear','Servo and relay follow the same decision.','Servo dan relay mengikuti keputusan yang sama.')]},
 pinout:[
  pinRow('D10','RC522 SDA (chip select)','SDA RC522 (chip select)','Low while the sketch talks to the reader.','Rendah saat sketsa bicara ke pembaca.'),
  pinRow('D11 D12 D13','SPI MOSI, MISO, SCK','SPI MOSI, MISO, SCK','Data out, data in and clock.','Data keluar, data masuk, dan clock.'),
  pinRow('D9','RC522 reset','Reset RC522','Pulsed low once at start-up.','Ditarik rendah sekali saat mulai.'),
  pinRow('D6','Servo signal','Sinyal servo','Pulse that sets the lock angle.','Pulsa yang mengatur sudut kunci.'),
  pinRow('D4','Relay IN','IN relay','Low closes the contact (active low).','Rendah menutup kontak (aktif rendah).'),
  pinRow('3V3','Reader supply','Daya pembaca','The RC522 needs 3.3 V, never 5 V.','RC522 butuh 3,3 V, jangan 5 V.'),
 ],
 walkthrough:[
  c('Reset the reader, switch the antenna on and check its version register.','Reset pembaca, nyalakan antena, dan periksa register versinya.'),
  c('Send REQA. A card in range answers with its type code.','Kirim REQA. Kartu di jangkauan menjawab dengan kode jenisnya.'),
  c('Anti-collision and SELECT give the UID. A 7-byte UID needs a second round.','Anti-tabrakan dan SELECT memberi UID. UID 7 byte butuh putaran kedua.'),
  c('Compare the UID with the allow-list, byte by byte.','Cocokkan UID dengan daftar izin, byte demi byte.'),
  c('If it matches, move the servo and pull the relay input low for unlockMs.','Jika cocok, gerakkan servo dan tarik input relay rendah selama unlockMs.'),
 ],
 specs:[sp('Reader','Pembaca','MFRC522, 13.56 MHz'),sp('Bus','Bus','SPI mode 0, 4 MHz'),sp('Cards','Kartu','ISO 14443-A, 4 and 7 byte UID','ISO 14443-A, UID 4 dan 7 byte'),sp('Supply','Daya','3.3 V reader, 5 V servo and relay','3,3 V pembaca, 5 V servo dan relay')],
 callouts:[
  co('rc1','left','RFID reader','Pembaca RFID','Click it and hold a card over the antenna.','Klik dan tahan kartu di atas antena.'),
  co('sv1','right','Servo lock','Kunci servo','Turns to the open angle for a known card.','Berputar ke sudut terbuka untuk kartu yang dikenal.'),
  co('rel1','top','Relay','Relay','Closes while the door is open.','Menutup selama pintu terbuka.'),
  co('uno.digital-header','left','SPI pins','Pin SPI','D10 chip select, D11 to D13 data and clock.','D10 chip select, D11 sampai D13 data dan clock.','D10'),
  co('uno.mcu','top','Your allow-list','Daftar izinmu','The chip compares each UID with its list.','Chip mencocokkan tiap UID dengan daftarnya.'),
 ],
 params:{
  unlockMs:{label:c('Unlock time','Waktu terbuka'),unit:'ms',hint:c('How long the door stays open.','Berapa lama pintu terbuka.')},
  openDeg:{label:c('Open angle','Sudut terbuka'),unit:'deg',hint:c('Servo angle of the open position.','Sudut servo posisi terbuka.')},
 },
 goal:{text:c('Open the door with an allowed card and let it lock again, then try the blue key fob and see it refused.','Buka pintu dengan kartu yang diizinkan dan biarkan terkunci lagi, lalu coba gantungan biru dan lihat ditolak.'),hint:c('Run, open the reader, pick the white card, wait, pick No card, then pick the blue key fob.','Jalankan, buka pembaca, pilih kartu putih, tunggu, pilih Tanpa kartu, lalu pilih gantungan biru.')},
 seo:{title:'RFID door lock with an RC522 and Arduino',description:'Read card UIDs with an RC522 on SPI, check an allow-list and open a servo lock and relay in an emulated Arduino UNO. The driver is our own code.'},
});
