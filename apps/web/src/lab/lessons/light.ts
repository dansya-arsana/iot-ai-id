import {defineLesson,c,co,pinRow,sp,b,w,ledOn,P,byKind,ledById,changes,idOf,pill,RAILS} from './kit';

export const lesson=defineLesson({
 id:'light',order:60,concept:'LDR',keyPins:['A1','D8'],recordPins:['A1'],
 circuit:{parts:[{id:'ldr1',kind:'ldr',net:{A:'5V',B:'A1'},props:{fixedOhms:10000}},{id:'r2',kind:'resistor',net:{'1':'A1','2':'GND'},props:{ohms:10000,role:'divider'}},{id:'lamp1',kind:'lamp',net:{},props:{target:'ldr1',distanceCm:40,on:true}},...ledOn('led1','D8','yellow','r1')],wires:[w('ldr1','B','A1','green'),w('r1','1','D8','orange'),...RAILS]},
 firmware:{variants:[{id:'default',params:[P('threshold','uint16',400,50,1000,10)]}]},
 check:(s,m)=>{const l=ledById(s,'led1')??byKind(s,'led');return !!l&&changes(m,'on',l.on?1:0)>=1;},
 readouts:s=>{const l=byKind(s,'ldr'),id=idOf(s,'ldr');return l&&id?[pill(id,`light ${Math.round(l.adc)}`)]:[];},
 thumbnail:[{kind:'ldr',x:0},{kind:'lamp',props:{distanceCm:40,on:true},x:34,z:-6,state:{kind:'lamp',distanceCm:40,on:true}}],
 title:c('Automatic night light','Lampu malam otomatis'),tagline:c('Sense the dark, switch on the light.','Rasakan gelap, nyalakan lampu.'),
 overview:{body:c('A light dependent resistor (LDR) changes resistance with brightness. With a fixed resistor it forms a voltage divider that analogRead can measure. When the reading falls below a threshold the LED turns on.','LDR mengubah hambatan sesuai cahaya. Bersama resistor tetap, ia membentuk pembagi tegangan yang bisa dibaca analogRead. Saat bacaan di bawah ambang, LED menyala.'),
  bullets:[b('sun','Brighter light gives a bigger reading.','Cahaya lebih terang memberi bacaan lebih besar.'),b('dial','The threshold decides when it is dark.','Ambang menentukan kapan dianggap gelap.'),b('led','The LED is the night light.','LED adalah lampu malamnya.')]},
 pinout:[pinRow('A1','LDR divider','Pembagi LDR','Analog input.','Input analog.'),pinRow('D8','LED via resistor','LED lewat resistor','Output.','Output.')],
 walkthrough:[c('analogRead measures the light level.','analogRead mengukur tingkat cahaya.'),c('If it is below threshold, the room is dark.','Jika di bawah ambang, ruangan gelap.'),c('Then the LED is switched on, otherwise off.','Maka LED dinyalakan, jika tidak dimatikan.')],
 specs:[sp('Sensor','Sensor','LDR'),sp('Reading','Bacaan','0-1023'),sp('Pin','Pin','A0')],
 callouts:[co('ldr1','left','LDR','LDR','Light changes its resistance.','Cahaya mengubah hambatannya.'),co('lamp1','top','Lamp','Lampu','Move it closer or switch it off.','Dekatkan atau matikan.'),co('led1','right','LED','LED','The night light.','Lampu malamnya.')],
 params:{threshold:{label:c('Threshold','Ambang'),unit:'',hint:c('Below this reading it counts as dark.','Di bawah bacaan ini dianggap gelap.')}},
 goal:{text:c('Switch the lamp and see the LED react.','Ubah lampu dan lihat LED bereaksi.'),hint:c('Run, then turn the lamp off.','Jalankan, lalu matikan lampu.')},
 seo:{title:'Build an automatic night light',description:'Build a night light with an LDR and analogRead on an emulated Arduino UNO. Move the lamp and tune the dark threshold live.'},
});
