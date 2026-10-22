import {defineLesson,c,co,pinRow,sp,b,sonar,P,byKind,idOf,pill,SONAR_WIRES} from './kit';

export const lesson=defineLesson({
 id:'distance',order:70,concept:'PULSEIN',keyPins:['D7','D6'],recordPins:['D7'],
 circuit:{parts:sonar(40,'box'),wires:SONAR_WIRES},
 firmware:{variants:[{id:'default',params:[P('interval','uint16',250,60,1000,10)]}]},
 check:(s,m)=>{
  const h=byKind(s,'hcsr04');
  if(!h)return false;
  const was=m.ping??0;
  if(was&&!h.pinging&&h.echoCm!==null){
   m.seen=(m.seen??0)+1;m.lastEcho=h.echoCm;
   if(m.first===undefined)m.first=h.echoCm;else if(Math.abs(h.echoCm-m.first)>=1)m.distinct=1;
  }
  m.ping=h.pinging?1:0;
  return (m.seen??0)>=3&&!!m.distinct;
 },
 readouts:s=>{const h=byKind(s,'hcsr04'),id=idOf(s,'hcsr04');return h&&id&&h.echoCm!==null?[pill(id,`${Math.round(h.echoCm)} cm`)]:[];},
 thumbnail:[{kind:'hcsr04',x:0}],
 title:c('Measure distance','Ukur jarak'),tagline:c('Ping, wait for the echo, do the maths.','Kirim ping, tunggu gema, hitung.'),
 overview:{body:c('The HC-SR04 sends an ultrasonic pulse and times the echo. Sound travels about 343 m/s, so distance in cm is the echo time in microseconds divided by 58.','HC-SR04 mengirim pulsa ultrasonik dan mengukur waktu gema. Suara merambat sekitar 343 m/s, jadi jarak dalam cm adalah waktu gema dalam mikrodetik dibagi 58.'),
  bullets:[b('wave','Trig starts a ping.','Trig memulai ping.'),b('ruler','Echo stays HIGH until the sound returns.','Echo tetap HIGH sampai suara kembali.'),b('eye','pulseIn measures that time.','pulseIn mengukur waktu itu.')]},
 pinout:[pinRow('D7','TRIG','TRIG','Output: 10 microsecond pulse.','Output: pulsa 10 mikrodetik.'),pinRow('D6','ECHO','ECHO','Input: pulse width is the distance.','Input: lebar pulsa adalah jarak.'),pinRow('5V / GND','Sensor power','Daya sensor','Powers the module.','Memberi daya modul.')],
 walkthrough:[c('Trig goes HIGH for 10 microseconds.','Trig HIGH selama 10 mikrodetik.'),c('pulseIn waits for the echo pulse.','pulseIn menunggu pulsa gema.'),c('Divide by 58 to get centimetres.','Bagi 58 untuk mendapat sentimeter.'),c('The value is printed to serial.','Nilainya dicetak ke serial.')],
 specs:[sp('Range','Jangkauan','2-400 cm'),sp('Supply','Daya','5 V'),sp('Speed of sound','Kecepatan suara','343 m/s')],
 callouts:[co('us1','left','HC-SR04','HC-SR04','Two eyes: one speaks, one listens.','Dua mata: satu bicara, satu mendengar.'),co('obs1','right','Obstacle','Halangan','Slide it nearer or farther.','Geser lebih dekat atau jauh.'),co('uno.digital-header','top','Trig pin','Pin Trig','Starts each ping.','Memulai tiap ping.','D7')],
 params:{interval:{label:c('Interval','Interval'),unit:'ms',hint:c('Time between measurements.','Waktu antar pengukuran.')}},
 goal:{text:c('Measure two different distances.','Ukur dua jarak berbeda.'),hint:c('Run, then move the obstacle.','Jalankan, lalu geser halangan.')},
 seo:{title:'Measure distance with HC-SR04',description:'Measure distance with an ultrasonic HC-SR04 sensor on a real emulated Arduino UNO. Move an obstacle and read centimetres on serial.'},
});
