import {defineLesson,c,co,pinRow,sp,b,w,P,changes,dhtOf,idOf,pill,RAILS} from './kit';

export const lesson=defineLesson({
 id:'dht',order:120,concept:'ONE-WIRE',keyPins:['D2'],recordPins:['D2'],
 circuit:{parts:[{id:'dht1',kind:'dht22',net:{VCC:'5V',DATA:'D2',GND:'GND'},props:{tempC:24,humidity:60}},{id:'r1',kind:'resistor',net:{'1':'D2','2':'5V'},props:{ohms:10000,role:'pull-up'}}],wires:[w('dht1','DATA','D2','yellow'),...RAILS]},
 firmware:{variants:[{id:'default',params:[P('readEvery','uint16',2000,1000,5000,500)]}]},
 check:(s,m)=>{const d=dhtOf(s);return !!d&&d.readT!==null&&changes(m,'t',d.readT)>=2;},
 readouts:s=>{const d=dhtOf(s),id=idOf(s,'ext');return d&&id?[pill(id,`${d.tempC.toFixed(1)} °C · ${Math.round(d.humidity)} %RH`)]:[];},
 thumbnail:[{kind:'dht22',props:{tempC:24,humidity:60},x:0}],
 title:c('Read temperature & humidity','Baca suhu & kelembapan'),tagline:c('One wire, forty bits.','Satu kabel, empat puluh bit.'),
 overview:{body:c('The DHT22 sends its reading over a single wire. Your sketch pulls the wire low for 18 ms to say hello. The sensor answers with 40 bits: humidity, temperature and a checksum. A 0 is a short pulse and a 1 is a long one, so the sketch measures how long the wire stays high. Move the sliders on the sensor and the serial monitor follows.','DHT22 mengirim hasil ukurnya lewat satu kabel. Sketsamu menarik kabel ke rendah selama 18 ms untuk menyapa. Sensor menjawab dengan 40 bit: kelembapan, suhu, dan checksum. Bit 0 adalah pulsa pendek dan bit 1 pulsa panjang, jadi sketsa mengukur berapa lama kabel tetap tinggi. Geser slider di sensor dan monitor serial mengikutinya.'),
  bullets:[b('wave','The wire idles high through a 10k pull-up.','Kabel diam di level tinggi lewat pull-up 10k.'),b('check','The last byte is a checksum of the other four.','Byte terakhir adalah checksum dari empat byte lain.'),b('chip','No library: the sketch times each pulse itself.','Tanpa pustaka: sketsa mengukur sendiri tiap pulsa.')]},
 pinout:[pinRow('D2','DATA (one wire)','DATA (satu kabel)','Start pulse out, 40 bits in.','Pulsa mulai keluar, 40 bit masuk.'),pinRow('5V','VCC and pull-up','VCC dan pull-up','Powers the sensor.','Memberi daya ke sensor.'),pinRow('GND','Ground','Ground','Return path.','Jalur kembali.')],
 walkthrough:[c('Pull DATA low for 18 ms, then let go.','Tarik DATA rendah 18 ms, lalu lepas.'),c('The sensor answers low 80 us, high 80 us.','Sensor menjawab rendah 80 us, tinggi 80 us.'),c('Each bit: 50 us low, then high 27 us (0) or 70 us (1).','Tiap bit: rendah 50 us, lalu tinggi 27 us (0) atau 70 us (1).'),c('Look 45 us after the rise: still high means 1.','Lihat 45 us setelah naik: masih tinggi berarti 1.'),c('Print the value every readEvery ms.','Cetak nilainya tiap readEvery ms.')],
 specs:[sp('Sensor','Sensor','DHT22 (AM2302)'),sp('Range','Rentang','-40 to 80 C, 0-100 %RH','-40 sampai 80 C, 0-100 %RH'),sp('Pin','Pin','D2')],
 callouts:[co('dht1','right','DHT22','DHT22','Click it and move the sliders.','Klik dan geser slidernya.'),co('r1','left','Pull-up','Pull-up','Keeps the wire high when nobody drives it.','Menjaga kabel tinggi saat tidak ada yang menggerakkannya.'),co('uno.digital-header','left','Pin 2','Pin 2','The one data wire.','Satu kabel data.','D2'),co('uno.mcu','top','Your timing','Waktumu','Counts how long each pulse lasts.','Menghitung lama tiap pulsa.')],
 params:{readEvery:{label:c('Read every','Baca tiap'),unit:'ms',hint:c('Time between readings (the sensor needs 2 s).','Jeda antar pembacaan (sensor butuh 2 detik).')}},
 goal:{text:c('See the reading change when you move a slider.','Lihat bacaan berubah saat kamu menggeser slider.'),hint:c('Run, click the sensor and move a slider.','Jalankan, klik sensor dan geser slider.')},
 seo:{title:'Read a DHT22 on Arduino, no library',description:'Read temperature and humidity from a DHT22 over its single wire on an emulated Arduino UNO. Move the sliders and watch the 40-bit protocol.'},
});
