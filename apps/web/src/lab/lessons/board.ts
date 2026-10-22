import {defineLesson,c,co,pinRow,sp,b,P,changes,pinOf} from './kit';

export const lesson=defineLesson({
 id:'board',order:10,concept:'BOARD',keyPins:['D13'],recordPins:['D13'],
 circuit:{parts:[],wires:[]},
 firmware:{variants:[{id:'default',params:[P('waitMs','uint16',1000,100,3000,100)]}]},
 check:(s,m)=>changes(m,'d13',pinOf(s,'D13')?.level??0)>=4,
 readouts:()=>[],
 thumbnail:'uno',
 title:c('Meet the UNO','Kenalan dengan UNO'),tagline:c('Tour the board, then watch pin 13 breathe.','Keliling papan, lalu lihat pin 13 berdenyut.'),
 overview:{body:c('The Arduino UNO is a small computer built around the ATmega328P chip. It has rows of pins that you wire to lights, buttons and sensors. Here the board already runs a tiny program that toggles the built-in LED on pin 13.','Arduino UNO adalah komputer kecil dengan chip ATmega328P. Papan ini punya deretan pin untuk dihubungkan ke lampu, tombol, dan sensor. Di sini papan sudah menjalankan program kecil yang menyalakan dan mematikan LED bawaan di pin 13.'),
  bullets:[b('chip','The chip runs your sketch at 16 MHz.','Chip menjalankan sketsamu pada 16 MHz.'),b('bolt','USB or the barrel jack powers the board.','USB atau jack baterai memberi daya ke papan.'),b('led','A small LED on pin 13 shows what the code does.','LED kecil di pin 13 menunjukkan kerja kode.')]},
 pinout:[pinRow('D13','Built-in LED (L)','LED bawaan (L)','Toggled by the sketch.','Dinyalakan dan dimatikan oleh sketsa.'),pinRow('5V','Power rail','Jalur daya','Supplies 5 volts to parts.','Memberi 5 volt ke komponen.'),pinRow('GND','Ground rail','Jalur ground','Return path for current.','Jalur kembali arus.')],
 walkthrough:[c('setup() runs once and makes pin 13 an output.','setup() berjalan sekali dan menjadikan pin 13 sebagai output.'),c('loop() repeats forever.','loop() berulang terus-menerus.'),c('digitalWrite sets the pin HIGH (5 V) or LOW (0 V).','digitalWrite mengatur pin HIGH (5 V) atau LOW (0 V).'),c('delay() pauses the program for a number of milliseconds.','delay() menjeda program selama beberapa milidetik.')],
 specs:[sp('Chip','Chip','ATmega328P'),sp('Clock','Clock','16 MHz'),sp('Flash','Flash','32 KB'),sp('SRAM','SRAM','2 KB'),sp('Logic level','Level logika','5 V')],
 callouts:[co('uno.led-l','right','Pin 13','Pin 13','This pin drives the on-board LED.','Pin ini menyalakan LED bawaan.'),co('uno.usb','left','USB port','Port USB','Power and uploads come in here.','Daya dan unggahan program masuk lewat sini.'),co('uno.mcu','top','ATmega328P','ATmega328P','The brain that runs your sketch.','Otak yang menjalankan sketsamu.')],
 params:{waitMs:{label:c('Wait','Jeda'),unit:'ms',hint:c('Time between toggles.','Waktu antar perubahan.')}},
 goal:{text:c('Watch the pin 13 LED toggle 4 times.','Lihat LED pin 13 berganti 4 kali.'),hint:c('Press Run and wait a few seconds.','Tekan Jalankan dan tunggu beberapa detik.')},
 seo:{title:'Meet the Arduino UNO: board tour',description:'Tour the Arduino UNO board in 3D and watch real firmware toggle the pin 13 LED in an emulated ATmega328P, right in your browser.'},
});
