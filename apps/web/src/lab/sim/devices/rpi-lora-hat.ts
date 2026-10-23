/**
 * LoRa/GPS HAT for the Raspberry Pi (Dragino-style, Semtech SX1276), MODEL ONLY.
 * Protocol 'gpio' only as a scaffold label: the model has NO signal behaviour. A Pi runs Linux, not AVR, so nothing here runs in the
 * browser; the device says so with `runtime:'not-emulated'` and never fakes pin activity. What it keeps is the HAT signal map so that Pro
 * (wiring plan, pin tables, gateway.py lint) can use it. The radio on it behaves like lora-rfm95w (same SX127x register map, RegVersion 0x42 = 0x12).
 * Signal map [U, community sources, v1.3+ boards]: NSS = GPIO25 (header pin 22, a manual chip select, not CE0), RESET = GPIO17 (pin 11),
 * DIO0 = GPIO4 (pin 7), DIO1 = GPIO23 (pin 16), DIO2 = GPIO24 (pin 18), SPI0 MOSI/MISO/SCLK = GPIO10/9/11 (pins 19/21/23), GPS UART = GPIO14/15.
 * Boards before v1.3 need DIO1 and DIO2 bridged by hand. A single-channel HAT is fine for point-to-point LoRa between our nodes; it is NOT a
 * full LoRaWAN gateway (one channel, one spreading factor).
 * Pair: scene/parts/rpi-lora-hat.ts (3D). Both are auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import type {Copy} from './types';

export type RpiLoraHatState={runtime:'not-emulated';pinCount:number};

export interface HatPin{key:string;/** physical pin on the 40-pin header; ANT has none */header:number|null;role:string;note:Copy}
const P=(key:string,header:number|null,role:string,en:string,id:string):HatPin=>({key,header,role,note:{en,id}});
/** The header pins the HAT uses, in physical (header) order, plus the antenna jack. */
export const HAT_PINS:readonly HatPin[]=[
 P('3V3_1',1,'power','3.3 V supply','Catu 3,3 V'),
 P('5V_2',2,'power','5 V supply (GPS and regulator)','Catu 5 V (GPS dan regulator)'),
 P('GND_6',6,'ground','Ground','Ground'),
 P('GPIO4',7,'DIO0','Radio DIO0: RxDone or TxDone interrupt','DIO0 radio: interupsi RxDone atau TxDone'),
 P('GPIO14',8,'GPS TX','GPS serial (UART TXD0)','Serial GPS (UART TXD0)'),
 P('GPIO15',10,'GPS RX','GPS serial (UART RXD0)','Serial GPS (UART RXD0)'),
 P('GPIO17',11,'RESET','Radio reset, active low','Reset radio, aktif low'),
 P('GPIO23',16,'DIO1','Radio DIO1 (boards before v1.3: bridge by hand)','DIO1 radio (papan sebelum v1.3: jumper manual)'),
 P('GPIO24',18,'DIO2','Radio DIO2 (boards before v1.3: bridge by hand)','DIO2 radio (papan sebelum v1.3: jumper manual)'),
 P('GPIO10',19,'MOSI','SPI0 MOSI','SPI0 MOSI'),
 P('GPIO9',21,'MISO','SPI0 MISO','SPI0 MISO'),
 P('GPIO25',22,'NSS','Radio chip select, a manual pin (not CE0)','Chip select radio, pin manual (bukan CE0)'),
 P('GPIO11',23,'SCLK','SPI0 SCLK','SPI0 SCLK'),
 P('ANT',null,'antenna','SMA antenna jack: never transmit without an antenna','Konektor antena SMA: jangan memancar tanpa antena'),
];

export const device=defineDevice<RpiLoraHatState>({
 kind:'rpi-lora-hat',protocol:'gpio',runtime:'not-emulated',
 pins:HAT_PINS.map(p=>p.key),
 copy:{
  name:{en:'LoRa/GPS HAT for Raspberry Pi',id:'HAT LoRa/GPS untuk Raspberry Pi'},
  desc:{en:'A single-channel LoRa HAT (Semtech SX1276, 868/915 MHz class) with a GPS module, plugged on the Pi header. Used at 920-923 MHz it fits the Indonesian plan. Wiring and the signal map are shown, nothing runs here.',id:'HAT LoRa satu kanal (Semtech SX1276, kelas 868/915 MHz) dengan modul GPS, dipasang di header Pi. Dipakai di 920-923 MHz, cocok dengan rencana frekuensi Indonesia. Pengkabelan dan peta sinyal ditampilkan, tidak ada yang berjalan di sini.'},
  note:{en:'Not emulated: wiring and pin map only; code for it is compile/lint-checked in Pro, never run here. A single-channel HAT suits point-to-point LoRa between our nodes; it is not a full LoRaWAN gateway.',id:'Tidak diemulasi: hanya pengkabelan dan peta pin; kodenya hanya dicek compile/lint di Pro, tidak pernah dijalankan di sini. HAT satu kanal cocok untuk LoRa titik-ke-titik antar node kita; bukan gateway LoRaWAN penuh.'},
 },
 inputs:[],
 create(){return {state:()=>({runtime:'not-emulated',pinCount:HAT_PINS.length})};},
});
