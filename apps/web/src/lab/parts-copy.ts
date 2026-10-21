import type {Copy} from './lessons';

const c=(en:string,id:string):Copy=>({en,id});
export interface PartCopy{name:Copy;desc:Copy;note?:Copy}
const none=c('Nothing to set on this part.','Tidak ada yang bisa diatur pada bagian ini.');

/** Keyed by PartKind and BoardFeatureId strings. */
export const PARTS_COPY:Record<string,PartCopy>={
 led:{name:c('LED','LED'),desc:c('A light emitting diode. It glows when current flows the right way.','Dioda pemancar cahaya. Menyala saat arus mengalir ke arah yang benar.')},
 'rgb-led':{name:c('RGB LED','LED RGB'),desc:c('Red, green and blue LEDs in one package that mix into any colour.','LED merah, hijau, dan biru dalam satu kemasan yang bercampur menjadi warna apa pun.'),note:none},
 resistor:{name:c('Resistor','Resistor'),desc:c('Limits current. Higher ohms means less current.','Membatasi arus. Ohm lebih besar berarti arus lebih kecil.')},
 button:{name:c('Push button','Tombol tekan'),desc:c('Connects two contacts while it is pressed.','Menyambungkan dua kontak selama ditekan.'),note:none},
 potentiometer:{name:c('Potentiometer','Potensiometer'),desc:c('A knob that divides a voltage from 0 to 5 V.','Kenop yang membagi tegangan dari 0 sampai 5 V.'),note:none},
 ldr:{name:c('Light sensor (LDR)','Sensor cahaya (LDR)'),desc:c('Its resistance drops as light gets brighter.','Hambatannya turun saat cahaya makin terang.'),note:none},
 lamp:{name:c('Desk lamp','Lampu meja'),desc:c('A light source for the sensor. Move it or switch it.','Sumber cahaya untuk sensor. Geser atau matikan.')},
 hcsr04:{name:c('HC-SR04 sensor','Sensor HC-SR04'),desc:c('Ultrasonic ranger: sends a ping and times the echo.','Pengukur jarak ultrasonik: mengirim ping dan mengukur gema.'),note:none},
 obstacle:{name:c('Obstacle','Halangan'),desc:c('Something for the sound to bounce off.','Benda tempat suara memantul.')},
 buzzer:{name:c('Buzzer','Buzzer'),desc:c('Turns a fast on/off signal into sound.','Mengubah sinyal nyala-mati cepat menjadi suara.'),note:none},
 motor:{name:c('DC motor','Motor DC'),desc:c('Spins faster the more average power it receives.','Berputar lebih cepat saat daya rata-rata lebih besar.'),note:none},
 servo:{name:c('Servo','Servo'),desc:c('Holds an angle set by a pulse width.','Menahan sudut yang ditentukan lebar pulsa.'),note:none},
 transistor:{name:c('Transistor','Transistor'),desc:c('An electronic switch controlled by a small current.','Saklar elektronik yang dikendalikan arus kecil.'),note:none},
 diode:{name:c('Diode','Dioda'),desc:c('Lets current pass one way only. Protects against spikes.','Hanya mengalirkan arus satu arah. Melindungi dari lonjakan.'),note:none},
 passive:{name:c('Support part','Komponen pendukung'),desc:c('Passive component such as a transistor or diode.','Komponen pasif seperti transistor atau dioda.'),note:none},
 'uno.led-l':{name:c('Pin 13 / L LED','Pin 13 / LED L'),desc:c('Digital pin 13 with a built-in LED.','Pin digital 13 dengan LED bawaan.')},
 'uno.usb':{name:c('USB port','Port USB'),desc:c('Power and programming connection.','Sambungan daya dan pemrograman.')},
 'uno.mcu':{name:c('ATmega328P','ATmega328P'),desc:c('The microcontroller that runs your sketch.','Mikrokontroler yang menjalankan sketsamu.')},
 'uno.power-header':{name:c('Power pins','Pin daya'),desc:c('5V, 3.3V and ground connections.','Sambungan 5V, 3.3V, dan ground.')},
 'uno.reset':{name:c('Reset button','Tombol reset'),desc:c('Restarts the sketch from the beginning.','Memulai ulang sketsa dari awal.')},
 'uno.digital-header':{name:c('Pin header','Header pin'),desc:c('Sockets for wiring parts to the chip.','Soket untuk menyambung komponen ke chip.')},
 'uno.analog-header':{name:c('Analog pins','Pin analog'),desc:c('A0 to A5 read voltages from sensors.','A0 sampai A5 membaca tegangan dari sensor.')},
 'uno.power-jack':{name:c('Power jack','Jack daya'),desc:c('Barrel jack for 7-12 V external power.','Jack baterai untuk daya luar 7-12 V.')},
 'uno.usb-chip':{name:c('USB interface chip','Chip antarmuka USB'),desc:c('Translates USB to serial for uploads.','Menerjemahkan USB ke serial untuk unggahan.')},
 'uno.crystal':{name:c('Crystal','Kristal'),desc:c('Sets the 16 MHz clock beat.','Menentukan detak clock 16 MHz.')},
 'uno.led-on':{name:c('ON LED','LED ON'),desc:c('Lights when the board has power.','Menyala saat papan berdaya.')},
 'uno.led-txrx':{name:c('TX/RX LEDs','LED TX/RX'),desc:c('Blink when serial data moves.','Berkedip saat data serial bergerak.')},
 'uno.icsp':{name:c('ICSP header','Header ICSP'),desc:c('Low-level programming pins.','Pin pemrograman tingkat rendah.')},
};

export function partCopy(key:string):PartCopy{
 return PARTS_COPY[key]??{name:c(key,key),desc:c('Part of the board.','Bagian dari papan.'),note:none};
}
