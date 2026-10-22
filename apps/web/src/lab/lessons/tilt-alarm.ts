import {defineLesson,c,co,pinRow,sp,b,w,P,byKind,extOf,extId,idOf,pill,RAILS} from './kit';

/** Tilt in degrees from the accelerometer state (g units in the sensor frame): the angle between the board's up axis and gravity. */
const tiltOf=(v:Record<string,number|boolean|string|null>|null):number=>{
 if(!v)return 0;
 const x=Number(v.ax)||0,y=Number(v.ay)||0,z=Number(v.az)||0;
 return Math.atan2(Math.hypot(x,y),z)*180/Math.PI;
};
const BAR_PINS=['D2','D3','D4','D6','D7','D8','D9','D10','D11','D12'] as const;
const bar=Object.fromEntries(BAR_PINS.map((p,i)=>['A'+(i+1),p]));

export const lesson=defineLesson({
 id:'tilt-alarm',order:180,view:{az:0,elev:64,board:true},concept:'IMU',keyPins:['A4','A5','D5'],recordPins:['D5'],
 circuit:{
  parts:[
   {id:'mpu1',kind:'mpu6050',net:{VCC:'5V',GND:'GND',SDA:'A4',SCL:'A5'},props:{roll:0,pitch:0,spin:0,temperature:25,lane:'front'}},
   {id:'bz1',kind:'buzzer',net:{'+':'D5','-':'GND'},props:{lane:'front'}},
   {id:'bar1',kind:'led-bar-10',net:{...bar,K:'GND'},props:{color:'red',seriesOhms:220,lane:'front'}},
  ],
  wires:[w('mpu1','SDA','A4','blue'),w('mpu1','SCL','A5','purple'),w('bz1','+','D5','orange'),w('bz1','-','GND','black'),
   ...BAR_PINS.map((p,i)=>w('bar1','A'+(i+1),p,i%2?'yellow':'green')),w('bar1','K','GND','black'),...RAILS],
 },
 firmware:{variants:[{id:'default',params:[P('alarmDeg','uint16',45,15,80,5),P('sampleMs','uint16',50,20,500,10)]}]},
 check:(s,m)=>{
  const mp=extOf(s,'mpu6050'),bz=byKind(s,'buzzer'),br=extOf(s,'led-bar-10');
  if(!mp||!bz||!br)return false;
  if(Number(br.lit)===0&&!bz.on&&tiltOf(mp)<8)m.calm=1;           // it started flat, bar dark, buzzer silent
  // then the board was tilted: the bar filled at least halfway AND the buzzer really sounded
  return !!m.calm&&Number(br.lit)>=5&&!!bz.on&&bz.freqHz>0;
 },
 readouts:s=>{
  const mp=extOf(s,'mpu6050'),id=extId(s,'mpu6050'),bz=byKind(s,'buzzer'),bid=idOf(s,'buzzer'),br=extOf(s,'led-bar-10'),lid=extId(s,'led-bar-10');
  const out:{target:string;text:string}[]=[];
  if(mp&&id&&mp.asleep===false)out.push(pill(id,`tilt ${tiltOf(mp).toFixed(0)}°`));
  if(br&&lid)out.push(pill(lid,`${br.lit} / 10`));
  if(bz&&bid&&bz.on)out.push(pill(bid,`♪ ${Math.round(bz.freqHz)} Hz`));
  return out;
 },
 thumbnail:[{kind:'mpu6050',x:0},{kind:'buzzer',x:44}],
 title:c('Tilt alarm','Alarm kemiringan'),tagline:c('An MPU6050 measures the angle and sounds a buzzer.','MPU6050 mengukur sudut dan membunyikan buzzer.'),
 overview:{body:c('An accelerometer feels gravity. Flat on the table, gravity pulls straight through the board. Tilt the board and the pull spreads over the other axes, so the angle can be worked out with atan2. The sketch wakes the MPU6050 over I2C, reads its three acceleration values, turns them into a tilt angle, fills the LED bar in proportion and sounds the buzzer once the angle reaches the alarm limit. Click the sensor and drag Roll or Pitch. The bar module carries a 10 x 220 ohm resistor array (the beige strip): every LED needs its own resistor, so never wire a bare LED straight to a pin.','Akselerometer merasakan gravitasi. Saat datar di meja, gravitasi menembus papan lurus. Miringkan papan dan tarikannya terbagi ke sumbu lain, sehingga sudut bisa dihitung dengan atan2. Sketsa membangunkan MPU6050 lewat I2C, membaca tiga nilai percepatan, mengubahnya menjadi sudut kemiringan, mengisi batang LED sebanding, dan membunyikan buzzer begitu sudut mencapai batas alarm. Klik sensor lalu geser Roll atau Pitch. Modul batang membawa array resistor 10 x 220 ohm (strip krem): setiap LED butuh resistornya sendiri, jadi jangan pernah menyambung LED telanjang langsung ke pin.'),
  bullets:[b('eye','The chip starts asleep: the sketch must clear PWR_MGMT_1 first.','Chip mulai dalam keadaan tidur: sketsa harus menghapus PWR_MGMT_1 dulu.'),b('gear','At the default range 16384 counts equal 1 g.','Pada rentang bawaan, 16384 hitungan sama dengan 1 g.'),b('loop','The bar fills one segment per 9 degrees.','Batang terisi satu segmen tiap 9 derajat.')]},
 pinout:[pinRow('A4','SDA','SDA','I2C data to the MPU6050.','Data I2C ke MPU6050.'),pinRow('A5','SCL','SCL','I2C clock.','Clock I2C.'),pinRow('D5','Buzzer','Buzzer','Tone at the alarm angle.','Nada saat sudut alarm.'),pinRow('D2','LED bar','Batang LED','D2 to D12 (skipping 5) fill the bar.','D2 sampai D12 (tanpa 5) mengisi batang.')],
 walkthrough:[c('Write 0 to PWR_MGMT_1 (0x6B) to wake the sensor.','Tulis 0 ke PWR_MGMT_1 (0x6B) untuk membangunkan sensor.'),c('Read six bytes from 0x3B: X, Y and Z, high byte first.','Baca enam byte dari 0x3B: X, Y, Z, byte tinggi dulu.'),c('Tilt = atan2(sqrt(x*x + y*y), z), converted to degrees.','Kemiringan = atan2(sqrt(x*x + y*y), z), diubah ke derajat.'),c('Light one segment per 9 degrees and call tone() at alarmDeg.','Nyalakan satu segmen tiap 9 derajat dan panggil tone() pada alarmDeg.')],
 specs:[sp('Sensor','Sensor','MPU6050, I2C 0x68'),sp('Alarm','Alarm','Passive buzzer, 1 kHz','Buzzer pasif, 1 kHz'),sp('Pins','Pin','A4, A5, D5, D2-D12')],
 callouts:[co('mpu1','left','MPU6050','MPU6050','Click it and drag Roll or Pitch.','Klik dan geser Roll atau Pitch.'),co('bar1','top','LED bar','Batang LED','Fills with the angle.','Terisi sesuai sudut.'),co('bz1','right','Buzzer','Buzzer','Sounds at the alarm angle.','Berbunyi pada sudut alarm.'),co('uno.digital-header','left','Pins 2 to 12','Pin 2 sampai 12','Ten bar segments and the buzzer.','Sepuluh segmen batang dan buzzer.','D5')],
 params:{alarmDeg:{label:c('Alarm angle','Sudut alarm'),unit:'°',hint:c('Tilt at which the buzzer sounds.','Kemiringan saat buzzer berbunyi.')},sampleMs:{label:c('Sample interval','Interval sampel'),unit:'ms',hint:c('Time between sensor readings.','Jeda antar pembacaan sensor.')}},
 goal:{text:c('Tilt the board past the alarm angle: the bar fills and the buzzer sounds.','Miringkan papan melewati sudut alarm: batang terisi dan buzzer berbunyi.'),hint:c('Run, click the MPU6050 and drag Roll to 60 degrees or more.','Jalankan, klik MPU6050 dan geser Roll ke 60 derajat atau lebih.')},
 seo:{title:'Tilt alarm with an MPU6050 and a buzzer',description:'Read an MPU6050 accelerometer over I2C on an emulated Arduino UNO, work out the tilt angle, fill an LED bar and sound a buzzer at the limit.'},
});
