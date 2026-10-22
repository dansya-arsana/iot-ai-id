import {defineLesson,c,co,pinRow,sp,b,w,P,changes,dhtOf,extOf,extId,oledLitPixels,pill,RAILS} from './kit';

export const lesson=defineLesson({
 id:'oled',order:130,concept:'I2C',keyPins:['D2','A4','A5'],recordPins:['D2'],
 circuit:{parts:[{id:'dht1',kind:'dht22',net:{VCC:'5V',DATA:'D2',GND:'GND'},props:{tempC:24,humidity:60}},{id:'r1',kind:'resistor',net:{'1':'D2','2':'5V'},props:{ohms:10000,role:'pull-up'}},{id:'oled1',kind:'oled-ssd1306',net:{VCC:'5V',SDA:'A4',SCL:'A5',GND:'GND'},props:{}}],wires:[w('dht1','DATA','D2','yellow'),w('oled1','SDA','A4','blue'),w('oled1','SCL','A5','purple'),...RAILS]},
 firmware:{variants:[{id:'default',params:[P('readEvery','uint16',2000,1000,5000,500)]}]},
 check:(s,m)=>{
  const d=dhtOf(s),o=extOf(s,'oled-ssd1306');
  // the sensor produced two different readings AND the display holds real pixels written over I2C
  return !!d&&d.readT!==null&&changes(m,'t',d.readT)>=1&&!!o&&oledLitPixels(String(o.fb??''))>0;
 },
 readouts:s=>{
  const d=dhtOf(s),did=extId(s,'dht22'),o=extOf(s,'oled-ssd1306'),oid=extId(s,'oled-ssd1306');
  const out:{target:string;text:string}[]=[];
  if(d&&did)out.push(pill(did,`${d.tempC.toFixed(1)} °C · ${Math.round(d.humidity)} %RH`));
  if(o&&oid)out.push(pill(oid,`${oledLitPixels(String(o.fb??''))} px lit`));
  return out;
 },
 thumbnail:[{kind:'oled-ssd1306',x:0}],
 title:c('OLED dashboard','Dasbor OLED'),tagline:c('Draw the reading on a tiny screen.','Gambar hasil ukur di layar mungil.'),
 overview:{body:c('An OLED screen is a grid of 128 by 64 pixels that you fill by sending bytes over I2C, a two-wire bus with a clock (SCL) and a data line (SDA). The screen has an address, 0x3C. The sketch first sends commands to wake it up, then sends pixels, eight at a time, one column of a page after another. Here it reads the DHT22 from lesson 12 and draws the temperature and humidity with its own tiny font. Move the sensor sliders and the screen redraws.','Layar OLED adalah kisi 128 x 64 piksel yang kamu isi dengan mengirim byte lewat I2C, bus dua kabel dengan clock (SCL) dan data (SDA). Layar punya alamat, 0x3C. Sketsa mengirim perintah dulu untuk membangunkannya, lalu mengirim piksel, delapan sekaligus, satu kolom per halaman. Di sini sketsa membaca DHT22 dari pelajaran 12 dan menggambar suhu serta kelembapan dengan font kecil buatan sendiri. Geser slider sensor dan layar menggambar ulang.'),
  bullets:[b('wave','Two wires carry commands and pixels.','Dua kabel membawa perintah dan piksel.'),b('chip','Memory is 8 pages of 128 columns, 8 pixels per byte.','Memori terdiri dari 8 halaman x 128 kolom, 8 piksel per byte.'),b('eye','The font is a table of 5 bytes per letter.','Font adalah tabel 5 byte per huruf.')]},
 pinout:[pinRow('A4','SDA (data)','SDA (data)','I2C data, to the screen and back.','Data I2C, ke layar dan sebaliknya.'),pinRow('A5','SCL (clock)','SCL (clock)','I2C clock from the board.','Clock I2C dari papan.'),pinRow('D2','DHT22 data','Data DHT22','The sensor wire from lesson 12.','Kabel sensor dari pelajaran 12.'),pinRow('5V','Power','Daya','Powers the screen and the sensor.','Memberi daya ke layar dan sensor.')],
 walkthrough:[c('Wire.begin() starts the I2C bus.','Wire.begin() memulai bus I2C.'),c('Commands (0xAE ... 0xAF) set up the controller, then the screen is cleared.','Perintah (0xAE ... 0xAF) menyiapkan pengendali, lalu layar dibersihkan.'),c('0x21 and 0x22 pick the columns and pages to fill.','0x21 dan 0x22 memilih kolom dan halaman yang diisi.'),c('Every letter is drawn twice as big from a 5x7 font.','Tiap huruf digambar dua kali lebih besar dari font 5x7.'),c('Read the DHT22 and redraw every readEvery ms.','Baca DHT22 dan gambar ulang tiap readEvery ms.')],
 specs:[sp('Screen','Layar','SSD1306, 128 x 64'),sp('Bus','Bus','I2C, address 0x3C','I2C, alamat 0x3C'),sp('Pins','Pin','A4 SDA, A5 SCL')],
 callouts:[co('oled1','top','OLED screen','Layar OLED','The pixels come from the bytes the sketch sends.','Piksel berasal dari byte yang dikirim sketsa.'),co('dht1','right','DHT22','DHT22','Click it and move the sliders.','Klik dan geser slidernya.'),co('uno.analog-header','left','A4 and A5','A4 dan A5','The I2C pair: data and clock.','Pasangan I2C: data dan clock.','A4'),co('uno.mcu','top','Two jobs','Dua tugas','Reads the sensor, then draws the numbers.','Membaca sensor, lalu menggambar angkanya.')],
 params:{readEvery:{label:c('Read every','Baca tiap'),unit:'ms',hint:c('Time between readings (the sensor needs 2 s).','Jeda antar pembacaan (sensor butuh 2 detik).')}},
 goal:{text:c('See the screen show a new reading after you move a slider.','Lihat layar menampilkan bacaan baru setelah kamu menggeser slider.'),hint:c('Run, click the DHT22 and move a slider.','Jalankan, klik DHT22 dan geser slider.')},
 seo:{title:'Show a DHT22 reading on an SSD1306 OLED',description:'Draw temperature and humidity on a 128x64 SSD1306 OLED over I2C with an emulated Arduino UNO. No display library: the driver and font are ours.'},
});
