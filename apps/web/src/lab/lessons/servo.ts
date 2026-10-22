import {defineLesson,c,co,pinRow,sp,b,w,P,byKind,range,idOf,pill} from './kit';

export const lesson=defineLesson({
 id:'servo',order:100,concept:'SERVO',keyPins:['D9'],recordPins:['D9'],
 circuit:{parts:[{id:'sv1',kind:'servo',net:{SIG:'D9',V:'5V',GND:'GND'},props:{}}],wires:[w('sv1','SIG','D9','orange'),w('sv1','V','5V','red'),w('sv1','GND','GND','black')]},
 firmware:{variants:[{id:'default',params:[P('fromDeg','uint8',10,0,90,5),P('toDeg','uint8',170,90,180,5),P('stepMs','uint8',15,2,50,1)]}]},
 check:(s,m)=>{const v=byKind(s,'servo');return !!v&&range(m,'ang',v.angleDeg)>=90;},
 readouts:s=>{const v=byKind(s,'servo'),id=idOf(s,'servo');return v&&id?[pill(id,`${Math.round(v.angleDeg)}°`)]:[];},
 thumbnail:[{kind:'servo',x:0}],
 title:c('Sweep a servo','Gerakkan servo'),tagline:c('Angles from pulse widths.','Sudut dari lebar pulsa.'),
 overview:{body:c('A hobby servo reads a pulse every 20 ms. A 1 ms pulse means 0 degrees and 2 ms means 180 degrees. The Servo library produces those pulses and the sketch sweeps the angle back and forth.','Servo hobi membaca pulsa setiap 20 ms. Pulsa 1 ms berarti 0 derajat dan 2 ms berarti 180 derajat. Pustaka Servo membuat pulsa itu dan sketsa menyapu sudut bolak-balik.'),
  bullets:[b('gear','Position is held by feedback inside.','Posisi dijaga oleh umpan balik di dalam.'),b('wave','Pulse width encodes the angle.','Lebar pulsa menyandikan sudut.'),b('loop','The sweep reverses at the ends.','Sapuan berbalik di ujung.')]},
 pinout:[pinRow('D9','Signal','Sinyal','Pulse output.','Output pulsa.'),pinRow('5V','Power','Daya','Servo supply.','Daya servo.'),pinRow('GND','Ground','Ground','Return.','Kembali.')],
 walkthrough:[c('servo.attach binds the pin.','servo.attach mengikat pin.'),c('servo.write sets the angle.','servo.write mengatur sudut.'),c('The loop steps from fromDeg to toDeg and back.','Putaran melangkah dari fromDeg ke toDeg dan kembali.')],
 specs:[sp('Pulse','Pulsa','1000-2000 us'),sp('Period','Periode','20 ms'),sp('Pin','Pin','D9')],
 callouts:[co('sv1','right','Servo','Servo','The arm follows the pulse.','Lengan mengikuti pulsa.'),co('uno.digital-header','left','Pin 9','Pin 9','Signal wire.','Kabel sinyal.','D9'),co('uno.mcu','top','Chip','Chip','Times the pulses.','Menghitung waktu pulsa.')],
 params:{fromDeg:{label:c('From','Dari'),unit:'deg',hint:c('Start angle.','Sudut awal.')},toDeg:{label:c('To','Ke'),unit:'deg',hint:c('End angle.','Sudut akhir.')},stepMs:{label:c('Step time','Waktu langkah'),unit:'ms',hint:c('Wait per degree.','Jeda per derajat.')}},
 goal:{text:c('Sweep the servo through at least 90 degrees.','Sapu servo minimal 90 derajat.'),hint:c('Run and wait.','Jalankan dan tunggu.')},
 seo:{title:'Sweep a servo with Arduino',description:'Sweep a hobby servo with the Servo library on a real emulated Arduino UNO. Set the start, end and speed and watch the arm move.'},
});
