import {defineLesson,c,co,pinRow,sp,b,w,P,dhtOf,extOf,extId,pill,range,RAILS} from './kit';

/** The two numbers of a 'Xmin A max B' line of the LCD (null when the row is not that shape yet). */
const minMax=(line:unknown,label:string):{min:number;max:number}|null=>{
 const m=new RegExp(`^${label}min (-?[0-9.]+) max (-?[0-9.]+)`).exec(String(line??'').trim());
 return m?{min:Number(m[1]),max:Number(m[2])}:null;
};

export const lesson=defineLesson({
 id:'weather-station',order:170,view:{az:6,elev:44,board:true},concept:'I2C',keyPins:['A4','A5','D2'],recordPins:['A4','A5','D2'],
 circuit:{
  parts:[
   {id:'lcd1',kind:'lcd2004-i2c',net:{GND:'GND',VCC:'5V',SDA:'A4',SCL:'A5'},props:{}},
   {id:'bmp1',kind:'bmp280',net:{VCC:'3V3',GND:'GND',SDA:'A4',SCL:'A5'},props:{temperature:24,pressure:1013}},
   {id:'dht1',kind:'dht22',net:{VCC:'5V',DATA:'D2',GND:'GND'},props:{tempC:24,humidity:60}},
   {id:'r1',kind:'resistor',net:{'1':'D2','2':'5V'},props:{ohms:10000,role:'pull-up'}},
  ],
  wires:[w('bmp1','VCC','3V3','orange'),w('bmp1','SDA','A4','blue'),w('bmp1','SCL','A5','purple'),w('dht1','DATA','D2','yellow'),w('lcd1','SDA','A4','blue'),w('lcd1','SCL','A5','purple'),...RAILS],
 },
 firmware:{variants:[{id:'default',params:[P('readEvery','uint16',2500,2000,10000,500)]}]},
 // the goal reads the LCD text: both min and max rows must have opened up, so the learner moved BOTH the temperature and the pressure
 check:(s,m)=>{
  const l=extOf(s,'lcd2004-i2c');
  if(!l)return false;
  const t=minMax(l.line3,'T'),p=minMax(l.line4,'P');
  if(!t||!p)return false;
  range(m,'t',t.min);range(m,'t',t.max);range(m,'p',p.min);range(m,'p',p.max);
  return t.max-t.min>=2&&p.max-p.min>=5;
 },
 readouts:s=>{
  const out:{target:string;text:string}[]=[];
  const bmp=extOf(s,'bmp280'),bid=extId(s,'bmp280'),d=dhtOf(s),did=extId(s,'dht22');
  if(bmp&&bid)out.push(pill(bid,`${Number(bmp.temperature).toFixed(1)} °C · ${Math.round(Number(bmp.pressure))} hPa`));
  if(d&&did)out.push(pill(did,`${d.tempC.toFixed(1)} °C · ${Math.round(d.humidity)} %RH`));
  return out;
 },
 thumbnail:[{kind:'bmp280',props:{temperature:24,pressure:1013},x:0},{kind:'dht22',props:{tempC:24,humidity:60},x:24}],
 title:c('Weather station','Stasiun cuaca'),tagline:c('Two sensors, one four-line screen, with min and max.','Dua sensor, satu layar empat baris, lengkap dengan min dan maks.'),
 overview:{body:c('A BMP280 measures air pressure and temperature over I2C. A DHT22 measures humidity over one wire. Your sketch reads both, shows them on a 20 by 4 character LCD, and remembers the lowest and highest temperature and pressure since power-up. The BMP280 and the LCD share the same two I2C wires and answer to different addresses, 0x76 and 0x27. The BMP280 is a 3.3 V part, so it takes its power from the 3V3 pin. Open each sensor, move its sliders and watch the min and max rows grow.','BMP280 mengukur tekanan udara dan suhu lewat I2C. DHT22 mengukur kelembapan lewat satu kabel. Sketsamu membaca keduanya, menampilkannya di LCD 20 x 4 karakter, dan mengingat suhu dan tekanan terendah dan tertinggi sejak dinyalakan. BMP280 dan LCD memakai dua kabel I2C yang sama dan menjawab di alamat berbeda, 0x76 dan 0x27. BMP280 adalah komponen 3,3 V, jadi dayanya diambil dari pin 3V3. Buka tiap sensor, geser slidernya dan lihat baris min dan maks bertambah lebar.'),
  bullets:[b('chip','Two I2C devices share SDA and SCL, told apart by address.','Dua perangkat I2C berbagi SDA dan SCL, dibedakan lewat alamat.'),b('wave','The BMP280 gives raw numbers; the sketch applies the maker\'s formulas.','BMP280 memberi angka mentah; sketsa menerapkan rumus dari pembuatnya.'),b('bolt','3.3 V for the BMP280, 5 V for the LCD and the DHT22.','3,3 V untuk BMP280, 5 V untuk LCD dan DHT22.')]},
 pinout:[pinRow('A4 / A5','I2C SDA / SCL','SDA / SCL I2C','Shared by the BMP280 (0x76) and the LCD (0x27).','Dipakai bersama BMP280 (0x76) dan LCD (0x27).'),pinRow('D2','DHT22 DATA','DATA DHT22','Start pulse out, 40 bits in.','Pulsa mulai keluar, 40 bit masuk.'),pinRow('3V3','BMP280 power','Daya BMP280','The BMP280 must not see 5 V.','BMP280 tidak boleh kena 5 V.'),pinRow('5V','LCD, DHT22, pull-up','LCD, DHT22, pull-up','Powers the 5 V parts.','Memberi daya ke komponen 5 V.')],
 walkthrough:[c('Check the BMP280 chip id (0x58) and read its 12 calibration words.','Periksa id chip BMP280 (0x58) dan baca 12 kata kalibrasinya.'),c('Start a forced measurement, wait 30 ms, read 6 raw bytes.','Mulai pengukuran paksa, tunggu 30 ms, baca 6 byte mentah.'),c('Turn the raw numbers into degrees and hPa with the datasheet formulas.','Ubah angka mentah menjadi derajat dan hPa dengan rumus datasheet.'),c('Time the 40 DHT22 bits for temperature and humidity.','Ukur 40 bit DHT22 untuk suhu dan kelembapan.'),c('Keep the lowest and highest values and write the four LCD rows.','Simpan nilai terendah dan tertinggi lalu tulis empat baris LCD.')],
 specs:[sp('Sensors','Sensor','BMP280 (0x76) + DHT22'),sp('Display','Layar','LCD 2004 + PCF8574, 0x27'),sp('Pins','Pin','A4, A5, D2, 3V3')],
 callouts:[co('bmp1','right','BMP280','BMP280','Click it: temperature and pressure sliders. It runs on 3.3 V.','Klik: slider suhu dan tekanan. Bekerja di 3,3 V.'),co('dht1','right','DHT22','DHT22','Click it: temperature and humidity sliders.','Klik: slider suhu dan kelembapan.'),co('lcd1','top','LCD 20 x 4','LCD 20 x 4','Rows 3 and 4 hold the min and max.','Baris 3 dan 4 memuat min dan maks.'),co('uno.analog-header','left','A4 and A5','A4 dan A5','Two wires carry both I2C devices.','Dua kabel membawa kedua perangkat I2C.','A4')],
 params:{readEvery:{label:c('Update every','Perbarui tiap'),unit:'ms',hint:c('Time between screen updates (the DHT22 needs 2 s).','Jeda antar pembaruan layar (DHT22 butuh 2 detik).')}},
 goal:{text:c('Move the BMP280 temperature by 2 degrees and its pressure by 5 hPa until the min and max rows open up.','Geser suhu BMP280 sebesar 2 derajat dan tekanannya 5 hPa sampai baris min dan maks melebar.'),hint:c('Run, click the BMP280 and slide temperature and pressure up, then down.','Jalankan, klik BMP280 dan geser suhu dan tekanan naik, lalu turun.')},
 seo:{title:'Weather station: BMP280 and DHT22 on an LCD',description:'Build a weather station on an emulated Arduino UNO: BMP280 pressure over I2C, DHT22 humidity, a 20x4 LCD and min and max tracking.'},
});
