import {defineLesson,c,co,pinRow,sp,b,w,P,byKind,extOf,extId,pill,RAILS,MOTOR_MAX_RPM,entries} from './kit';

/** rpm of every motor part in the snapshot, in circuit order */
const rpms=(s:Parameters<typeof entries>[0]):number[]=>entries(s).filter(([,p])=>p.kind==='motor').map(([,p])=>(p as {rpm:number}).rpm);

export const lesson=defineLesson({
 id:'motor-driver',order:250,view:{az:20,elev:46,board:true},concept:'H-BRIDGE',keyPins:['D9','D10','A0','D7'],recordPins:['D9','D10'],
 circuit:{
  parts:[
   {id:'pot1',kind:'potentiometer',net:{VCC:'5V',SIG:'A0',GND:'GND'},props:{value:600}},
   {id:'drv1',kind:'l298n',net:{ENA:'D9',IN1:'D7',IN2:'D8',IN3:'D4',IN4:'D12',ENB:'D10',GND:'GND'},props:{}},
   {id:'m1',kind:'motor',net:{},props:{}},
   {id:'m2',kind:'motor',net:{},props:{}},
   {id:'bat1',kind:'battery-9v',net:{},props:{charge:100,deskX:-60}},
  ],
  wires:[w('pot1','SIG','A0','yellow'),w('drv1','ENA','D9','orange'),w('drv1','ENB','D10','green'),w('drv1','IN1','D7','blue'),w('drv1','IN2','D8','purple'),w('drv1','IN3','D4','blue'),w('drv1','IN4','D12','purple'),...RAILS],
  links:[
   {a:{part:'bat1',pin:'PLUS'},b:{part:'drv1',pin:'VS'},color:'red'},
   {a:{part:'bat1',pin:'MINUS'},b:{part:'drv1',pin:'GND'},color:'black'},
   {a:{part:'drv1',pin:'OUT1'},b:{part:'m1',pin:'+'},color:'orange'},
   {a:{part:'drv1',pin:'OUT2'},b:{part:'m1',pin:'-'},color:'yellow'},
   {a:{part:'drv1',pin:'OUT3'},b:{part:'m2',pin:'+'},color:'orange'},
   {a:{part:'drv1',pin:'OUT4'},b:{part:'m2',pin:'-'},color:'yellow'},
  ],
 },
 firmware:{variants:[{id:'default',params:[P('deadband','uint16',40,0,300,10),P('printEvery','uint16',300,100,1000,100)]}]},
 // the goal reads the real motor speeds: both motors fast (and turning opposite ways) at some moment, and later both stopped
 check:(s,m)=>{
  const r=rpms(s);
  if(r.length<2)return false;
  const top=MOTOR_MAX_RPM;
  if(r[0]!>=0.5*top&&r[1]!<=-0.5*top)m.fast=1;
  if(m.fast&&Math.abs(r[0]!)<0.05*top&&Math.abs(r[1]!)<0.05*top)m.stopped=1;
  return !!m.fast&&!!m.stopped;
 },
 readouts:s=>{
  const d=extOf(s,'l298n'),id=extId(s,'l298n'),mo=byKind(s,'motor');
  return d&&id?[pill(id,`${Number(d.outAV).toFixed(1)} V · ${Math.round(Number(d.dutyA)*100)}%${mo?` · ${Math.round(Math.abs(mo.rpm))} rpm`:''}`)]:[];
 },
 thumbnail:[{kind:'l298n',x:0},{kind:'motor',x:40}],
 title:c('Two-motor driver','Driver dua motor'),tagline:c('An H-bridge lets a small chip steer big motors from a battery.','H-bridge membuat chip kecil mengarahkan motor besar dari baterai.'),
 overview:{body:c('A pin of the Arduino can only supply a few milliamps, and a motor wants far more. The L298N is a dual H-bridge: four switches per motor that connect it to the battery either way round. The EN pin switches a side on, and PWM on it sets the average voltage, so the speed. The IN pins pick the direction. The motors run from their own 9 V battery on VS; only the grounds are shared with the board. The bridge loses about 2 V as heat, so the motors see about 7 V at full duty. Turn the potentiometer and watch both motors follow it, one clockwise and one counter-clockwise.','Satu pin Arduino hanya bisa memberi beberapa miliampere, sedangkan motor butuh jauh lebih banyak. L298N adalah H-bridge ganda: empat saklar per motor yang menyambungkannya ke baterai dengan arah bolak-balik. Pin EN menyalakan satu sisi, dan PWM di pin itu mengatur tegangan rata-rata, jadi kecepatan. Pin IN memilih arah. Motor berjalan dari baterai 9 V sendiri di VS; hanya ground yang dipakai bersama dengan papan. Jembatan kehilangan sekitar 2 V sebagai panas, jadi motor melihat sekitar 7 V pada duty penuh. Putar potensiometer dan lihat kedua motor mengikutinya, satu searah jarum jam dan satu berlawanan.'),
  bullets:[b('bolt','The motors run from their own battery on VS.','Motor berjalan dari baterainya sendiri di VS.'),b('wave','PWM on ENA and ENB sets the speed.','PWM di ENA dan ENB mengatur kecepatan.'),b('gear','IN1 to IN4 pick the direction of each motor.','IN1 sampai IN4 memilih arah tiap motor.')]},
 pinout:[pinRow('A0','Speed knob','Knob kecepatan','Analog input from the potentiometer.','Input analog dari potensiometer.'),pinRow('D9 / D10','ENA / ENB','ENA / ENB','PWM speed of motor A and B.','Kecepatan PWM motor A dan B.'),pinRow('D7 D8 / D4 D12','IN1-IN4','IN1-IN4','Direction of motor A and motor B.','Arah motor A dan motor B.')],
 walkthrough:[c('analogRead(A0) returns 0-1023 from the knob.','analogRead(A0) memberi 0-1023 dari knob.'),c('Below deadband both motors stop (PWM 0).','Di bawah deadband kedua motor berhenti (PWM 0).'),c('Otherwise raw / 4 becomes the PWM duty on ENA and ENB.','Selain itu raw / 4 menjadi duty PWM di ENA dan ENB.'),c('IN1 high and IN2 low turn motor A forward; IN3 and IN4 are mirrored.','IN1 tinggi dan IN2 rendah memutar motor A maju; IN3 dan IN4 dicerminkan.')],
 specs:[sp('Driver','Driver','L298N dual H-bridge'),sp('Motor supply','Catu motor','9 V battery on VS','Baterai 9 V di VS'),sp('Loss','Rugi','About 2 V','Sekitar 2 V'),sp('Pins','Pin','A0, D9, D10, D7, D8, D4, D12')],
 callouts:[co('pot1','left','Speed knob','Knob kecepatan','Click it and slide the value.','Klik dan geser nilainya.'),co('drv1','top','L298N','L298N','Switches the battery to the motors.','Menyakelar baterai ke motor.'),co('bat1','right','Motor battery','Baterai motor','Powers the motors on VS. Pull its charge down to slow them.','Memberi daya motor di VS. Turunkan muatannya agar melambat.'),co('m1','right','Motor A','Motor A','Turns one way.','Berputar satu arah.'),co('uno.digital-header','left','D9 / D10','D9 / D10','PWM to ENA and ENB.','PWM ke ENA dan ENB.','D9')],
 params:{deadband:{label:c('Dead band','Zona mati'),unit:'/1023',hint:c('Knob readings below this stop the motors.','Pembacaan knob di bawah ini menghentikan motor.')},printEvery:{label:c('Print every','Cetak tiap'),unit:'ms',hint:c('Time between serial lines.','Jarak waktu antar baris serial.')}},
 goal:{text:c('Turn the knob up until both motors spin fast in opposite directions, then turn it down until they stop.','Putar knob naik sampai kedua motor berputar cepat berlawanan arah, lalu putar turun sampai berhenti.'),hint:c('Run, click the potentiometer and slide it high, then to zero.','Jalankan, klik potensiometer dan geser tinggi, lalu ke nol.')},
 seo:{title:'Drive two DC motors with an L298N and a knob',description:'Control two DC motors from a 9 V battery with an L298N H-bridge, PWM speed and a potentiometer on an emulated Arduino UNO.'},
});
