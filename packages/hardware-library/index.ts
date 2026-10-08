import {z} from 'zod';
import {components,esp32Devkit} from '../component-catalog/index.js';
export const HardwareReferenceSchema=z.object({id:z.string().regex(/^[a-z0-9-]+$/),version:z.number().int().positive(),kind:z.enum(['board','sensor','module']),name:z.string().min(1),family:z.string().min(1),category:z.string().min(1),aliases:z.array(z.string()),summary:z.string().min(1),protocols:z.array(z.string()).min(1),electrical:z.array(z.string()).min(1),pinout:z.array(z.string()).min(1),specifications:z.array(z.object({label:z.string().min(1),value:z.string().min(1)}).strict()).min(1),software:z.array(z.string()),useCases:z.array(z.string()).min(1),limitations:z.array(z.string()).min(1),sources:z.array(z.object({title:z.string().min(1),url:z.string().url().startsWith('https://')}).strict()).min(1),support:z.enum(['planning_only','recipe_available']),reviewStatus:z.literal('specification_only'),executionManifestId:z.string().optional()}).strict();
export type HardwareReference=z.infer<typeof HardwareReferenceSchema>;
export const HardwareLibraryFilterSchema=z.object({q:z.string().max(200).optional(),kind:z.enum(['board','sensor','module']).optional(),category:z.string().max(80).optional(),family:z.string().max(80).optional(),protocol:z.string().max(40).optional()}).strict();
export type HardwareLibraryFilter=z.infer<typeof HardwareLibraryFilterSchema>;
function board(id:string,name:string,family:string,processor:string,logic:string,pins:string,connectivity:string,source:string,aliases:string[]=[]):HardwareReference{return{id,version:1,kind:'board',name,family,category:'controller',aliases,summary:`${name} untuk kontrol perangkat, akuisisi data dan prototipe IoT.`,protocols:['i2c','spi','uart','digital'],electrical:[`Logika GPIO: ${logic}.`,`Gunakan catu daya dan pinout resmi varian board; batas arus total berbeda dari batas satu GPIO.`],pinout:[pins],specifications:[{label:'Processor',value:processor},{label:'Connectivity',value:connectivity}],software:family==='Raspberry Pi Linux'?['Raspberry Pi OS','Python','libgpiod']:family==='Raspberry Pi Pico'?['MicroPython','C/C++ SDK']:['Arduino IDE'],useCases:family==='Raspberry Pi Linux'?['Gateway MQTT','Dashboard lokal','Pemrosesan data sensor']:['Pembacaan sensor','Kontrol aktuator','Data logger'],limitations:[family==='Raspberry Pi Linux'?'Linux tidak menjamin timing GPIO real-time; gunakan MCU untuk tugas deterministik.':'Pin boot, pin USB dan pin daya harus mengikuti pinout board.','Pustaka referensi tidak menyediakan resep flash atau verifikasi untuk board ini.'],sources:[{title:`Dokumentasi resmi ${name}`,url:source}],support:'planning_only',reviewStatus:'specification_only'};}
const boards:HardwareReference[]=[
board('arduino-uno-r4-wifi','Arduino UNO R4 WiFi','Arduino','Renesas RA4M1 + ESP32-S3 connectivity module','5 V','UNO GPIO footprint; 12×8 LED matrix; inspect Qwiic voltage separately from main GPIO.','Wi-Fi, Bluetooth, USB-C','https://docs.arduino.cc/hardware/uno-r4-wifi/',['uno wifi','r4 wifi']),
{...board('arduino-nano-rp2040-connect','Arduino Nano RP2040 Connect','Arduino','RP2040 dual-core Cortex-M0+','3.3 V','Nano footprint; onboard IMU, microphone and RGB LED.','Wi-Fi and Bluetooth through NINA-W102','https://docs.arduino.cc/hardware/nano-rp2040-connect/',['nano rp2040']),limitations:['Manufacturer marks this board End of Life; useful as an existing-board reference.','GPIO 3.3 V; consult board datasheet before connecting 5 V devices.','No executable recipe in application.']},
board('raspberry-pi-pico-2','Raspberry Pi Pico 2','Raspberry Pi Pico','RP2350 dual Cortex-M33 or dual Hazard3 RISC-V, 150 MHz','3.3 V','Pico-compatible footprint; 3 ADC inputs, PIO; supply input is not GPIO tolerance.','USB; no onboard wireless','https://www.raspberrypi.com/products/raspberry-pi-pico-2/',['pico2','rp2350']),
board('raspberry-pi-pico-2-w','Raspberry Pi Pico 2 W','Raspberry Pi Pico','RP2350 dual Cortex-M33 or dual Hazard3 RISC-V, 150 MHz','3.3 V','Pico-compatible footprint; verify wireless-reserved pins against variant documentation.','Wi-Fi 2.4 GHz and Bluetooth 5.2','https://www.raspberrypi.com/products/raspberry-pi-pico-2/',['pico2w','pico 2w']),

{...board('esp32-devkit',esp32Devkit.name,'Espressif','ESP32 WROOM-32','3.3 V','GPIO21 SDA, GPIO22 SCL pada resep aplikasi; GPIO6–11 flash, GPIO34–39 input-only.','Wi-Fi 2.4 GHz, Bluetooth','https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html',['esp32','wroom32','devkit']),support:'recipe_available',executionManifestId:'esp32-devkit',limitations:['Hanya resep ESP32 room monitor dan button LED yang dapat dijalankan aplikasi.','GPIO tidak toleran sinyal 5 V; hindari pin flash, strapping dan serial reserved.']},
board('esp32-c3-devkitm-1','ESP32-C3-DevKitM-1','Espressif','ESP32-C3 RISC-V','3.3 V','Pin GPIO dan strapping berbeda dari ESP32 klasik.','Wi-Fi 2.4 GHz, Bluetooth LE','https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32c3/esp32-c3-devkitm-1/user_guide.html',['esp32c3','c3']),
board('arduino-uno-r3','Arduino UNO R3','Arduino','ATmega328P','5 V','14 digital I/O, 6 analog input; I2C SDA A4 dan SCL A5.','USB serial; modul eksternal untuk jaringan','https://docs.arduino.cc/hardware/uno-rev3/',['arduino uno','uno','uno r3']),
board('arduino-nano','Arduino Nano klasik','Arduino','ATmega328','5 V','14 digital I/O, 8 analog input; A6/A7 analog-only.','Mini USB; tanpa radio onboard','https://docs.arduino.cc/hardware/nano/',['nano','nano classic']),
board('arduino-mega-2560','Arduino Mega 2560 Rev3','Arduino','ATmega2560','5 V','54 digital I/O, 16 analog input, 4 hardware UART; SDA20/SCL21.','USB serial; tanpa radio onboard','https://docs.arduino.cc/hardware/mega-2560/',['mega','mega2560']),
board('arduino-uno-r4-minima','Arduino UNO R4 Minima','Arduino','Renesas RA4M1, Arm Cortex-M4','5 V','UNO footprint, 14 digital I/O, 6 analog input; DAC pada A0.','USB-C; tanpa radio onboard','https://docs.arduino.cc/hardware/uno-r4-minima/',['uno r4','r4 minima']),
board('arduino-nano-esp32','Arduino Nano ESP32','Arduino','ESP32-S3, u-blox NORA-W106','3.3 V','Nano footprint; mode nomor pin Arduino dan ESP32 harus konsisten.','Wi-Fi, Bluetooth LE, USB-C','https://docs.arduino.cc/hardware/nano-esp32/',['nano esp32']),
board('raspberry-pi-pico','Raspberry Pi Pico','Raspberry Pi Pico','RP2040 dual-core Arm Cortex-M0+','3.3 V','26 multifunction GPIO, 3 external ADC inputs, programmable I/O (PIO).','USB; tanpa radio onboard','https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html',['pico','rp2040']),
board('raspberry-pi-pico-w','Raspberry Pi Pico W','Raspberry Pi Pico','RP2040 dual-core Arm Cortex-M0+','3.3 V','Pico GPIO footprint; periksa pin yang digunakan wireless subsystem.','Wi-Fi 2.4 GHz, Bluetooth','https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html',['pico w']),
board('raspberry-pi-4','Raspberry Pi 4 Model B','Raspberry Pi Linux','Broadcom BCM2711 quad-core Cortex-A72','3.3 V','40-pin GPIO header; tidak ada ADC analog onboard.','Gigabit Ethernet, Wi-Fi, Bluetooth, USB','https://www.raspberrypi.com/products/raspberry-pi-4-model-b/',['raspy','raspberry pi','rpi','pi4']),
board('raspberry-pi-5','Raspberry Pi 5','Raspberry Pi Linux','Broadcom BCM2712 quad-core Cortex-A76','3.3 V','40-pin GPIO header melalui RP1; tidak ada ADC analog onboard.','Gigabit Ethernet, Wi-Fi, Bluetooth, PCIe','https://www.raspberrypi.com/products/raspberry-pi-5/',['pi5','raspy5']),
board('raspberry-pi-zero-2-w','Raspberry Pi Zero 2 W','Raspberry Pi Linux','Broadcom BCM2710A1 quad-core Cortex-A53','3.3 V','40-pin GPIO footprint; header perlu dipasang pada varian tanpa header.','Wi-Fi 2.4 GHz, Bluetooth LE, USB OTG','https://www.raspberrypi.com/products/raspberry-pi-zero-2-w/',['zero2','pi zero','raspy zero'])];
const enrichment:Record<string,{category:string;aliases:string[];summary:string;specifications:{label:string;value:string}[];useCases:string[]}>={
bme280:{category:'environment',aliases:['temperature','humidity','suhu','kelembapan'],summary:'Sensor suhu, kelembapan relatif dan tekanan untuk monitor lingkungan.',specifications:[{label:'Temperature',value:'−40…85 °C'},{label:'Humidity',value:'0…100 %RH'},{label:'Pressure',value:'300…1100 hPa'}],useCases:['Monitor ruangan','Stasiun cuaca']},
ssd1306:{category:'display',aliases:['oled','layar'],summary:'Layar OLED monokrom 128×64 untuk status perangkat.',specifications:[{label:'Resolution',value:'128×64 pixels'}],useCases:['Tampilan sensor','Status koneksi']},
bmp280:{category:'environment',aliases:['barometer','pressure','tekanan'],summary:'Sensor tekanan barometrik dan suhu; tidak mengukur kelembapan.',specifications:[{label:'Pressure',value:'300…1100 hPa'}],useCases:['Altimeter relatif','Stasiun cuaca']},
sht31:{category:'environment',aliases:['sht3x','humidity'],summary:'Sensor suhu dan kelembapan digital Sensirion.',specifications:[{label:'Outputs',value:'Temperature (°C), relative humidity (%RH)'}],useCases:['Ventilasi','Greenhouse']},
aht20:{category:'environment',aliases:['aht','humidity'],summary:'Sensor suhu dan kelembapan dengan antarmuka I2C.',specifications:[{label:'Outputs',value:'Temperature (°C), relative humidity (%RH)'}],useCases:['Monitor ruangan','Data logger']},
bh1750:{category:'light',aliases:['lux','cahaya'],summary:'Sensor intensitas cahaya digital untuk iluminasi sekitar.',specifications:[{label:'Output',value:'Illuminance (lux)'}],useCases:['Lampu otomatis','Monitor cahaya']},
veml7700:{category:'light',aliases:['lux','ambient light'],summary:'Sensor cahaya sekitar dengan gain dan integration time yang dapat dikonfigurasi.',specifications:[{label:'Output',value:'Illuminance (lux), raw ambient light counts'}],useCases:['Pengaturan brightness','Monitor iluminasi']},
mpu6050:{category:'motion',aliases:['imu','gyro'],summary:'IMU 6 sumbu: akselerometer dan gyroscope.',specifications:[{label:'Axes',value:'3 acceleration + 3 angular velocity'}],useCases:['Orientasi relatif','Deteksi gerakan']},
lis3dh:{category:'motion',aliases:['accelerometer','akselerometer'],summary:'Akselerometer tiga sumbu dengan skala pengukuran selectable.',specifications:[{label:'Full scale',value:'±2, ±4, ±8, ±16 g'}],useCases:['Deteksi getaran','Tilt sensing']},
ads1115:{category:'data-conversion',aliases:['adc','analog'],summary:'ADC eksternal untuk membaca sinyal analog pada MCU atau Raspberry Pi.',specifications:[{label:'Resolution',value:'16 bit'},{label:'Channels',value:'4 single-ended or 2 differential'}],useCases:['Sensor analog','Akuisisi data']},
ina219:{category:'power',aliases:['current','arus','power monitor'],summary:'Monitor tegangan bus dan arus melalui resistor shunt.',specifications:[{label:'Bus voltage',value:'0…26 V'}],useCases:['Monitor konsumsi daya','Battery logging']},
ds3231:{category:'time',aliases:['rtc','clock','jam'],summary:'Real-time clock dengan osilator terkompensasi suhu dan backup baterai.',specifications:[{label:'Output',value:'Calendar and time'}],useCases:['Timestamp offline','Jadwal perangkat']}
};
const legacy:HardwareReference[]=components.map(c=>{const extra=enrichment[c.id];return{id:c.id,version:1,kind:extra&&c.id!=='ssd1306'?'sensor':'module',name:c.name,family:extra?'Sensor & peripheral':'Discrete I/O',category:extra?.category??'input-output',aliases:extra?.aliases??[c.id.includes('button')?'tombol':'led'],summary:extra?.summary??'Komponen input/output digital dengan rangkaian resistor yang perlu diperiksa.',protocols:['lis3dh','bme280','bmp280'].includes(c.id)?['i2c','spi']:[c.protocol],electrical:[`Manifest aplikasi memakai catu ${c.voltage[0]}…${c.voltage[1]} V dan logika ${c.logicVoltage} V.`,`Anggaran arus manifest: ${c.currentMa} mA; ini nilai perencanaan aplikasi, bukan batas absolut IC.`],pinout:c.pins.map(p=>`${p.name}: ${p.role}`),specifications:extra?.specifications??[{label:'Interface',value:'Digital GPIO'}],software:c.libraries,useCases:extra?.useCases??['Belajar input/output','Indikator status'],limitations:[...c.quirks,'Spesifikasi breakout lain dapat berbeda; jangan menerapkan tegangan modul pada bare IC.'],sources:c.sources.map(url=>({title:'Dokumentasi perangkat / rangkaian',url})),support:c.support==='golden'?'recipe_available':'planning_only',reviewStatus:'specification_only',executionManifestId:c.id};});
function moduleReference(id:string,name:string,category:string,summary:string,slug:string,details:string[],limits:string[],aliases:string[],software:string):HardwareReference{return{id,version:1,kind:category==='expansion'||category==='actuator'?'module':'sensor',name,family:'Adafruit breakout',category,aliases,summary,protocols:['i2c'],electrical:['Pilih breakout Adafruit yang dirujuk; gunakan pin VIN dan logic level sesuai halaman pinouts.','SDA/SCL perlu pull-up ke level logika yang kompatibel. Jangan menganggap bare IC toleran 5 V.'],pinout:['VIN: supply pada breakout, GND: common ground, SDA: data I2C, SCL: clock I2C.','Pin tambahan dan alamat selectable mengikuti varian dalam panduan.'],specifications:details.map(value=>({label:'Capability',value})),software:[software,'CircuitPython / Python driver sesuai panduan'],useCases:[summary],limitations:[...limits,'Belum ada resep firmware atau verifikasi executable di aplikasi.'],sources:[{title:`Panduan produsen ${name}`,url:`https://learn.adafruit.com/${slug}`}],support:'planning_only',reviewStatus:'specification_only'};}
const additions:HardwareReference[]=[
moduleReference('vl53l0x','VL53L0X distance breakout','distance','Pengukuran jarak optical time-of-flight.','adafruit-vl53l0x-micro-lidar-distance-sensor-breakout/pinouts',['Default I2C address: 0x29; software address changes reset after power cycle','XSHUT shutdown pin; GPIO interrupt pin.'],['Adafruit breakout VIN 3–5 V; sensor core 2.8 V. GPIO ready output 2.8 V is not level shifted. XSHUT enables sequential address assignment. Permukaan dan cahaya sekitar memengaruhi hasil.'],['tof','distance','jarak','lidar'],'Adafruit VL53L0X'),
moduleReference('scd41','SCD41 CO2 breakout','air-quality','Pengukuran CO2 photoacoustic, suhu dan kelembapan.','adafruit-scd-40-and-scd-41',['CO2 specified range: 400…5000 ppm','CO2 accuracy: ±(40 ppm + 5% reading)'],['Adafruit breakout supply 3.3–5 V, low-ripple supply required. CO2 asli, berbeda dari estimasi eCO2; kalibrasi diperlukan.'],['co2','scd4x','ventilation'],'Sensirion I2C SCD4x'),
moduleReference('bme680','BME680 environmental gas breakout','air-quality','Monitor suhu, kelembapan, tekanan dan resistansi gas VOC.','adafruit-bme680-humidity-temperature-barometic-pressure-voc-gas',['Outputs: °C, %RH, hPa, gas resistance (Ω)','I2C or SPI supported by sensor.'],['Resistansi gas tidak mengidentifikasi gas tertentu; membutuhkan pemanasan dan kalibrasi.'],['voc','gas'],'Adafruit BME680'),
moduleReference('sgp30','SGP30 TVOC / eCO2 breakout','air-quality','Monitor VOC dan estimasi equivalent CO2 untuk tren kualitas udara.','adafruit-sgp30-gas-tvoc-eco2-mox-sensor',['Outputs: TVOC (ppb), eCO2 (ppm)'],['eCO2 merupakan estimasi berbasis sinyal H2, bukan pengukuran CO2 langsung.','Baseline dan kompensasi kelembapan memengaruhi pembacaan.'],['tvoc','eco2'],'Adafruit SGP30'),
moduleReference('dps310','DPS310 pressure breakout','environment','Pengukuran tekanan barometrik untuk perubahan ketinggian relatif.','adafruit-dps310-precision-barometric-pressure-sensor',['Outputs: pressure, temperature','I2C and SPI interfaces.'],['Altimeter memerlukan referensi tekanan; suhu sensor bukan suhu udara akurat di semua pemasangan.'],['barometer','altitude'],'Adafruit DPS310'),
moduleReference('tsl2591','TSL2591 light breakout','light','Sensor cahaya digital dengan kanal visible dan infrared.','adafruit-tsl2591',['Outputs: full-spectrum and infrared counts, calculated lux'],['Gain/integration time harus sesuai cahaya; saturasi mengganggu perhitungan lux.'],['lux','light','cahaya'],'Adafruit TSL2591'),
moduleReference('mcp9808','MCP9808 temperature breakout','environment','Sensor suhu digital presisi.','adafruit-mcp9808-precision-i2c-temperature-sensor-guide',['Temperature range: −40…125 °C','Typical accuracy: ±0.25 °C'],['Batas lingkungan breakout dan kontak termal tetap perlu diperiksa.'],['temperature','suhu'],'Adafruit MCP9808'),
moduleReference('lsm6ds3tr-c','LSM6DS3TR-C IMU breakout','motion','IMU 6-DoF untuk percepatan dan kecepatan sudut.','adafruit-lsm6ds3tr-c-6-dof-accel-gyro-imu',['3-axis accelerometer and 3-axis gyroscope','I2C or SPI interface.'],['Tidak memiliki magnetometer; drift gyro memerlukan kompensasi.'],['imu','gyro','accelerometer'],'Adafruit LSM6DS'),
moduleReference('pcf8574','PCF8574 GPIO expander','expansion','Ekspansi delapan pin I/O melalui bus I2C.','adafruit-pcf8574',['8 quasi-bidirectional GPIO'],['GPIO quasi-bidirectional bukan pengganti pin MCU untuk semua beban; periksa kemampuan sink/source.'],['gpio expander','io expander'],'Adafruit PCF8574'),
moduleReference('pca9685','PCA9685 PWM / servo driver','actuator','Pengendali PWM 16 kanal untuk servo atau LED.','16-channel-pwm-servo-driver',['16 PWM outputs','12-bit PWM resolution'],['Daya servo harus berasal dari rail motor yang sesuai, bukan GPIO atau rail logika.'],['servo','pwm','motor'],'Adafruit PWM Servo Driver'),
moduleReference('stemma-soil','STEMMA capacitive soil sensor','soil','Pengukuran kapasitansi tanah untuk tren kelembapan.','adafruit-stemma-soil-sensor-i2c-capacitive-moisture-sensor',['Capacitive moisture raw counts: approximately 200…2000 (not percent)','Internal temperature sensor: approximately ±2 °C accuracy'],['Adafruit module supply 3–5 V. Raw counts bukan persen moisture tanpa kalibrasi tanah; jangan rendam seluruh PCB.'],['soil','tanah','moisture'],'Adafruit seesaw')];
for(const record of additions){if(['bme680','dps310','lsm6ds3tr-c'].includes(record.id))record.protocols.push('spi');}
const bme680=additions.find(r=>r.id==='bme680')!;
bme680.electrical=['Adafruit breakout VIN: 3–5 V; regulator and level shifters are board features, not bare-IC tolerance.','Use VIN matching MCU logic voltage for this breakout.'];
bme680.pinout=['VIN: supply; GND: ground; SCK doubles as I2C SCL, SDI doubles as I2C SDA.','SPI: SCK clock, SDI MOSI, SDO MISO, CS chip select; each sensor needs a separate CS.'];
bme680.sources.push({title:'Adafruit BME680 pinouts',url:'https://learn.adafruit.com/adafruit-bme680-humidity-temperature-barometic-pressure-voc-gas/pinouts'});
const pca9685=additions.find(r=>r.id==='pca9685')!;
pca9685.electrical=['Adafruit board VCC: 3–5 V logic supply; I2C pull-ups connect to VCC.','V+ is separate servo power distribution, typically 5–6 V for compatible servos. Size supply to actual loads; never connect V+ to GPIO.'];
pca9685.pinout=['VCC: logic supply; V+: separate servo supply; GND: shared reference.','SDA/SCL: I2C; OE: active-high output disable; channels expose V+, GND and PWM.'];
pca9685.specifications.push({label:'Default I2C address',value:'0x40; address jumpers configure alternatives'},{label:'PWM frequency',value:'All channels share one PWM frequency'});
pca9685.sources.push({title:'Adafruit PCA9685 pinouts',url:'https://learn.adafruit.com/16-channel-pwm-servo-driver/pinouts'});
const secondBatch:HardwareReference[]=[
  {
    "id": "sht40",
    "version": 1,
    "kind": "sensor",
    "name": "SHT40 temperature/humidity breakout",
    "family": "Adafruit breakout",
    "category": "environment",
    "aliases": [
      "humidity",
      "suhu",
      "kelembapan",
      "sht40"
    ],
    "summary": "Temperature and relative humidity; SHT40 variant.",
    "protocols": [
      "i2c"
    ],
    "electrical": [
      "VIN follows MCU logic; breakout SDA/SCL level shifted for 3–5 V logic.",
      "Supply tolerance belongs to the referenced breakout, not the bare IC. Use a common ground."
    ],
    "pinout": [
      "VIN, GND; SDA data and SCL clock; 3V regulator output.",
      "Fixed I2C address 0x44."
    ],
    "specifications": [
      {
        "label": "Capability",
        "value": "Temperature and relative humidity; SHT40 variant."
      }
    ],
    "software": [
      "Adafruit SHT4x"
    ],
    "useCases": [
      "Temperature and relative humidity; SHT40 variant."
    ],
    "limitations": [
      "Same address as other SHT4x devices; separate buses or a multiplexer required.",
      "Accuracy differs between SHT40 and SHT45; use the matching datasheet.",
      "Planning reference only; no executable firmware or physical verification recipe."
    ],
    "sources": [
      {
        "title": "Adafruit variant pinouts",
        "url": "https://learn.adafruit.com/adafruit-sht40-temperature-humidity-sensor/pinouts"
      }
    ],
    "support": "planning_only",
    "reviewStatus": "specification_only"
  },
  {
    "id": "sht45",
    "version": 1,
    "kind": "sensor",
    "name": "SHT45 temperature/humidity breakout",
    "family": "Adafruit breakout",
    "category": "environment",
    "aliases": [
      "humidity",
      "suhu",
      "kelembapan",
      "sht45"
    ],
    "summary": "Temperature and relative humidity; SHT45 variant.",
    "protocols": [
      "i2c"
    ],
    "electrical": [
      "VIN follows MCU logic; breakout SDA/SCL level shifted for 3–5 V logic.",
      "Supply tolerance belongs to the referenced breakout, not the bare IC. Use a common ground."
    ],
    "pinout": [
      "VIN, GND; SDA data and SCL clock; 3V regulator output.",
      "Fixed I2C address 0x44."
    ],
    "specifications": [
      {
        "label": "Capability",
        "value": "Temperature and relative humidity; SHT45 variant."
      }
    ],
    "software": [
      "Adafruit SHT4x"
    ],
    "useCases": [
      "Temperature and relative humidity; SHT45 variant."
    ],
    "limitations": [
      "Same address as other SHT4x devices; separate buses or a multiplexer required.",
      "Accuracy differs between SHT40 and SHT45; use the matching datasheet.",
      "Planning reference only; no executable firmware or physical verification recipe."
    ],
    "sources": [
      {
        "title": "Adafruit variant pinouts",
        "url": "https://learn.adafruit.com/adafruit-sht40-temperature-humidity-sensor/pinouts"
      }
    ],
    "support": "planning_only",
    "reviewStatus": "specification_only"
  },
  {
    "id": "vl53l1x",
    "version": 1,
    "kind": "sensor",
    "name": "VL53L1X distance breakout",
    "family": "Adafruit breakout",
    "category": "distance",
    "aliases": [
      "jarak",
      "tof",
      "distance"
    ],
    "summary": "Optical time-of-flight distance measurement.",
    "protocols": [
      "i2c"
    ],
    "electrical": [
      "VIN follows MCU logic (3 V or 5 V); interrupt output is 2.8 V.",
      "Supply tolerance belongs to the referenced breakout, not the bare IC. Use a common ground."
    ],
    "pinout": [
      "VIN/GND, SDA/SCL; default address 0x29.",
      "XSHUT active-low shutdown, level shifted; GPIO interrupt output."
    ],
    "specifications": [
      {
        "label": "Capability",
        "value": "Optical time-of-flight distance measurement."
      }
    ],
    "software": [
      "Adafruit VL53L1X"
    ],
    "useCases": [
      "Optical time-of-flight distance measurement."
    ],
    "limitations": [
      "Remove protective sensor film.",
      "Range depends on target and lighting; multiple devices need shutdown/address sequencing.",
      "Planning reference only; no executable firmware or physical verification recipe."
    ],
    "sources": [
      {
        "title": "Adafruit variant pinouts",
        "url": "https://learn.adafruit.com/adafruit-vl53l1x/pinouts"
      }
    ],
    "support": "planning_only",
    "reviewStatus": "specification_only"
  },
  {
    "id": "bno055",
    "version": 1,
    "kind": "sensor",
    "name": "BNO055 orientation breakout",
    "family": "Adafruit breakout",
    "category": "motion",
    "aliases": [
      "orientation",
      "imu",
      "orientasi"
    ],
    "summary": "Absolute orientation with sensor fusion.",
    "protocols": [
      "i2c",
      "uart"
    ],
    "electrical": [
      "VIN 3.3–5 V; SDA/SCL accept 3 V or 5 V logic; INT output 3 V.",
      "Supply tolerance belongs to the referenced breakout, not the bare IC. Use a common ground."
    ],
    "pinout": [
      "VIN/GND, SDA/SCL; ADR selects alternate address.",
      "RST hardware reset; PS0/PS1 select interface mode; pin order differs between board revisions."
    ],
    "specifications": [
      {
        "label": "Capability",
        "value": "Absolute orientation with sensor fusion."
      }
    ],
    "software": [
      "Adafruit BNO055"
    ],
    "useCases": [
      "Absolute orientation with sensor fusion."
    ],
    "limitations": [
      "Manufacturer warns I2C is unreliable with ESP32, ESP32-S3 and I2C multiplexers.",
      "Calibration and magnetic interference affect orientation.",
      "Planning reference only; no executable firmware or physical verification recipe."
    ],
    "sources": [
      {
        "title": "Adafruit variant pinouts",
        "url": "https://learn.adafruit.com/adafruit-bno055-absolute-orientation-sensor/pinouts"
      }
    ],
    "support": "planning_only",
    "reviewStatus": "specification_only"
  },
  {
    "id": "apds9960",
    "version": 1,
    "kind": "sensor",
    "name": "APDS9960 gesture/color breakout",
    "family": "Adafruit breakout",
    "category": "light",
    "aliases": [
      "gesture",
      "warna",
      "rgb",
      "proximity"
    ],
    "summary": "Proximity, RGB light and gesture sensing.",
    "protocols": [
      "i2c"
    ],
    "electrical": [
      "VIN 3–5 V; SDA/SCL level shifted 3–5 V; INT output 3 V.",
      "Supply tolerance belongs to the referenced breakout, not the bare IC. Use a common ground."
    ],
    "pinout": [
      "VIN/GND; SDA data, SCL clock; INT interrupt."
    ],
    "specifications": [
      {
        "label": "Capability",
        "value": "Proximity, RGB light and gesture sensing."
      }
    ],
    "software": [
      "Adafruit APDS9960"
    ],
    "useCases": [
      "Proximity, RGB light and gesture sensing."
    ],
    "limitations": [
      "Proximity is not calibrated distance in metres; geometry and lighting affect gestures.",
      "Planning reference only; no executable firmware or physical verification recipe."
    ],
    "sources": [
      {
        "title": "Adafruit variant pinouts",
        "url": "https://learn.adafruit.com/adafruit-apds9960-breakout/pinouts"
      }
    ],
    "support": "planning_only",
    "reviewStatus": "specification_only"
  },
  {
    "id": "sgp40",
    "version": 1,
    "kind": "sensor",
    "name": "SGP40 VOC breakout",
    "family": "Adafruit breakout",
    "category": "air-quality",
    "aliases": [
      "voc",
      "kualitas udara"
    ],
    "summary": "VOC Index for changes in indoor air quality.",
    "protocols": [
      "i2c"
    ],
    "electrical": [
      "VIN 3–5 V; I2C pull-ups to VIN: match supply to MCU logic.",
      "Supply tolerance belongs to the referenced breakout, not the bare IC. Use a common ground."
    ],
    "pinout": [
      "VIN/GND; SDA/SCL; 3.3V regulator output."
    ],
    "specifications": [
      {
        "label": "Capability",
        "value": "VOC Index for changes in indoor air quality."
      }
    ],
    "software": [
      "Adafruit SGP40"
    ],
    "useCases": [
      "VOC Index for changes in indoor air quality."
    ],
    "limitations": [
      "VOC Index is not CO2 concentration or gas identification.",
      "Algorithm conditioning and humidity compensation matter.",
      "Planning reference only; no executable firmware or physical verification recipe."
    ],
    "sources": [
      {
        "title": "Adafruit variant pinouts",
        "url": "https://learn.adafruit.com/adafruit-sgp40/pinouts"
      }
    ],
    "support": "planning_only",
    "reviewStatus": "specification_only"
  },
  {
    "id": "max31865-pt100",
    "version": 1,
    "kind": "module",
    "name": "MAX31865 PT100 RTD amplifier",
    "family": "Adafruit breakout",
    "category": "environment",
    "aliases": [
      "rtd",
      "pt100",
      "temperature"
    ],
    "summary": "RTD resistance acquisition for a separate PT100 probe.",
    "protocols": [
      "spi"
    ],
    "electrical": [
      "VIN 3–5 V; incoming SPI pins level shifted to VIN logic.",
      "Supply tolerance belongs to the referenced breakout, not the bare IC. Use a common ground."
    ],
    "pinout": [
      "SCK clock; SDI MOSI; SDO MISO; CS per device; RDY optional.",
      "RTD terminal wiring and jumpers must match 2-, 3- or 4-wire probe."
    ],
    "specifications": [
      {
        "label": "Capability",
        "value": "RTD resistance acquisition for a separate PT100 probe."
      }
    ],
    "software": [
      "Adafruit MAX31865"
    ],
    "useCases": [
      "RTD resistance acquisition for a separate PT100 probe."
    ],
    "limitations": [
      "Choose PT100 board/reference resistor for PT100; PT1000 variant differs.",
      "Requires separate probe; probe range and calibration determine temperature limits.",
      "Planning reference only; no executable firmware or physical verification recipe."
    ],
    "sources": [
      {
        "title": "Adafruit variant pinouts",
        "url": "https://learn.adafruit.com/adafruit-max31865-rtd-pt100-amplifier/pinouts"
      }
    ],
    "support": "planning_only",
    "reviewStatus": "specification_only"
  },
  {
    "id": "drv2605l",
    "version": 1,
    "kind": "module",
    "name": "DRV2605L haptic driver",
    "family": "Adafruit breakout",
    "category": "actuator",
    "aliases": [
      "haptic",
      "getar",
      "vibration"
    ],
    "summary": "Haptic motor control for tactile feedback.",
    "protocols": [
      "i2c"
    ],
    "electrical": [
      "VIN 3–5 V; SDA/SCL pull-ups to VIN; match MCU logic.",
      "Supply tolerance belongs to the referenced breakout, not the bare IC. Use a common ground."
    ],
    "pinout": [
      "VIN/GND; SDA/SCL; default address 0x5A.",
      "Motor +/− terminals; INT external trigger/audio input."
    ],
    "specifications": [
      {
        "label": "Capability",
        "value": "Haptic motor control for tactile feedback."
      }
    ],
    "software": [
      "Adafruit DRV2605"
    ],
    "useCases": [
      "Haptic motor control for tactile feedback."
    ],
    "limitations": [
      "Configure driver for compatible ERM or LRA actuator and its voltage.",
      "Not a general DC motor or servo driver.",
      "Planning reference only; no executable firmware or physical verification recipe."
    ],
    "sources": [
      {
        "title": "Adafruit variant pinouts",
        "url": "https://learn.adafruit.com/adafruit-drv2605-haptic-controller-breakout/pinouts"
      }
    ],
    "support": "planning_only",
    "reviewStatus": "specification_only"
  },
  {
    "id": "mpr121",
    "version": 1,
    "kind": "sensor",
    "name": "MPR121 capacitive touch breakout",
    "family": "Adafruit breakout",
    "category": "input-output",
    "aliases": [
      "touch",
      "sentuh",
      "capacitive"
    ],
    "summary": "12-channel capacitive touch input.",
    "protocols": [
      "i2c"
    ],
    "electrical": [
      "Regulated breakout uses VIN 3.3–5 V; IRQ pulled up to 3.3 V.",
      "Supply tolerance belongs to the referenced breakout, not the bare IC. Use a common ground."
    ],
    "pinout": [
      "VIN/GND, SDA/SCL, touch electrodes.",
      "ADDR selects 0x5A…0x5D; INT/IRQ active-low on touch change."
    ],
    "specifications": [
      {
        "label": "Capability",
        "value": "12-channel capacitive touch input."
      }
    ],
    "software": [
      "Adafruit MPR121"
    ],
    "useCases": [
      "12-channel capacitive touch input."
    ],
    "limitations": [
      "Electrode geometry and wiring affect touch thresholds.",
      "Pin order differs between original and STEMMA QT revisions.",
      "Planning reference only; no executable firmware or physical verification recipe."
    ],
    "sources": [
      {
        "title": "Adafruit variant pinouts",
        "url": "https://learn.adafruit.com/adafruit-mpr121-12-key-capacitive-touch-sensor-breakout-tutorial/pinouts"
      }
    ],
    "support": "planning_only",
    "reviewStatus": "specification_only"
  },
  {
    "id": "tca9548a",
    "version": 1,
    "kind": "module",
    "name": "TCA9548A I2C multiplexer",
    "family": "Adafruit breakout",
    "category": "expansion",
    "aliases": [
      "multiplexer",
      "mux",
      "multi sensor"
    ],
    "summary": "Eight selectable I2C branches for duplicate-address sensors.",
    "protocols": [
      "i2c"
    ],
    "electrical": [
      "VIN 3–5 V; branch pull-ups and voltage domains require explicit design.",
      "Supply tolerance belongs to the referenced breakout, not the bare IC. Use a common ground."
    ],
    "pinout": [
      "Control SDA/SCL; SD0…SD7 and SC0…SC7 downstream branches.",
      "RST active-low; A0/A1/A2 select address 0x70…0x77."
    ],
    "specifications": [
      {
        "label": "Capability",
        "value": "Eight selectable I2C branches for duplicate-address sensors."
      }
    ],
    "software": [
      "Adafruit TCA9548A guide"
    ],
    "useCases": [
      "Eight selectable I2C branches for duplicate-address sensors."
    ],
    "limitations": [
      "Select a branch before communicating; overlapping addresses cannot coexist on enabled shared branches.",
      "Do not assume every sensor tolerates a multiplexer; BNO055 has documented issues.",
      "Planning reference only; no executable firmware or physical verification recipe."
    ],
    "sources": [
      {
        "title": "Adafruit variant pinouts",
        "url": "https://learn.adafruit.com/adafruit-tca9548a-1-to-8-i2c-multiplexer-breakout/pinouts"
      }
    ],
    "support": "planning_only",
    "reviewStatus": "specification_only"
  },
  {
    "id": "ads1015",
    "version": 1,
    "kind": "sensor",
    "name": "ADS1015 ADC breakout",
    "family": "Adafruit breakout",
    "category": "data-conversion",
    "aliases": [
      "adc",
      "analog",
      "12 bit"
    ],
    "summary": "12-bit four-channel ADC with programmable gain.",
    "protocols": [
      "i2c"
    ],
    "electrical": [
      "VIN 2–5 V; I2C pull-ups to VIN; match MCU logic.",
      "Supply tolerance belongs to the referenced breakout, not the bare IC. Use a common ground."
    ],
    "pinout": [
      "VIN/GND, SDA/SCL; A0…A3 analog input; ADDR address selection.",
      "ALRT comparator/conversion ready; default address 0x48."
    ],
    "specifications": [
      {
        "label": "Capability",
        "value": "12-bit four-channel ADC with programmable gain."
      }
    ],
    "software": [
      "Adafruit ADS1X15"
    ],
    "useCases": [
      "12-bit four-channel ADC with programmable gain."
    ],
    "limitations": [
      "Input voltage must stay within allowed input limits regardless of gain setting.",
      "ADDR and jumpers differ by breakout revision; do not confuse analog A0 with address jumper.",
      "Planning reference only; no executable firmware or physical verification recipe."
    ],
    "sources": [
      {
        "title": "Adafruit variant pinouts",
        "url": "https://learn.adafruit.com/adafruit-4-channel-adc-breakouts/pinouts"
      }
    ],
    "support": "planning_only",
    "reviewStatus": "specification_only"
  }
];
const prototypingReferences:HardwareReference[]=[
  {
    "version": 1,
    "kind": "module",
    "category": "prototyping",
    "protocols": [
      "passive"
    ],
    "software": [],
    "support": "planning_only",
    "reviewStatus": "specification_only",
    "id": "solderless-breadboard",
    "name": "Breadboard tanpa solder",
    "family": "Solderless prototyping",
    "aliases": [
      "breadboard",
      "papan percobaan",
      "prototipe"
    ],
    "summary": "Papan koneksi sementara untuk belajar merakit dan memperbaiki rangkaian tanpa solder.",
    "electrical": [
      "Tidak mengatur tegangan atau membatasi arus; gunakan catu daya dan level logika sesuai komponen.",
      "Matikan daya saat mengubah koneksi; periksa kontinuitas rail pada papan yang digunakan."
    ],
    "pinout": [
      "Kelompok terminal pada breadboard umum terdiri dari lima lubang terhubung; celah tengah memisahkan kedua sisi.",
      "Rail daya dapat terputus di tengah; rail sisi berlawanan tidak otomatis tersambung."
    ],
    "specifications": [
      {
        "label": "Connection",
        "value": "Kontak pegas tanpa solder; pola aktual harus diperiksa."
      }
    ],
    "useCases": [
      "Latihan sekolah dengan tegangan rendah",
      "Prototipe ESP32 sebelum perakitan permanen"
    ],
    "limitations": [
      "Bukan catu daya atau komponen executable.",
      "Canvas aplikasi belum memvalidasi lubang atau kontinuitas rail breadboard."
    ],
    "sources": [
      {
        "title": "Adafruit Breadboards for Beginners",
        "url": "https://learn.adafruit.com/breadboards-for-beginners/breadboards"
      },
      {
        "title": "Adafruit Breadboard Usage",
        "url": "https://learn.adafruit.com/breadboards-for-beginners/breadboard-usage"
      }
    ]
  },
  {
    "version": 1,
    "kind": "module",
    "category": "prototyping",
    "protocols": [
      "passive"
    ],
    "software": [],
    "support": "planning_only",
    "reviewStatus": "specification_only",
    "id": "adafruit-perma-proto",
    "name": "Adafruit Perma-Proto",
    "family": "Adafruit prototyping",
    "aliases": [
      "perma proto",
      "papan solder",
      "perfboard"
    ],
    "summary": "Papan prototipe solder dengan pola koneksi mirip breadboard untuk memindahkan rangkaian yang telah diuji.",
    "electrical": [
      "Papan pasif; catu daya dan batas komponen tetap mengikuti spesifikasi rangkaian.",
      "Periksa kontinuitas dan hubungan pendek tanpa daya sebelum menguji rakitan."
    ],
    "pinout": [
      "Pola terminal dan rail menyerupai breadboard; periksa ukuran dan varian papan yang digunakan.",
      "Perfboard dengan pad terpisah memiliki pola berbeda dan membutuhkan penghubung sendiri."
    ],
    "specifications": [
      {
        "label": "Assembly",
        "value": "Sambungan disolder; bukan breadboard tanpa solder."
      }
    ],
    "useCases": [
      "Transisi dari breadboard ke rakitan solder",
      "Latihan perakitan dengan guru atau pendamping terlatih"
    ],
    "limitations": [
      "Tidak menyediakan firmware, resep eksekusi, atau desain PCB otomatis.",
      "Penyolderan pelajar memerlukan pendamping terlatih dan praktik alat yang aman."
    ],
    "sources": [
      {
        "title": "Adafruit Perma Protos",
        "url": "https://learn.adafruit.com/breadboards-for-beginners/perma-protos"
      },
      {
        "title": "Adafruit Guide to Excellent Soldering",
        "url": "https://learn.adafruit.com/adafruit-guide-excellent-soldering"
      }
    ]
  }
];
export const hardwareLibrary:HardwareReference[]=z.array(HardwareReferenceSchema).parse([...boards,...legacy,...additions,...secondBatch,...prototypingReferences]);
export function filterHardwareLibrary(records:HardwareReference[],input:HardwareLibraryFilter={}){const f=HardwareLibraryFilterSchema.parse(input);const q=f.q?.toLowerCase().trim();return records.filter(r=>(!f.kind||r.kind===f.kind)&&(!f.category||r.category===f.category)&&(!f.family||r.family===f.family)&&(!f.protocol||r.protocols.includes(f.protocol))&&(!q||JSON.stringify(r).toLowerCase().includes(q)));}
export function hardwareKnowledgeDocument(record:HardwareReference){return `# ${record.name}\nReference specification only. Support: ${record.support}. Executable behavior is limited to registered ESP32 recipes.\n\n${JSON.stringify(record,null,2)}`;}
