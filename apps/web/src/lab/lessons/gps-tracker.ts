import {defineLesson,c,co,pinRow,sp,b,w,P,RAILS,changes,extOf,extId,pill} from './kit';

/** The 5x7 glyphs the sketch draws that a goal needs to read back (digits, point, dash, space, hemisphere letters). Columns, bit 0 on top. */
const GLYPHS:Record<string,number[]>={
 '0':[0x3E,0x51,0x49,0x45,0x3E],'1':[0x00,0x42,0x7F,0x40,0x00],'2':[0x42,0x61,0x51,0x49,0x46],'3':[0x21,0x41,0x45,0x4B,0x31],'4':[0x18,0x14,0x12,0x7F,0x10],
 '5':[0x27,0x45,0x45,0x45,0x39],'6':[0x3C,0x4A,0x49,0x49,0x30],'7':[0x01,0x71,0x09,0x05,0x03],'8':[0x36,0x49,0x49,0x49,0x36],'9':[0x06,0x49,0x49,0x29,0x1E],
 '.':[0x00,0x60,0x60,0x00,0x00],'-':[0x08,0x08,0x08,0x08,0x08],' ':[0,0,0,0,0],N:[0x7F,0x04,0x08,0x10,0x7F],S:[0x46,0x49,0x49,0x49,0x31],E:[0x7F,0x49,0x49,0x49,0x41],W:[0x3F,0x40,0x38,0x40,0x3F],
};
/** Text of one 14-cell row (bank) of the Nokia 5110 frame buffer (84 x 6 bytes as hex). Unknown cells read as '?'. */
export function nokiaRow(fb:string,bank:number):string{
 let out='';
 for(let k=0;k<14;k++){
  const cols:number[]=[];
  for(let i=0;i<5;i++){const at=(bank*84+k*6+i)*2;cols.push(parseInt(fb.slice(at,at+2),16)||0);}
  const hit=Object.entries(GLYPHS).find(([,g])=>g.every((v,i)=>v===cols[i]));
  out+=hit?hit[0]:'?';
 }
 return out.trimEnd();
}
/** "6.20880 S" -> -6.2088. NaN when the row is not a coordinate. */
export function readCoord(row:string):number{
 const m=/^(\d+\.\d{5}) ([NSEW])$/.exec(row);
 return m?(m[2]==='S'||m[2]==='W'?-1:1)*Number(m[1]):NaN;
}

