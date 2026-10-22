import {defineLesson,c,co,pinRow,sp,b,w,ledOn,P,byKind,ledById,RAILS} from './kit';

export const lesson=defineLesson({
 id:'button',order:30,concept:'INPUT',keyPins:['D8','D2'],recordPins:['D8'],
 circuit:{parts:[{id:'btn1',kind:'button',net:{'1':'5V','2':'D2'},props:{pull:'down'}},{id:'r2',kind:'resistor',net:{'1':'D2','2':'GND'},props:{ohms:10000,role:'pull-down'}},...ledOn('led1','D8','red','r1')],wires:[w('btn1','2','D2','yellow'),w('r1','1','D8','orange'),...RAILS]},
 firmware:{variants:[{id:'hold',params:[]},{id:'toggle',params:[P('debounceMs','uint16',50,5,300,5)]}]},
 check:(s,m)=>{
  const b=byKind(s,'button'),l=ledById(s,'led1')??byKind(s,'led');
  if(!b||!l)return false;
  if(b.pressed&&l.on)m.lit=1;
  if(m.lit&&!l.on)m.off=1;
  return !!m.lit&&!!m.off;
 },
 readouts:()=>[],
 thumbnail:[{kind:'button',x:0}],
 title:c('Read a button','Baca tombol'),tagline:c('Turn a press into a decision.','Ubah tekanan menjadi keputusan.'),
 overview:{body:c('A push button connects two points while it is held. The sketch reads the pin and lights the LED in response. Choose hold mode (LED follows the button) or toggle mode (each press flips the LED).','Tombol menyambungkan dua titik saat ditekan. Sketsa membaca pin lalu menyalakan LED sebagai respons. Pilih mode tahan (LED mengikuti tombol) atau mode toggle (tiap tekan membalik LED).'),
  bullets:[b('dial','INPUT_PULLUP keeps the pin HIGH when idle.','INPUT_PULLUP menjaga pin HIGH saat diam.'),b('eye','A pressed button reads LOW.','Tombol ditekan terbaca LOW.'),b('loop','Debounce ignores contact bounce.','Debounce mengabaikan pantulan kontak.')]},
 pinout:[pinRow('D2','Button','Tombol','Input with internal pull-up.','Input dengan pull-up internal.'),pinRow('D8','LED via resistor','LED lewat resistor','Output.','Output.'),pinRow('GND','Button other side','Sisi lain tombol','Pulls the pin LOW when pressed.','Menarik pin ke LOW saat ditekan.')],
 walkthrough:[c('The button pin uses the internal pull-up resistor.','Pin tombol memakai resistor pull-up internal.'),c('digitalRead returns LOW while pressed.','digitalRead bernilai LOW saat ditekan.'),c('Hold mode copies the button to the LED.','Mode tahan menyalin tombol ke LED.'),c('Toggle mode flips the LED once per press.','Mode toggle membalik LED sekali per tekan.')],
 specs:[sp('Input','Input','INPUT_PULLUP'),sp('Idle level','Level diam','HIGH'),sp('Pressed level','Level ditekan','LOW')],
 callouts:[co('btn1','left','Button','Tombol','Hold it down with the Hold control.','Tahan dengan kontrol Tahan.'),co('led1','right','LED','LED','Reacts to the button.','Bereaksi pada tombol.'),co('uno.digital-header','top','Pin 2','Pin 2','Reads the button state.','Membaca status tombol.','D2')],
 params:{debounceMs:{label:c('Debounce','Debounce'),unit:'ms',hint:c('Ignore changes shorter than this.','Abaikan perubahan lebih singkat dari ini.')}},
 variants:{hold:c('Hold','Tahan'),toggle:c('Toggle','Toggle')},
 goal:{text:c('Light the LED with the button, then let it go dark.','Nyalakan LED dengan tombol, lalu biarkan padam.'),hint:c('Run, hold the button, then release.','Jalankan, tahan tombol, lalu lepas.')},
 seo:{title:'Read a button with Arduino',description:'Read a push button with INPUT_PULLUP on a real emulated Arduino UNO. Compare hold and toggle modes and tune the debounce time.'},
});
