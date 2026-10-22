import {defineLesson,c,co,pinRow,sp,b,w,P,extOf,extId,pill,RAILS} from './kit';
import type {PartLink} from '../contract';

const link=(a:string,z:string):PartLink=>{const [pa,pp]=a.split('.'),[qa,qp]=z.split('.');return {a:{part:pa!,pin:pp!},b:{part:qa!,pin:qp!},color:'orange',seated:true};};

/** The glyphs the sketch draws (5x7 columns, bit 0 = top row), written out here so the goal reads the screen on its own. */
const GLYPHS='0123456789-POSDEG ';
const FONT:number[][]=[
 [0x3E,0x51,0x49,0x45,0x3E],[0x00,0x42,0x7F,0x40,0x00],[0x42,0x61,0x51,0x49,0x46],[0x21,0x41,0x45,0x4B,0x31],[0x18,0x14,0x12,0x7F,0x10],
 [0x27,0x45,0x45,0x45,0x39],[0x3C,0x4A,0x49,0x49,0x30],[0x01,0x71,0x09,0x05,0x03],[0x36,0x49,0x49,0x49,0x36],[0x06,0x49,0x49,0x29,0x1E],
 [0x08,0x08,0x08,0x08,0x08],[0x7F,0x09,0x09,0x09,0x06],[0x3E,0x41,0x41,0x41,0x3E],[0x46,0x49,0x49,0x49,0x31],[0x7F,0x41,0x41,0x22,0x1C],
 [0x7F,0x49,0x49,0x49,0x41],[0x3E,0x41,0x49,0x49,0x7A],[0x00,0x00,0x00,0x00,0x00],
];
/** Double-size columns of one glyph: page `half` (0 = top, 1 = bottom), ten bytes. */
function bigColumns(g:number,half:0|1):number[]{
 const out:number[]=[];
 for(let col=0;col<5;col++){
  const v=FONT[g]![col]!;let o=0;
  for(let r=0;r<4;r++)if(v&(1<<(r+4*half)))o|=3<<(r*2);
  out.push(o,o);
 }
 return out;
}
/** Text of the double-height line whose top page is `page` in a 128x64 frame (hex string); unknown cells give '?'. */
export function readOledLine(fb:string,page:number):string{
 const byteAt=(i:number)=>parseInt(fb.slice(i*2,i*2+2),16);
 let out='';
 for(let cell=0;cell<10;cell++){
  let found='?';
  for(let g=0;g<GLYPHS.length;g++){
   const top=bigColumns(g,0),bottom=bigColumns(g,1);
   let ok=true;
   for(let k=0;k<10&&ok;k++)ok=byteAt(page*128+cell*12+k)===top[k]&&byteAt((page+1)*128+cell*12+k)===bottom[k];
   if(ok){found=GLYPHS[g]!;break;}
  }
  out+=found;
 }
 return out;
}
/** The position the screen shows ("POS -1234" on the first line), or null while it is blank or unreadable. */
export function oledPosition(fb:string):number|null{
 const m=/^POS (-?\d+)\s*$/.exec(readOledLine(fb,1));
 return m?Number(m[1]):null;
}

type StepV={halfSteps:number;missed:number;powered:boolean};
const stepOf=(s:Parameters<typeof extOf>[0])=>extOf(s,'stepper-28byj48') as unknown as StepV|null;