export const lesson=defineLesson({
 id:'gps-tracker',order:260,view:{az:8,elev:66,board:true},concept:'NMEA',keyPins:['D0','D11','D13','D10'],recordPins:['D13'],
 circuit:{
  parts:[
   {id:'gps1',kind:'gps-neo6m',net:{VCC:'5V',TX:'D0',GND:'GND'},props:{fix:true,lat:-6.2088,lon:106.8456,altitude:8,speedKmh:0,heading:90,satellites:8,baud:'9600'}},
   {id:'lcd1',kind:'nokia5110-pcd8544',net:{RST:'D8',CE:'D10',DC:'D9',DIN:'D11',CLK:'D13',VCC:'3V3',LIGHT:'GND',GND:'GND'},props:{lane:'front'}},
  ],
  wires:[
   w('gps1','TX','D0','green'),
   w('lcd1','RST','D8','white'),w('lcd1','CE','D10','yellow'),w('lcd1','DC','D9','orange'),w('lcd1','DIN','D11','blue'),w('lcd1','CLK','D13','purple'),
   w('lcd1','VCC','3V3','red'),w('lcd1','LIGHT','GND','black'),
   ...RAILS,
  ],
 },
 firmware:{variants:[{id:'default',params:[P('refreshMs','uint16',1000,500,3000,500),P('satsNeeded','uint8',4,3,10,1)]}]},
 check:(s,m)=>{
  const g=extOf(s,'gps-neo6m'),l=extOf(s,'nokia5110-pcd8544');
  if(!g||!l||g.fix!==true)return false;
  const moved=changes(m,'lat',Math.round(Number(g.lat)*1e4))>=1;
  const fb=String(l.fb??'');
  const lat=readCoord(nokiaRow(fb,1)),lon=readCoord(nokiaRow(fb,2));
  // the learner moved the receiver AND the screen shows that new position (within the 5-decimal print)
  return moved&&Math.abs(lat-Number(g.lat))<0.0002&&Math.abs(lon-Number(g.lon))<0.0002;
 },
 readouts:s=>{
  const g=extOf(s,'gps-neo6m'),gid=extId(s,'gps-neo6m'),l=extOf(s,'nokia5110-pcd8544'),lid=extId(s,'nokia5110-pcd8544');
  const out:{target:string;text:string}[]=[];
  if(g&&gid)out.push(pill(gid,g.fix===true?`${Number(g.satellites)} sat · ${Number(g.lat).toFixed(4)}, ${Number(g.lon).toFixed(4)}`:'no fix'));
  if(l&&lid){const row=nokiaRow(String(l.fb??''),0);out.push(pill(lid,row||'blank'));}
  return out;
 },
 thumbnail:[{kind:'gps-neo6m',x:-10},{kind:'nokia5110-pcd8544',x:18}],
 title:c('GPS logger','Pencatat GPS'),tagline:c('Read the satellites and print where you are.','Baca satelit dan cetak di mana kamu berada.'),
 overview:{body:c(
  'A GPS module is a radio receiver that works out where it is from satellite signals and then just talks: once a second it sends lines of plain text called NMEA sentences, at 9600 baud, into the serial pin of the board. A line looks like $GPGGA,030007.00,0612.52800,S,10650.73600,E,1,08,1.00,8.0,M,,M,,*5C. Fields are split by commas, the position is written as degrees and minutes (ddmm.mmmmm), and the part after the star is a checksum so the sketch can throw away damaged lines. The sketch below checks that checksum, turns minutes into decimal degrees with whole-number math, and draws the result on a Nokia 5110 screen over SPI. Click the GPS module, move the position or switch the fix off, and watch the screen follow. On a real board D0 is shared with the USB cable: unplug the GPS TX wire from D0 while you upload the sketch, and plug it back afterwards.',
  'Modul GPS adalah penerima radio yang menghitung posisinya dari sinyal satelit, lalu hanya berbicara: tiap detik ia mengirim baris teks biasa bernama kalimat NMEA, pada 9600 baud, ke pin serial papan. Sebuah baris berbentuk $GPGGA,030007.00,0612.52800,S,10650.73600,E,1,08,1.00,8.0,M,,M,,*5C. Bidangnya dipisah koma, posisi ditulis dalam derajat dan menit (ddmm.mmmmm), dan bagian setelah bintang adalah checksum agar sketsa bisa membuang baris yang rusak. Sketsa di sini memeriksa checksum itu, mengubah menit menjadi derajat desimal dengan hitungan bilangan bulat, lalu menggambar hasilnya di layar Nokia 5110 lewat SPI. Klik modul GPS, geser posisi atau matikan fix, dan lihat layar mengikuti. Pada papan sungguhan D0 dipakai bersama kabel USB: cabut kabel TX GPS dari D0 saat mengunggah sketsa, lalu pasang lagi sesudahnya.'),
  bullets:[b('wave','The module only talks: no commands needed.','Modul hanya berbicara: tanpa perintah.'),b('chip','A checksum catches damaged lines.','Checksum menangkap baris yang rusak.'),b('eye','The screen is 84 x 48 pixels, written one column byte at a time.','Layar 84 x 48 piksel, ditulis satu byte kolom demi satu.')]},
 pinout:[
  pinRow('D0','GPS TX','TX GPS','NMEA text arrives here (hardware serial RX). Shared with USB: unplug this wire while uploading.','Teks NMEA datang ke sini (RX serial perangkat keras). Dipakai bersama USB: cabut kabel ini saat mengunggah.'),
  pinRow('D11','Screen DIN','DIN layar','SPI data out (MOSI) to the screen.','Data SPI keluar (MOSI) ke layar.'),
  pinRow('D13','Screen CLK','CLK layar','SPI clock.','Clock SPI.'),
  pinRow('D10','Screen CE','CE layar','Chip select, low while a byte is sent.','Chip select, rendah saat byte dikirim.'),
  pinRow('D9','Screen DC','DC layar','Low = command, high = pixel data.','Rendah = perintah, tinggi = data piksel.'),
  pinRow('3V3','Screen power','Daya layar','The Nokia screen is a 3.3 V part.','Layar Nokia adalah komponen 3,3 V.'),
 ],
 walkthrough:[
  c('Serial.begin(9600) opens the port the GPS talks on. Lines end with a newline.','Serial.begin(9600) membuka port tempat GPS berbicara. Baris diakhiri newline.'),
  c('Every line is XOR-checked: the characters between $ and * must give the two hex digits after the star.','Setiap baris diperiksa XOR: karakter antara $ dan * harus menghasilkan dua digit heks setelah bintang.'),
  c('A $..GGA line is split at the commas. Quality 0 or too few satellites means NO FIX.','Baris $..GGA dipecah di koma. Kualitas 0 atau satelit terlalu sedikit berarti NO FIX.'),
  c('ddmm.mmmmm becomes decimal degrees: degrees + minutes / 60, using only integers.','ddmm.mmmmm menjadi derajat desimal: derajat + menit / 60, hanya dengan bilangan bulat.'),
  c('The text is drawn with a 5x7 font; DC low sends a command, DC high sends eight pixels.','Teks digambar dengan font 5x7; DC rendah mengirim perintah, DC tinggi mengirim delapan piksel.'),
 ],
 specs:[sp('GPS module','Modul GPS','NEO-6M, 9600 baud NMEA','NEO-6M, NMEA 9600 baud'),sp('Screen','Layar','Nokia 5110, PCD8544, 84 x 48'),sp('Buses','Bus','UART on D0, SPI on D9 to D13')],
 callouts:[
  co('gps1','top','GPS module','Modul GPS','Click it to move the position, set the speed or switch the satellite fix off.','Klik untuk memindahkan posisi, mengatur kecepatan, atau mematikan fix satelit.'),
  co('lcd1','top','Nokia 5110 screen','Layar Nokia 5110','Shows the fix, latitude, longitude and the UTC time the sketch parsed.','Menampilkan fix, lintang, bujur, dan waktu UTC yang diurai sketsa.'),
  co('uno.digital-header','left','D0 receives text','D0 menerima teks','The module TX wire goes to the board RX pin, D0.','Kabel TX modul menuju pin RX papan, D0.','D0'),
  co('uno.mcu','top','Parse and draw','Urai dan gambar','Checks the checksum, converts to degrees, then draws over SPI.','Memeriksa checksum, mengubah ke derajat, lalu menggambar lewat SPI.'),
 ],
 params:{
  refreshMs:{label:c('Redraw every','Gambar ulang tiap'),unit:'ms',hint:c('Shortest time between two screen updates.','Jeda terpendek antara dua pembaruan layar.')},
  satsNeeded:{label:c('Satellites needed','Satelit dibutuhkan'),unit:'sat',hint:c('Fewer satellites than this shows NO FIX even if the module reports a fix.','Satelit kurang dari ini menampilkan NO FIX walau modul melapor fix.')},
 },
 goal:{text:c('Move the GPS position and see the screen print the new latitude and longitude.','Pindahkan posisi GPS dan lihat layar mencetak lintang dan bujur yang baru.'),hint:c('Run, click the GPS module and change the latitude or longitude.','Jalankan, klik modul GPS lalu ubah lintang atau bujur.')},
 seo:{title:'GPS logger: parse NEO-6M NMEA and show it on a Nokia 5110',description:'Read NMEA sentences from a NEO-6M GPS, check the checksum, convert to decimal degrees and draw the fix on a Nokia 5110 with an emulated Arduino UNO.'},
});
