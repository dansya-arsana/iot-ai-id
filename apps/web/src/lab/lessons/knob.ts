import {defineLesson,c,co,pinRow,sp,b,w,ledOn,P,byKind,ledById,range,idOf,pill,RAILS} from './kit';

export const lesson=defineLesson({
 id:'knob',order:40,concept:'ADC',keyPins:['D9','A0'],recordPins:['D9'],
 circuit:{parts:[{id:'pot1',kind:'potentiometer',net:{VCC:'5V',SIG:'A0',GND:'GND'},props:{value:512}},...ledOn('led1','D9','green','r1')],wires:[w('pot1','SIG','A0','yellow'),w('r1','1','D9','orange'),...RAILS]},
 firmware:{variants:[{id:'default',params:[P('printEvery','uint16',200,50,1000,50)]}]},
 check:(s,m)=>{
  const p=byKind(s,'potentiometer'),l=ledById(s,'led1')??byKind(s,'led');
  if(!p||!l)return false;
  const pr=range(m,'pot',p.value),br=range(m,'br',l.brightness);
  return pr>=300&&br>=0.5;
 },
 readouts:s=>{const p=byKind(s,'potentiometer'),id=idOf(s,'potentiometer');return p&&id?[pill(id,`A0 ${Math.round(p.value)} → PWM ${Math.round(p.value/4)} (${Math.round(p.value/1023*100)}%)`)]:[];},
 thumbnail:[{kind:'potentiometer',props:{value:640},x:0,state:{kind:'potentiometer',value:640}}],
 title:c('Dim with a knob','Redupkan dengan kenop'),tagline:c('Analog in, PWM out.','Analog masuk, PWM keluar.'),
 overview:{body:c('A potentiometer is a knob that outputs a voltage from 0 to 5 V. analogRead turns it into a number from 0 to 1023. The sketch scales that to 0-255 and uses PWM to dim the LED.','Potensiometer adalah kenop yang menghasilkan tegangan 0 sampai 5 V. analogRead mengubahnya menjadi angka 0 sampai 1023. Sketsa menskalakannya ke 0-255 dan memakai PWM untuk meredupkan LED.'),
  bullets:[b('dial','10-bit ADC gives 1024 steps.','ADC 10-bit memberi 1024 tingkat.'),b('wave','PWM switches fast to fake a dimmer.','PWM menyala-mati cepat untuk meniru peredup.'),b('eye','Serial prints the reading.','Serial mencetak nilai bacaan.')]},
 pinout:[pinRow('A0','Knob wiper','Wiper kenop','Analog input.','Input analog.'),pinRow('D9','LED via resistor','LED lewat resistor','PWM output.','Output PWM.'),pinRow('5V','Knob end','Ujung kenop','Top of the voltage range.','Ujung atas rentang tegangan.')],
 walkthrough:[c('analogRead(A0) returns 0-1023.','analogRead(A0) mengembalikan 0-1023.'),c('map scales it to 0-255.','map menskalakannya ke 0-255.'),c('analogWrite sets the PWM duty.','analogWrite mengatur duty PWM.'),c('Serial prints the value every few loops.','Serial mencetak nilai setiap beberapa putaran.')],
 specs:[sp('ADC','ADC','10 bit'),sp('PWM','PWM','8 bit, ~490 Hz'),sp('Baud','Baud','9600')],
 callouts:[co('pot1','left','Knob','Kenop','Drag the knob or use the slider.','Putar kenop atau pakai slider.'),co('led1','right','LED','LED','Brightness follows the knob.','Kecerahan mengikuti kenop.'),co('uno.analog-header','top','Pin A0','Pin A0','Analog input.','Input analog.','A0')],
 params:{printEvery:{label:c('Print every','Cetak tiap'),unit:'loops',hint:c('Loops between serial lines.','Jumlah putaran antar baris serial.')}},
 goal:{text:c('Sweep the knob and see the LED change brightness.','Putar kenop dan lihat kecerahan LED berubah.'),hint:c('Run, then drag the knob across its range.','Jalankan, lalu geser kenop di seluruh rentangnya.')},
 seo:{title:'Dim an LED with a knob',description:'Read a potentiometer with analogRead and dim an LED with PWM on a real emulated Arduino UNO. Watch live values in the serial monitor.'},
});
