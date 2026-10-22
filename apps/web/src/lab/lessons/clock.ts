import {defineLesson,c,co,pinRow,sp,b,w,P,byKind,extOf,extId,idOf,pill,RAILS} from './kit';
import type {ExtV} from './kit';

/** The 3 x 5 digit glyphs the sketch draws (one row per entry, bit 2 = left column). Written here on purpose, so a typo in the sketch fails the goal. */
const DIGITS=[[7,5,5,5,7],[2,6,2,2,7],[7,1,7,4,7],[7,1,7,1,7],[5,5,7,1,1],[7,4,7,1,7],[7,4,7,5,7],[7,1,1,1,1],[7,5,7,5,7],[7,5,7,1,7]];
const DIGIT_COLS=[2,6,12,16,22,26];
const COLON_COLS=[10,20];

/**
 * Read "HH:MM:SS" back from the frame of the four-matrix chain (hex string, 16 chars per module, module 0 on the left, row 0 first, bit 7 = left dot).
 * The glyphs sit on rows 1 to 5. Returns null when the picture is not a clock face.
 */
export function readClockFace(fb:string):string|null{
 if(fb.length<64)return null;
 const dot=(row:number,col:number):number=>{
  const byte=parseInt(fb.substr(((col>>3)*8+row)*2,2),16);
  return (byte>>(7-(col&7)))&1;
 };
 let out='';
 for(let i=0;i<6;i++){
  const col=DIGIT_COLS[i]!;
  let found=-1;
  for(let d=0;d<10&&found<0;d++){
   let ok=true;
   for(let r=0;r<5&&ok;r++)for(let k=0;k<3;k++)if(dot(r+1,col+k)!==((DIGITS[d]![r]!>>(2-k))&1)){ok=false;break;}
   if(ok)found=d;
  }
  if(found<0)return null;
  out+=found;
  if(i===1||i===3)out+=':';
 }
 for(const col of COLON_COLS)if(!dot(2,col)||!dot(4,col))return null;
 return out;
}
const clockOf=(s:Parameters<typeof extOf>[0]):{rtc:ExtV;face:string|null;time:string}|null=>{
 const r=extOf(s,'ds3231-rtc'),mx=extOf(s,'max7219-matrix');
 if(!r||!mx)return null;
 return {rtc:r,face:readClockFace(String(mx.fb??'')),time:String(r.time??'').slice(11,19)};
};