export const lesson=defineLesson({
 id:'stepper',order:220,concept:'STEPPER',keyPins:['D8','D9','D10','D11','A0','A4','A5'],recordPins:['D8','D9','D10','D11'],
 circuit:{
  parts:[
   {id:'drv1',kind:'uln2003-driver',net:{IN1:'D8',IN2:'D9',IN3:'D10',IN4:'D11','+':'5V','-':'GND'},props:{}},
   {id:'joy1',kind:'joystick-ky023',net:{'+5V':'5V',GND:'GND',VRx:'A0',SW:'D2'},props:{x:512,y:512,pressed:false}},
   {id:'stp1',kind:'stepper-28byj48',net:{},props:{target:'drv1'}},
   {id:'oled1',kind:'oled-ssd1306',net:{VCC:'5V',SDA:'A4',SCL:'A5',GND:'GND'},props:{lane:'front'}},
  ],
  wires:[
   w('joy1','VRx','A0','green'),w('joy1','SW','D2','yellow'),
   w('drv1','IN1','D8','orange'),w('drv1','IN2','D9','yellow'),w('drv1','IN3','D10','green'),w('drv1','IN4','D11','blue'),
   w('oled1','SDA','A4','blue'),w('oled1','SCL','A5','purple'),
   ...RAILS,
  ],
  links:[link('drv1.OUT1','stp1.BLU'),link('drv1.OUT2','stp1.PNK'),link('drv1.OUT3','stp1.YEL'),link('drv1.OUT4','stp1.ORG'),link('drv1.COM','stp1.RED')],
 },
 firmware:{variants:[{id:'default',params:[P('fastUs','uint16',1500,1000,4000,100),P('slowUs','uint16',6000,3000,12000,500)]}]},
 check:(s,m)=>{
  const st=stepOf(s),o=extOf(s,'oled-ssd1306'),j=extOf(s,'joystick-ky023');
  if(!st||!o||!j)return false;
  if(Math.abs(Number(j.x)-512)>150)m.pushed=1;                       // the learner moved the stick
  const shown=oledPosition(String(o.fb??''));
  // the shaft really turned by at least a quarter of a turn without losing steps, and the screen shows the number the motor is at
  return !!m.pushed&&st.powered&&st.missed===0&&Math.abs(st.halfSteps)>=1000&&shown!==null&&shown===st.halfSteps;
 },
 readouts:s=>{
  const st=stepOf(s),sid=extId(s,'stepper-28byj48'),o=extOf(s,'oled-ssd1306'),oid=extId(s,'oled-ssd1306');
  const out:{target:string;text:string}[]=[];
  if(st&&sid)out.push(pill(sid,`${st.halfSteps} half steps`));
  if(o&&oid){const p=oledPosition(String(o.fb??''));out.push(pill(oid,p===null?'blank':`shows ${p}`));}
  return out;
 },
 view:{az:8,elev:46,board:true},
 thumbnail:[{kind:'stepper-28byj48',x:0},{kind:'joystick-ky023',x:34}],
 title:c('Stepper control','Kendali stepper'),tagline:c('Steer a motor with a joystick and watch its position.','Kemudi motor dengan joystick dan pantau posisinya.'),
 overview:{body:c('A stepper motor does not spin freely: it moves one tiny step each time its four coils change pattern. The 28BYJ-48 needs 4076 half steps for one turn of the shaft. A ULN2003 board switches the coil current, because a board pin is too weak. The sketch reads the joystick on A0: push right and the pattern runs forward, push left and it runs backward, and the farther you push the shorter the pause between steps. It counts every step, so it always knows where the shaft is, and it writes that number on the OLED. Press the stick and the motor walks back to zero.','Motor stepper tidak berputar bebas: ia maju satu langkah kecil setiap empat kumparannya berganti pola. 28BYJ-48 butuh 4076 setengah langkah untuk satu putaran poros. Papan ULN2003 menyalakan arus kumparan, karena pin papan terlalu lemah. Sketsa membaca joystick di A0: dorong ke kanan dan pola berjalan maju, dorong ke kiri dan berjalan mundur, makin jauh didorong makin pendek jeda antar langkah. Sketsa menghitung tiap langkah, jadi selalu tahu posisi poros, dan menuliskan angkanya di OLED. Tekan stick dan motor berjalan pulang ke nol.'),
  bullets:[b('wave','Four coil patterns, one step each.','Empat pola kumparan, satu langkah tiap pola.'),b('chip','The ULN2003 carries the coil current.','ULN2003 membawa arus kumparan.'),b('eye','Counting steps gives the position.','Menghitung langkah memberi posisi.')]},
 pinout:[pinRow('A0','Joystick X','Joystick X','Voltage that follows the stick left and right.','Tegangan yang mengikuti stick kiri dan kanan.'),pinRow('D2','Joystick button','Tombol joystick','LOW while the stick is pressed: go home.','LOW saat stick ditekan: pulang ke nol.'),pinRow('D8','ULN2003 IN1-IN4','ULN2003 IN1-IN4','D8 to D11 carry the four coil signals.','D8 sampai D11 membawa empat sinyal kumparan.'),pinRow('A4','OLED SDA / SCL','OLED SDA / SCL','A4 data and A5 clock for the position screen.','A4 data dan A5 clock untuk layar posisi.')],
 walkthrough:[c('Four pins drive the coils; a half step is one move along an 8-pattern table.','Empat pin menggerakkan kumparan; satu setengah langkah adalah satu gerakan di tabel 8 pola.'),c('analogRead(A0) tells how far the stick is from the centre; a dead zone ignores a resting stick.','analogRead(A0) memberi tahu seberapa jauh stick dari tengah; zona mati mengabaikan stick yang diam.'),c('The farther the stick, the shorter the wait between steps (fastUs to slowUs).','Makin jauh stick, makin pendek jeda antar langkah (fastUs sampai slowUs).'),c('Every step adds or subtracts one from pos, so the sketch always knows where the shaft is.','Setiap langkah menambah atau mengurangi satu pada pos, jadi sketsa selalu tahu posisi poros.'),c('The OLED redraws only the characters that changed; the SW button sends the shaft home.','OLED hanya menggambar ulang karakter yang berubah; tombol SW membawa poros pulang.')],
 specs:[sp('Motor','Motor','28BYJ-48, 4076 half steps per turn','28BYJ-48, 4076 setengah langkah per putaran'),sp('Driver','Driver','ULN2003 on D8-D11','ULN2003 di D8-D11'),sp('Joystick','Joystick','KY-023, X on A0, button on D2','KY-023, X di A0, tombol di D2'),sp('Screen','Layar','SSD1306 on I2C, 0x3C')],
 callouts:[co('joy1','left','Joystick','Joystick','Click it and set X away from the centre.','Klik dan geser X menjauh dari tengah.'),co('stp1','top','Stepper','Stepper','The shaft turns one small step per coil pattern.','Poros berputar satu langkah kecil per pola kumparan.'),co('drv1','bottom','ULN2003','ULN2003','Its LEDs show which coil is on.','LED-nya menunjukkan kumparan yang menyala.'),co('oled1','top','Position','Posisi','The half-step count the sketch keeps.','Hitungan setengah langkah yang disimpan sketsa.')],
 params:{fastUs:{label:c('Fastest step','Langkah tercepat'),unit:'us',hint:c('Pause per half step with the stick fully over. Below about 900 the motor loses steps.','Jeda tiap setengah langkah saat stick penuh. Di bawah sekitar 900 motor kehilangan langkah.')},slowUs:{label:c('Slowest step','Langkah terlambat'),unit:'us',hint:c('Pause per half step just past the dead zone.','Jeda tiap setengah langkah tepat di luar zona mati.')}},
 goal:{text:c('Turn the shaft a quarter turn with the joystick and see the screen show the same position.','Putar poros seperempat putaran dengan joystick dan lihat layar menampilkan posisi yang sama.'),hint:c('Run, click the joystick, move X away from the centre, then back to the middle.','Jalankan, klik joystick, geser X menjauh dari tengah, lalu kembali ke tengah.')},
 seo:{title:'Control a 28BYJ-48 stepper with a joystick and OLED',description:'Drive a 28BYJ-48 through a ULN2003 with a joystick and show the step count on an SSD1306 OLED, on an emulated Arduino UNO. The driver is our own.'},
});
