import {defineLesson,c,co,pinRow,sp,b,w,ledOn,P,byKind,ledById,changes,GND_RAIL,LIT_LED} from './kit';

export const lesson=defineLesson({
 id:'blink',order:20,concept:'OUTPUT',keyPins:['D8'],recordPins:['D8'],
 circuit:{parts:[...ledOn('led1','D8','red','r1')],wires:[w('r1','1','D8','orange'),GND_RAIL]},
 firmware:{variants:[{id:'default',params:[P('onTime','uint16',500,50,2000,50),P('offTime','uint16',500,50,2000,50)]}]},
 check:(s,m)=>{const l=ledById(s,'led1')??byKind(s,'led');return !!l&&changes(m,'on',l.on?1:0)>=4;},
 readouts:()=>[],
 thumbnail:[{kind:'led',props:{color:'red'},x:0,state:LIT_LED},{kind:'resistor',props:{ohms:220},x:14}],
 title:c('Blink an LED','Kedipkan LED'),tagline:c('The hello world of hardware.','Hello world-nya dunia hardware.'),
 overview:{body:c('An LED lights up when current flows through it. A resistor limits that current so the LED survives. The sketch turns pin 8 on and off with a pause in between.','LED menyala saat arus mengalir. Resistor membatasi arus agar LED awet. Sketsa menyalakan dan mematikan pin 8 dengan jeda di antaranya.'),
  bullets:[b('led','An LED only works one way round.','LED hanya bekerja pada satu arah.'),b('plug','The resistor protects the LED.','Resistor melindungi LED.'),b('loop','Change the times to change the rhythm.','Ubah waktunya untuk mengubah ritme.')]},
 pinout:[pinRow('D8','LED anode via resistor','Anoda LED lewat resistor','Output that powers the LED.','Output yang menyalakan LED.'),pinRow('GND','LED cathode','Katoda LED','Completes the circuit.','Melengkapi rangkaian.')],
 walkthrough:[c('pinMode makes pin 8 an output.','pinMode menjadikan pin 8 output.'),c('digitalWrite HIGH turns the LED on.','digitalWrite HIGH menyalakan LED.'),c('The first delay keeps it on for onTime ms.','delay pertama menahannya menyala selama onTime ms.'),c('LOW and the second delay keep it off for offTime ms.','LOW dan delay kedua menahannya mati selama offTime ms.')],
 specs:[sp('LED current','Arus LED','~15 mA'),sp('Resistor','Resistor','220 ohm'),sp('Pin','Pin','D8')],
 callouts:[co('led1','right','LED','LED','Longer leg to the resistor side.','Kaki panjang ke sisi resistor.'),co('r1','left','Resistor','Resistor','Limits current. Try other values.','Membatasi arus. Coba nilai lain.'),co('uno.digital-header','top','Pin 8','Pin 8','The output that switches the LED.','Output yang menyalakan LED.','D8'),co('uno.power-header','top','GND','GND','Return path back to the chip.','Jalur kembali ke chip.','GND')],
 params:{onTime:{label:c('On time','Waktu nyala'),unit:'ms',hint:c('How long the LED stays on.','Berapa lama LED menyala.')},offTime:{label:c('Off time','Waktu mati'),unit:'ms',hint:c('How long the LED stays off.','Berapa lama LED mati.')}},
 goal:{text:c('See the LED blink 4 times.','Lihat LED berkedip 4 kali.'),hint:c('Press Run.','Tekan Jalankan.')},
 seo:{title:'Blink an LED on Arduino UNO',description:'Blink an LED with real Arduino firmware running in an ATmega328P emulator. Change the on and off times and watch the rhythm change.'},
});
