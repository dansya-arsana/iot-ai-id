import {defineLesson,c,co,pinRow,sp,b,w,P,byKind,idOf,pill,RAILS,MOTOR_MAX_RPM} from './kit';

export const lesson=defineLesson({
 id:'motor',order:90,concept:'TRANSISTOR',keyPins:['D6'],recordPins:['D6'],
 circuit:{parts:[{id:'q1',kind:'transistor',net:{B:'D6',E:'GND'},props:{model:'NPN'}},{id:'rb',kind:'resistor',net:{'1':'D6'},props:{ohms:1000,role:'base'}},{id:'d1',kind:'diode',net:{K:'5V'},props:{}},{id:'m1',kind:'motor',net:{DRIVE:'D6'},props:{}}],wires:[w('rb','1','D6','orange'),...RAILS]},
 firmware:{variants:[{id:'default',params:[P('topSpeed','uint8',200,60,255,5),P('stepMs','uint8',20,5,100,5)]}]},
 check:(s)=>{const mo=byKind(s,'motor');return !!mo&&mo.rpm>=0.5*MOTOR_MAX_RPM;},
 readouts:s=>{
  const m=byKind(s,'motor'),id=idOf(s,'motor');
  return m&&id?[pill(id,`${Math.round(m.duty*100)}% · ${Math.round(m.rpm)} rpm`)]:[];
 },
 thumbnail:[{kind:'motor',x:0}],
 title:c('Drive a DC motor','Kendalikan motor DC'),tagline:c('Let a transistor carry the heavy load.','Biarkan transistor memikul beban berat.'),
 overview:{body:c('A pin can only supply a few milliamps, far too little for a motor. A transistor acts as a switch that the pin controls, while the power comes from elsewhere. PWM sets the average power and so the speed.','Satu pin hanya bisa memberi beberapa miliampere, jauh dari cukup untuk motor. Transistor bertindak sebagai saklar yang dikendalikan pin, sementara dayanya datang dari sumber lain. PWM mengatur daya rata-rata dan karenanya kecepatan.'),
  bullets:[b('gear','The transistor switches the motor.','Transistor menyakelar motor.'),b('wave','Duty cycle sets the speed.','Duty cycle mengatur kecepatan.'),b('bolt','A diode absorbs voltage spikes.','Dioda menyerap lonjakan tegangan.')]},
 pinout:[pinRow('D6','Transistor base','Basis transistor','PWM output.','Output PWM.'),pinRow('5V','Motor supply','Daya motor','Power for the motor.','Daya untuk motor.')],
 walkthrough:[c('The motor speed ramps up toward topSpeed.','Kecepatan motor naik menuju topSpeed.'),c('analogWrite sets the PWM duty.','analogWrite mengatur duty PWM.'),c('Each step waits stepMs.','Tiap langkah menunggu stepMs.')],
 specs:[sp('Control','Kontrol','PWM'),sp('Pin','Pin','D6'),sp('Protection','Proteksi','Flyback diode','Dioda flyback')],
 callouts:[co('m1','right','Motor','Motor','Spins faster with more duty.','Berputar lebih cepat dengan duty lebih besar.'),co('uno.digital-header','left','Pin 6','Pin 6','PWM to the transistor.','PWM ke transistor.','D6'),co('uno.mcu','top','Chip','Chip','Generates the PWM.','Menghasilkan PWM.')],
 params:{topSpeed:{label:c('Top speed','Kecepatan puncak'),unit:'/255',hint:c('Final PWM level.','Level PWM akhir.')},stepMs:{label:c('Step time','Waktu langkah'),unit:'ms',hint:c('Delay between speed steps.','Jeda antar langkah kecepatan.')}},
 goal:{text:c('Spin the motor up to speed.','Putar motor hingga kencang.'),hint:c('Run and wait for the ramp.','Jalankan dan tunggu kecepatan naik.')},
 seo:{title:'Drive a DC motor with PWM',description:'Drive a DC motor through a transistor with PWM on an emulated Arduino UNO. Tune top speed and ramp time and watch the rpm.'},
});
