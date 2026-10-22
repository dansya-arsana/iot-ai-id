import {defineLesson,c,co,pinRow,sp,b,w,ledOn,P,ledById,extOf,extId,pill,RAILS} from './kit';

export const lesson=defineLesson({
 id:'plant',order:150,view:{az:6,elev:44,board:true},concept:'I2C + ADC',keyPins:['A0','D8'],recordPins:['A0','D8'],
 circuit:{parts:[{id:'lcd1',kind:'lcd1602-i2c',net:{GND:'GND',VCC:'5V',SDA:'A4',SCL:'A5'},props:{}},{id:'soil1',kind:'soil-moisture',net:{VCC:'5V',SIG:'A0',GND:'GND'},props:{wetness:55}},...ledOn('led1','D8','red','r1')],wires:[w('soil1','SIG','A0','yellow'),w('lcd1','SDA','A4','blue'),w('lcd1','SCL','A5','purple'),w('r1','1','D8','orange'),...RAILS]},
 firmware:{variants:[{id:'default',params:[P('dryBelow','uint8',30,5,90,5)]}]},
 check:(s,m)=>{
  const l=extOf(s,'lcd1602-i2c'),led=ledById(s,'led1');
  if(!l)return false;
  const line=String(l.line2??'');
  if(line.includes('Needs water')){m.dry=1;if(led?.on)m.alert=1;}
  if(m.dry&&line.includes('Soil is fine'))m.cleared=1;   // the advice went back to fine after the alert
  return !!m.dry&&!!m.alert&&!!m.cleared;
 },
 readouts:s=>{
  const so=extOf(s,'soil-moisture'),id=extId(s,'soil-moisture');
  return so&&id?[pill(id,`${Math.round(Number(so.wetness))} % wet · ${Number(so.volts).toFixed(1)} V`)]:[];
 },
 thumbnail:[{kind:'soil-moisture',props:{wetness:55},x:0}],
 title:c('Plant monitor','Pemantau tanaman'),tagline:c('Soil moisture on a screen, with an alert.','Kelembapan tanah di layar, dengan peringatan.'),
 overview:{body:c('A soil sensor gives a voltage that falls as the soil gets wetter. The sketch reads it with analogRead, turns it into a percentage and shows it on a 16 by 2 character LCD. The LCD sits behind a small I2C board (a PCF8574) that sends four data bits at a time, so the sketch talks to the HD44780 controller in 4-bit mode over two wires. When the soil drops below your limit, the LED switches on and the second line asks for water. Open the sensor and slide the wetness.','Sensor tanah memberi tegangan yang turun saat tanah makin basah. Sketsa membacanya dengan analogRead, mengubahnya menjadi persen, dan menampilkannya di LCD 16 x 2 karakter. LCD ada di belakang papan I2C kecil (PCF8574) yang mengirim empat bit data sekali jalan, jadi sketsa bicara dengan pengendali HD44780 dalam mode 4-bit lewat dua kabel. Saat tanah turun di bawah batasmu, LED menyala dan baris kedua meminta air. Buka sensor dan geser kebasahan.'),
  bullets:[b('sun','Dry soil reads about 2.8 V, wet soil about 1.2 V.','Tanah kering terbaca sekitar 2,8 V, tanah basah sekitar 1,2 V.'),b('chip','The LCD backpack carries 4 data bits, RS, E and the backlight.','Papan belakang LCD membawa 4 bit data, RS, E, dan lampu latar.'),b('led','The LED lights below the dryBelow limit.','LED menyala di bawah batas dryBelow.')]},
 pinout:[pinRow('A0','Soil signal','Sinyal tanah','Analog voltage from the sensor.','Tegangan analog dari sensor.'),pinRow('A4 / A5','LCD SDA / SCL','SDA / SCL LCD','I2C to the display at 0x27.','I2C ke layar di 0x27.'),pinRow('D8','Alert LED','LED peringatan','On when the soil is dry.','Menyala saat tanah kering.')],
 walkthrough:[c('analogRead(A0) returns 0-1023 for 0-5 V.','analogRead(A0) memberi 0-1023 untuk 0-5 V.'),c('Scale it: the dry reading is 0 %, the wet one is 100 %.','Skalakan: bacaan kering 0 %, bacaan basah 100 %.'),c('The LCD is started with the 4-bit wake-up sequence.','LCD dihidupkan dengan urutan bangun mode 4-bit.'),c('Write the two lines, 16 characters each.','Tulis dua baris, masing-masing 16 karakter.'),c('Below dryBelow: LED on and a request for water.','Di bawah dryBelow: LED menyala dan permintaan air.')],
 specs:[sp('Sensor','Sensor','Analog soil moisture'),sp('Display','Layar','LCD 1602 + PCF8574, 0x27'),sp('Pins','Pin','A0, A4, A5, D8')],
 callouts:[co('soil1','right','Soil sensor','Sensor tanah','Click it and slide the wetness.','Klik dan geser kebasahan.'),co('lcd1','top','LCD 16 x 2','LCD 16 x 2','Shows the percentage and the advice.','Menampilkan persen dan sarannya.'),co('led1','right','Alert LED','LED peringatan','Lights when the soil is too dry.','Menyala saat tanah terlalu kering.'),co('uno.analog-header','left','A0, A4, A5','A0, A4, A5','The sensor and the I2C pair.','Sensor dan pasangan I2C.','A0')],
 params:{dryBelow:{label:c('Dry below','Kering di bawah'),unit:'%',hint:c('Alert when the moisture is under this percent.','Peringatan saat kelembapan di bawah persen ini.')}},
 goal:{text:c('Dry the soil to see the alert, then wet it to clear the alert.','Keringkan tanah untuk melihat peringatan, lalu basahi untuk menghapusnya.'),hint:c('Run, click the soil sensor and slide wetness low, then high.','Jalankan, klik sensor tanah dan geser kebasahan ke rendah, lalu tinggi.')},
 seo:{title:'Plant monitor with soil sensor and LCD',description:'Read a soil moisture sensor and show it on an I2C 16x2 LCD with an alert LED on an emulated Arduino UNO. Write the LCD driver yourself.'},
});
