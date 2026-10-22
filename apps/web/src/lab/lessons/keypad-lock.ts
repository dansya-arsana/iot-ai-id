import {defineLesson,c,co,pinRow,sp,b,w,P,byKind,extOf,extId,pill,RAILS} from './kit';

export const lesson=defineLesson({
 id:'keypad-lock',order:200,concept:'KEYPAD',keyPins:['D2','D6','D10','D12'],recordPins:['D2','D12'],
 circuit:{
  parts:[
   {id:'pad1',kind:'keypad-4x4',net:{R1:'D2',R2:'D3',R3:'D4',R4:'D5',C1:'D6',C2:'D7',C3:'D8',C4:'D9'},props:{}},
   {id:'tm1',kind:'tm1637-4digit',net:{CLK:'D10',DIO:'D11',VCC:'5V',GND:'GND'},props:{}},
   {id:'sv1',kind:'servo',net:{SIG:'D12',V:'5V',GND:'GND'},props:{deskX:-62}},
  ],
  wires:[
   w('pad1','R1','D2','orange'),w('pad1','R2','D3','yellow'),w('pad1','R3','D4','green'),w('pad1','R4','D5','blue'),
   w('pad1','C1','D6','purple'),w('pad1','C2','D7','white'),w('pad1','C3','D8','orange'),w('pad1','C4','D9','yellow'),
   w('tm1','CLK','D10','green'),w('tm1','DIO','D11','blue'),w('sv1','SIG','D12','orange'),
   ...RAILS,
  ],
 },
 firmware:{variants:[{id:'default',params:[P('pinCode','uint16',1234,0,9999,1),P('openMs','uint16',3000,1000,10000,500)]}]},
 // the goal is read from simulated outputs: the latch starts closed, then the servo really swings open AND the display shows OPEn
 check:(s,m)=>{
  const sv=byKind(s,'servo'),tm=extOf(s,'tm1637-4digit');
  if(sv&&sv.angleDeg<20)m.closed=1;
  if(m.closed&&sv&&sv.angleDeg>=80&&tm&&String(tm.text)==='0PEn')m.opened=1;
  return m.opened===1;
 },
 readouts:s=>{
  const sv=byKind(s,'servo'),sid=extId(s,'servo')??'sv1',tm=extOf(s,'tm1637-4digit'),tid=extId(s,'tm1637-4digit');
  const out:{target:string;text:string}[]=[];
  if(sv)out.push(pill(sid,sv.angleDeg>=45?'open':'locked'));
  if(tm&&tid&&String(tm.text).trim()!=='')out.push(pill(tid,String(tm.text)));
  return out;
 },
 thumbnail:[{kind:'keypad-4x4',x:0},{kind:'tm1637-4digit',x:34}],
 title:c('Keypad lock','Kunci keypad'),tagline:c('A PIN on a keypad opens a servo latch.','PIN di keypad membuka kunci servo.'),
 overview:{body:c('A 4x4 keypad has only eight wires for sixteen keys. Each key joins one row to one column, so the sketch scans: it pulls one row low, reads the four columns with pull-ups, and a column that reads low tells it which key is down. The typed digits appear on a TM1637 display, a chip with its own two-wire bus. When the code matches the PIN and you press #, a servo turns the latch open for a few seconds, then closes it again. The scan and the display driver are our own code. Open the keypad and press the keys of the PIN.','Keypad 4x4 hanya punya delapan kabel untuk enam belas tombol. Setiap tombol menyambung satu baris ke satu kolom, jadi sketsa memindai: menarik satu baris ke rendah, membaca empat kolom dengan pull-up, dan kolom yang terbaca rendah menunjukkan tombol yang ditekan. Digit yang diketik muncul di display TM1637, chip dengan bus dua kabel sendiri. Saat kode cocok dengan PIN dan kamu menekan #, servo memutar kunci terbuka beberapa detik lalu menutupnya lagi. Pemindaian dan driver display adalah kode kami sendiri. Buka keypad dan tekan tombol PIN.'),
  bullets:[b('grid','Eight wires read sixteen keys.','Delapan kabel membaca enam belas tombol.'),b('wave','The display has its own two-wire bus.','Display punya bus dua kabel sendiri.'),b('gear','A servo turns the latch open.','Servo memutar kunci hingga terbuka.')]},
 pinout:[pinRow('D2 - D5','Keypad rows R1-R4','Baris keypad R1-R4','Outputs: one row at a time is pulled low.','Keluaran: satu baris ditarik rendah bergantian.'),pinRow('D6 - D9','Keypad columns C1-C4','Kolom keypad C1-C4','Inputs with pull-up: low means a key is down.','Masukan dengan pull-up: rendah berarti tombol ditekan.'),pinRow('D10, D11','TM1637 CLK, DIO','CLK, DIO TM1637','The display bus.','Bus display.'),pinRow('D12','Servo signal','Sinyal servo','Pulse width sets the latch angle.','Lebar pulsa menentukan sudut kunci.')],
 walkthrough:[c('Pull one row low and read the four columns.','Tarik satu baris ke rendah dan baca empat kolom.'),c('A column that reads low names the key in that row.','Kolom yang terbaca rendah menunjukkan tombol di baris itu.'),c('Confirm the key twice, 15 ms apart, to skip bounce.','Konfirmasi tombol dua kali, berjarak 15 ms, untuk melewati pantulan.'),c('Collect up to four digits and show them on the TM1637.','Kumpulkan sampai empat digit dan tampilkan di TM1637.'),c('On #, compare with the PIN: open the servo or show Err.','Saat #, bandingkan dengan PIN: buka servo atau tampilkan Err.')],
 specs:[sp('Keypad','Keypad','4x4 membrane, 8 wires','Membran 4x4, 8 kabel'),sp('Display','Layar','TM1637, 4 digits','TM1637, 4 digit'),sp('Latch','Kunci','Servo, 0 to 90 degrees','Servo, 0 sampai 90 derajat'),sp('Default PIN','PIN bawaan','1234')],
 callouts:[co('pad1','left','Keypad','Keypad','Click a key to tap it, in 3D or in the panel. Each tap lasts a moment.','Klik tombol untuk mengetuknya, di 3D atau di panel. Tiap ketukan berlangsung sesaat.'),co('tm1','top','TM1637 display','Display TM1637','Dashes wait for digits, then OPEn or Err.','Garis menunggu digit, lalu OPEn atau Err.'),co('sv1','right','Servo latch','Kunci servo','Turns to 90 degrees when the PIN is right.','Berputar ke 90 derajat saat PIN benar.'),co('uno.digital-header','left','Pins 2-12','Pin 2-12','Eight keypad lines, two display lines, one servo.','Delapan jalur keypad, dua jalur display, satu servo.','D2')],
 params:{pinCode:{label:c('PIN code','Kode PIN'),unit:'',hint:c('The four digits that open the lock.','Empat digit yang membuka kunci.')},openMs:{label:c('Open time','Waktu terbuka'),unit:'ms',hint:c('How long the latch stays open.','Berapa lama kunci tetap terbuka.')}},
 goal:{text:c('Type the PIN, press #, and watch the servo open the latch.','Ketik PIN, tekan #, dan lihat servo membuka kunci.'),hint:c('Run, open the keypad and press 1, 2, 3, 4, then #.','Jalankan, buka keypad dan tekan 1, 2, 3, 4, lalu #.')},
 seo:{title:'Arduino keypad lock with a servo latch',description:'Scan a 4x4 keypad, show the PIN on a TM1637 display and open a servo latch when the code is right, on an emulated Arduino UNO.'},
});
