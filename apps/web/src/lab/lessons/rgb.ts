import {defineLesson,c,co,pinRow,sp,b,w,P,byKind,idOf,pill,GND_RAIL} from './kit';

export const lesson=defineLesson({
 id:'rgb',order:50,concept:'PWM',keyPins:['D9','D10','D11'],recordPins:['D9','D10','D11'],
 circuit:{parts:[{id:'rgb1',kind:'rgb-led',net:{R:'D9',G:'D10',B:'D11',K:'GND'},props:{}},{id:'rR',kind:'resistor',net:{'1':'D9'},props:{ohms:220,seriesWith:'rgb1',role:'series'}},{id:'rG',kind:'resistor',net:{'1':'D10'},props:{ohms:220,seriesWith:'rgb1',role:'series'}},{id:'rB',kind:'resistor',net:{'1':'D11'},props:{ohms:220,seriesWith:'rgb1',role:'series'}}],wires:[w('rR','1','D9','orange'),w('rG','1','D10','green'),w('rB','1','D11','blue'),GND_RAIL]},
 firmware:{variants:[{id:'default',params:[P('red','uint8',255,0,255,1),P('green','uint8',64,0,255,1),P('blue','uint8',160,0,255,1)]}]},
 check:(s)=>{const r=byKind(s,'rgb-led');return !!r&&s.simTimeMs>=1000&&r.r+r.g+r.b>0.3;},
 readouts:s=>{
  const r=byKind(s,'rgb-led'),id=idOf(s,'rgb-led');
  return r&&id?[pill(id,`R ${Math.round(r.r*255)} · G ${Math.round(r.g*255)} · B ${Math.round(r.b*255)}`)]:[];
 },
 thumbnail:[{kind:'rgb-led',x:0,state:{kind:'rgb-led',r:1,g:0.08,b:0.6}}],
 title:c('Mix light with PWM','Campur warna dengan PWM'),tagline:c('Three channels, any colour.','Tiga kanal, warna apa pun.'),
 overview:{body:c('An RGB LED packs a red, a green and a blue LED in one lens. Giving each a PWM level from 0 to 255 mixes the colour you see.','LED RGB memuat LED merah, hijau, dan biru dalam satu lensa. Memberi tiap kanal level PWM 0 sampai 255 mencampur warna yang terlihat.'),
  bullets:[b('sun','Red plus green looks yellow.','Merah plus hijau tampak kuning.'),b('wave','Each colour is its own PWM pin.','Tiap warna punya pin PWM sendiri.'),b('dial','Try 255, 64, 160.','Coba 255, 64, 160.')]},
 pinout:[pinRow('D9','Red channel','Kanal merah','PWM.','PWM.'),pinRow('D10','Green channel','Kanal hijau','PWM.','PWM.'),pinRow('D11','Blue channel','Kanal biru','PWM.','PWM.')],
 walkthrough:[c('Three constants hold the colour levels.','Tiga konstanta menyimpan level warna.'),c('analogWrite sends each level to its pin.','analogWrite mengirim tiap level ke pinnya.'),c('Change a value to mix a new colour.','Ubah nilai untuk mencampur warna baru.')],
 specs:[sp('Channels','Kanal','3'),sp('Range','Rentang','0-255'),sp('Type','Jenis','Common cathode','Katoda bersama')],
 callouts:[co('rgb1','right','RGB LED','LED RGB','Three LEDs in one.','Tiga LED dalam satu.'),co('uno.digital-header','left','Pin 9','Pin 9','Red PWM.','PWM merah.','D9'),co('uno.digital-header','top','Pin 11','Pin 11','Blue PWM.','PWM biru.','D11')],
 params:{red:{label:c('Red','Merah'),unit:'/255',hint:c('Red level.','Level merah.')},green:{label:c('Green','Hijau'),unit:'/255',hint:c('Green level.','Level hijau.')},blue:{label:c('Blue','Biru'),unit:'/255',hint:c('Blue level.','Level biru.')}},
 goal:{text:c('Light the RGB LED.','Nyalakan LED RGB.'),hint:c('Press Run and let it run for a second.','Tekan Jalankan dan biarkan sedetik.')},
 seo:{title:'Mix colours with an RGB LED',description:'Mix any colour with three PWM channels on an RGB LED, driven by real firmware in an emulated Arduino UNO that you can tweak live.'},
});
