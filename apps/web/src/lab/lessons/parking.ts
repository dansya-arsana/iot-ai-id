import {defineLesson,c,co,pinRow,sp,b,w,ledOn,sonar,P,byKind,ledById,idOf,pill,GND_RAIL,SONAR_WIRES} from './kit';

export const lesson=defineLesson({
 id:'parking',order:110,concept:'PROJECT',keyPins:['D7','D6','D12','D10','D11','D5'],recordPins:['D7','D12'],
 circuit:{parts:[...sonar(60,'car'),...ledOn('ledG','D10','green','rG'),...ledOn('ledY','D11','yellow','rY'),...ledOn('ledR','D12','red','rR'),{id:'bz1',kind:'buzzer',net:{'+':'D5','-':'GND'},props:{}}],wires:[...SONAR_WIRES,w('rG','1','D10','green'),w('rY','1','D11','yellow'),w('rR','1','D12','orange'),w('bz1','+','D5','purple'),GND_RAIL]},
 firmware:{variants:[{id:'default',params:[P('nearCm','uint16',15,5,50,1),P('farCm','uint16',40,20,150,5)]}]},
 check:(s,m)=>{
  const r=ledById(s,'ledR'),g=ledById(s,'ledG'),h=byKind(s,'hcsr04');
  if(r?.on){m.r=1;if(h?.echoCm!=null&&m.rAt===undefined)m.rAt=h.echoCm;}
  if(g?.on){m.g=1;if(h?.echoCm!=null&&m.gAt===undefined)m.gAt=h.echoCm;}
  return !!m.r&&!!m.g;
 },
 readouts:s=>{
  const h=byKind(s,'hcsr04'),hid=idOf(s,'hcsr04'),l=ledById(s,'ledR');
  const out:{target:string;text:string}[]=[];
  if(h&&hid&&h.echoCm!==null)out.push(pill(hid,`${Math.round(h.echoCm)} cm`));
  if(l?.on)out.push(pill('ledR',`${l.currentMa.toFixed(1)} mA`));
  return out;
 },
 thumbnail:[{kind:'hcsr04',x:0,z:0},{kind:'obstacle',props:{shape:'car',distanceCm:30},x:0,z:34,state:{kind:'obstacle',distanceCm:30}}],
 title:c('Project: parking sensor','Proyek: sensor parkir'),tagline:c('Combine distance and lights.','Gabungkan jarak dan lampu.'),
 overview:{body:c('Put it together: an ultrasonic sensor measures how far the car is from the wall. Green means plenty of room, red means stop. The two distances are yours to tune.','Gabungkan semuanya: sensor ultrasonik mengukur jarak mobil ke tembok. Hijau berarti lega, merah berarti berhenti. Kedua jarak bisa kamu atur.'),
  bullets:[b('ruler','Measure with the HC-SR04.','Ukur dengan HC-SR04.'),b('led','Red when closer than nearCm.','Merah saat lebih dekat dari nearCm.'),b('check','Green when farther than farCm.','Hijau saat lebih jauh dari farCm.')]},
 pinout:[pinRow('D7 / D6','Trig / Echo','Trig / Echo','Distance sensor.','Sensor jarak.'),pinRow('D12','Red LED','LED merah','Danger.','Bahaya.'),pinRow('D10','Green LED','LED hijau','Clear.','Aman.')],
 walkthrough:[c('Measure the distance like in lesson 7.','Ukur jarak seperti pelajaran 7.'),c('Closer than nearCm: red on.','Lebih dekat dari nearCm: merah menyala.'),c('Farther than farCm: green on.','Lebih jauh dari farCm: hijau menyala.'),c('In between both lights follow the rule.','Di antaranya kedua lampu mengikuti aturan.')],
 specs:[sp('Sensor','Sensor','HC-SR04'),sp('Lights','Lampu','2 LEDs','2 LED'),sp('Logic','Logika','Thresholds','Ambang')],
 callouts:[co('us1','left','Distance sensor','Sensor jarak','Measures the gap.','Mengukur celah.'),co('ledR','right','Traffic light','Lampu lalu lintas','Click it to change the thresholds.','Klik untuk mengubah batasnya.'),co('uno.mcu','top','Your logic','Logikamu','The sketch compares the distance with two limits.','Sketsa membandingkan jarak dengan dua batas.'),co('obs1','right','Obstacle','Halangan','Drag it closer and watch the lights.','Seret lebih dekat dan lihat lampunya.')],
 params:{nearCm:{label:c('Near','Dekat'),unit:'cm',hint:c('Red below this.','Merah di bawah ini.')},farCm:{label:c('Far','Jauh'),unit:'cm',hint:c('Green above this.','Hijau di atas ini.')}},
 goal:{text:c('See both the red and the green light.','Lihat lampu merah dan hijau.'),hint:c('Run, then move the obstacle near and far.','Jalankan, lalu geser halangan dekat dan jauh.')},
 seo:{title:'Project: Arduino parking sensor',description:'Build a parking sensor with an ultrasonic sensor and two LEDs on a real emulated Arduino UNO. Tune the near and far distances.'},
});