export const lesson=defineLesson({
 id:'clock',order:240,view:{az:0,elev:62,board:true},concept:'RTC',keyPins:['A4','D2','D11','D8'],recordPins:['D2','D8'],
 circuit:{
  parts:[
   {id:'rtc1',kind:'ds3231-rtc',net:{VCC:'5V',GND:'GND',SDA:'A4',SCL:'A5',SQW:'D2'},props:{lostPower:true}},
   {id:'mx1',kind:'max7219-matrix',net:{VCC:'5V',GND:'GND',DIN:'D11',CS:'D10',CLK:'D13'},props:{modules:'4'}},
   {id:'bz1',kind:'buzzer',net:{'+':'D8','-':'GND'},props:{}},
  ],
  wires:[w('rtc1','SDA','A4','blue'),w('rtc1','SCL','A5','purple'),w('rtc1','SQW','D2','yellow'),w('mx1','DIN','D11','green'),w('mx1','CS','D10','orange'),w('mx1','CLK','D13','white'),w('mx1','VCC','5V','red'),w('mx1','GND','GND','black'),w('bz1','+','D8','orange'),w('bz1','-','GND','black'),...RAILS],
 },
 firmware:{variants:[{id:'default',params:[P('alarmAfter','uint8',6,3,50,1),P('beepMs','uint16',2500,1000,6000,500)]}]},
 check:(s,m)=>{
  const k=clockOf(s),bz=byKind(s,'buzzer');
  if(!k)return false;
  // 1. the matrix really shows the time the DS3231 keeps
  if(k.face!==null&&k.face===k.time)m.shown=1;
  // 2. the alarm pulled INT/SQW low, and while it was low the buzzer made sound
  if(k.rtc.intLow===true){m.int=1;if(bz&&bz.on&&bz.freqHz>0)m.ring=1;}
  return !!m.shown&&!!m.int&&!!m.ring;
 },
 readouts:s=>{
  const k=clockOf(s),rid=extId(s,'ds3231-rtc'),bz=byKind(s,'buzzer'),bid=idOf(s,'buzzer');
  const out:{target:string;text:string}[]=[];
  if(k&&rid)out.push(pill(rid,k.rtc.intLow===true?`${k.time} · ALARM`:k.time));
  if(bz&&bid&&bz.on)out.push(pill(bid,`♪ ${Math.round(bz.freqHz)} Hz`));
  return out;
 },
 thumbnail:[{kind:'ds3231-rtc',x:0},{kind:'max7219-matrix',props:{modules:'4'},x:34}],
 title:c('Real-time clock','Jam waktu nyata'),tagline:c('Keep the time and ring an alarm.','Simpan waktu dan bunyikan alarm.'),
 overview:{body:c('An Arduino forgets the time the moment it loses power, so a clock chip keeps it. The DS3231 counts seconds on its own and answers over I2C at address 0x68; it stores the time as BCD digits, two per byte. This sketch reads seconds, minutes and hours every 50 ms and draws them on four chained MAX7219 matrices with its own 3 by 5 font. It also sets alarm 1 a few seconds ahead. When the clock reaches that second the chip pulls its INT pin low, and the sketch rings the buzzer until it clears the alarm flag. A fresh chip says its time cannot be trusted (the OSF flag), so the sketch sets 07:30:00 first. Use the popover of the clock to say the backup battery is fine and the sketch keeps the time the chip already has.','Arduino lupa waktu begitu dayanya hilang, jadi chip jam yang menyimpannya. DS3231 menghitung detik sendiri dan menjawab lewat I2C di alamat 0x68; waktu disimpan sebagai angka BCD, dua per byte. Sketsa ini membaca detik, menit, dan jam tiap 50 ms lalu menggambarnya di empat matriks MAX7219 yang dirantai dengan font 3 x 5 buatan sendiri. Sketsa juga mengatur alarm 1 beberapa detik ke depan. Saat jam sampai ke detik itu, chip menarik pin INT ke rendah dan sketsa membunyikan buzzer sampai flag alarm dihapus. Chip baru bilang waktunya tak bisa dipercaya (flag OSF), jadi sketsa mengatur 07:30:00 dulu. Pakai popover jam untuk menyatakan baterai cadangan baik, maka sketsa memakai waktu yang sudah ada di chip.'),
  bullets:[b('clock','The chip counts seconds by itself.','Chip menghitung detik sendiri.'),b('wave','I2C reads the time, SPI draws it.','I2C membaca waktu, SPI menggambarnya.'),b('bell','Alarm 1 pulls INT low until you clear it.','Alarm 1 menarik INT ke rendah sampai kamu menghapusnya.')]},
 pinout:[pinRow('A4','SDA (data)','SDA (data)','I2C data to the clock chip.','Data I2C ke chip jam.'),pinRow('A5','SCL (clock)','SCL (clock)','I2C clock from the board.','Clock I2C dari papan.'),pinRow('D2','Clock SQW / INT','SQW / INT jam','Goes low while the alarm flag is set.','Rendah selama flag alarm aktif.'),pinRow('D11 D13 D10','Matrix DIN CLK CS','DIN CLK CS matriks','SPI data, clock and chip select for the display.','Data SPI, clock, dan chip select untuk layar.'),pinRow('D8','Buzzer','Buzzer','Tone output for the alarm.','Keluaran nada untuk alarm.')],
 walkthrough:[c('Read register 0x0F: if the OSF bit is set, write 07:30:00 into registers 0x00 to 0x06.','Baca register 0x0F: jika bit OSF aktif, tulis 07:30:00 ke register 0x00 sampai 0x06.'),c('Read the time, add alarmAfter seconds and write that into alarm 1 (registers 0x07 to 0x0A), then turn on A1IE.','Baca waktu, tambah alarmAfter detik dan tulis ke alarm 1 (register 0x07 sampai 0x0A), lalu nyalakan A1IE.'),c('Every 50 ms read seconds, minutes and hours, turn BCD into numbers and draw them as dots with SPI.','Tiap 50 ms baca detik, menit, dan jam, ubah BCD jadi angka lalu gambar sebagai titik lewat SPI.'),c('When D2 reads LOW the alarm fired: brighten the display and beep with tone().','Saat D2 terbaca LOW alarm menyala: terangkan layar dan bunyikan tone().'),c('After beepMs write 0 to register 0x0F to clear the flag; the chip releases D2.','Setelah beepMs tulis 0 ke register 0x0F untuk menghapus flag; chip melepas D2.')],
 specs:[sp('Clock','Jam','DS3231, I2C 0x68'),sp('Display','Layar','4 x MAX7219 8x8, SPI','4 x MAX7219 8x8, SPI'),sp('Alarm','Alarm','Alarm 1: hours, minutes, seconds','Alarm 1: jam, menit, detik')],
 callouts:[co('rtc1','top','DS3231 clock','Jam DS3231','Click it to say the backup battery is fine, or change its temperature.','Klik untuk menyatakan baterai cadangan baik, atau ubah suhunya.'),co('mx1','top','Four matrices','Empat matriks','The sketch sends the picture row by row, farthest chip first.','Sketsa mengirim gambar baris demi baris, chip terjauh dulu.'),co('bz1','right','Alarm buzzer','Buzzer alarm','Beeps while the clock holds INT low.','Berbunyi selama jam menahan INT rendah.'),co('uno.digital-header','left','D2 is INT','D2 adalah INT','The chip pulls it low when alarm 1 matches.','Chip menariknya ke rendah saat alarm 1 cocok.','D2')],
 params:{alarmAfter:{label:c('Alarm after','Alarm setelah'),unit:'s',hint:c('Seconds from start until the alarm time.','Detik dari mulai sampai waktu alarm.')},beepMs:{label:c('Ring for','Berbunyi'),unit:'ms',hint:c('How long the buzzer rings before the flag is cleared.','Berapa lama buzzer berbunyi sebelum flag dihapus.')}},
 goal:{text:c('See the time on the matrix, then hear the alarm ring when the clock hits the alarm time.','Lihat waktu di matriks, lalu dengar alarm berbunyi saat jam mencapai waktu alarm.'),hint:c('Run and wait a few seconds. Lower alarmAfter to hear it sooner.','Jalankan dan tunggu beberapa detik. Kecilkan alarmAfter agar lebih cepat.')},
 seo:{title:'DS3231 clock on a MAX7219 matrix with an alarm',description:'Read a DS3231 real-time clock over I2C, draw the time on four MAX7219 matrices and ring an alarm buzzer on its INT pin, with an emulated Arduino UNO.'},
});
