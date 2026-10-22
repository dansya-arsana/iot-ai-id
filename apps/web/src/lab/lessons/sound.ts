import {defineLesson,c,co,pinRow,sp,b,w,P,byKind,idOf,pill} from './kit';

export const lesson=defineLesson({
 id:'sound',order:80,concept:'TONE',keyPins:['D5'],recordPins:['D5'],
 circuit:{parts:[{id:'bz1',kind:'buzzer',net:{'+':'D5','-':'GND'},props:{}}],wires:[w('bz1','+','D5','orange'),w('bz1','-','GND','black')]},
 firmware:{variants:[{id:'scale',params:[P('noteMs','uint16',300,60,800,20)]},{id:'alarm',params:[P('noteMs','uint16',300,60,800,20)]}]},
 check:(s,m)=>{
  const b=byKind(s,'buzzer');
  if(b&&b.on&&b.freqHz>0)m['f:'+Math.round(b.freqHz/10)*10]=1;
  return Object.keys(m).filter(k=>k.startsWith('f:')).length>=2;
 },
 readouts:s=>{const b=byKind(s,'buzzer'),id=idOf(s,'buzzer');return b&&id&&b.on?[pill(id,`♪ ${Math.round(b.freqHz)} Hz`)]:[];},
 thumbnail:[{kind:'buzzer',x:0}],
 title:c('Play tones','Mainkan nada'),tagline:c('Turn pin toggles into music.','Ubah getar pin menjadi musik.'),
 overview:{body:c('A passive buzzer makes sound when a pin switches on and off fast. The tone() function picks the frequency. Higher frequency means a higher pitch. Choose a scale or an alarm pattern.','Buzzer pasif berbunyi saat pin menyala-mati cepat. Fungsi tone() memilih frekuensi. Frekuensi lebih tinggi berarti nada lebih tinggi. Pilih tangga nada atau pola alarm.'),
  bullets:[b('note','523 Hz is the note C5.','523 Hz adalah nada C5.'),b('wave','tone() uses a hardware timer.','tone() memakai timer perangkat keras.'),b('loop','Notes play in a loop.','Nada diputar berulang.')]},
 pinout:[pinRow('D5','Buzzer','Buzzer','Square wave output.','Output gelombang persegi.'),pinRow('GND','Buzzer return','Kembali buzzer','Ground.','Ground.')],
 walkthrough:[c('tone(pin, freq) starts a square wave.','tone(pin, freq) memulai gelombang persegi.'),c('delay keeps each note for noteMs.','delay menahan tiap nada selama noteMs.'),c('noTone() silences the pin.','noTone() membisukan pin.')],
 specs:[sp('Type','Jenis','Passive buzzer','Buzzer pasif'),sp('Range','Rentang','~200-2000 Hz'),sp('Pin','Pin','D5')],
 callouts:[co('bz1','right','Buzzer','Buzzer','Hear it with sound on.','Dengarkan dengan suara aktif.'),co('uno.digital-header','left','Pin 5','Pin 5','Timer-driven output.','Output yang digerakkan timer.','D5'),co('uno.mcu','top','Timer','Timer','Makes the frequency.','Menghasilkan frekuensi.')],
 params:{noteMs:{label:c('Note length','Panjang nada'),unit:'ms',hint:c('How long each note plays.','Berapa lama tiap nada.')}},
 variants:{scale:c('Scale','Tangga nada'),alarm:c('Alarm','Alarm')},
 goal:{text:c('Hear two different notes.','Dengar dua nada berbeda.'),hint:c('Run and enable sound in settings.','Jalankan dan aktifkan suara di pengaturan.')},
 seo:{title:'Play tones with Arduino tone()',description:'Play a scale or an alarm with tone() on a real emulated Arduino UNO. Change note length and hear the buzzer in your browser.'},
});
