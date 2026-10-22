/**
 * NodeMCU v3 (LoLin style ESP8266 dev board, 30 pins; public pinout, written by us). MODEL ONLY: the lab emulator is AVR
 * only, so ESP8266 firmware does not run. `runtime:'not-emulated'` says so on the def and in state(); no pin activity is faked.
 * Pair: scene/parts/nodemcu-v3.ts. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import type {Copy} from './types';

export type NodemcuV3State={runtime:'not-emulated';pinCount:number};
export interface NodePin{key:string;side:'L'|'R';idx:number;silk:string;kind:'power'|'ground'|'io'|'analog'|'reset'|'flash';gpio?:number;note:Copy}
const io=(key:string,side:'L'|'R',idx:number,gpio:number,note:Copy={en:'General purpose I/O',id:'I/O serbaguna'}):NodePin=>({key,side,idx,silk:key,kind:'io',gpio,note});
const gnd=(key:string,side:'L'|'R',idx:number):NodePin=>({key,side,idx,silk:'GND',kind:'ground',note:{en:'Ground',id:'Ground'}});
const v33=(key:string,side:'L'|'R',idx:number):NodePin=>({key,side,idx,silk:'3V3',kind:'power',note:{en:'3.3 V from the on-board regulator',id:'3,3 V dari regulator di papan'}});
const fl=(key:string,idx:number,gpio:number):NodePin=>({key,side:'L',idx,silk:key,kind:'flash',gpio,note:{en:'Shared with the SPI flash: avoid it',id:'Dipakai bersama flash SPI: hindari'}});
const rsv=(key:string,idx:number):NodePin=>({key,side:'L',idx,silk:'RSV',kind:'flash',note:{en:'Reserved: do not connect',id:'Cadangan: jangan disambung'}});

/** Physical order, USB end first. Left row (z-) then right row (z+). */
export const NODE_PINS:readonly NodePin[]=[
 {key:'A0',side:'L',idx:0,silk:'A0',kind:'analog',note:{en:'10-bit ADC, 0 to 1 V input only',id:'ADC 10-bit, masukan hanya 0 sampai 1 V'}},
 rsv('RSV1',1),rsv('RSV2',2),fl('SD3',3,10),fl('SD2',4,9),fl('SD1',5,8),fl('CMD',6,11),fl('SD0',7,7),fl('CLK',8,6),
 gnd('GND1','L',9),v33('3V3_1','L',10),
 {key:'EN',side:'L',idx:11,silk:'EN',kind:'reset',note:{en:'Chip enable: high to run',id:'Enable chip: high untuk jalan'}},
 {key:'RST',side:'L',idx:12,silk:'RST',kind:'reset',note:{en:'Reset: pull low to restart',id:'Reset: tarik ke low untuk mulai ulang'}},
 gnd('GND2','L',13),
 {key:'VIN',side:'L',idx:14,silk:'VIN',kind:'power',note:{en:'5 V from USB or an external supply',id:'5 V dari USB atau catu luar'}},
 io('D0','R',0,16,{en:'GPIO16: wakes the chip from deep sleep, no PWM or I2C',id:'GPIO16: membangunkan chip dari deep sleep, tanpa PWM atau I2C'}),
 io('D1','R',1,5,{en:'GPIO5: default I2C SCL',id:'GPIO5: I2C SCL bawaan'}),
 io('D2','R',2,4,{en:'GPIO4: default I2C SDA',id:'GPIO4: I2C SDA bawaan'}),
 io('D3','R',3,0,{en:'GPIO0: low at reset enters flash mode (FLASH button)',id:'GPIO0: low saat reset masuk mode flash (tombol FLASH)'}),
 io('D4','R',4,2,{en:'GPIO2: drives the blue LED, must be high at boot',id:'GPIO2: menyalakan LED biru, harus high saat boot'}),
 v33('3V3_2','R',5),gnd('GND3','R',6),
 io('D5','R',7,14,{en:'GPIO14: HSPI clock',id:'GPIO14: clock HSPI'}),
 io('D6','R',8,12,{en:'GPIO12: HSPI MISO',id:'GPIO12: MISO HSPI'}),
 io('D7','R',9,13,{en:'GPIO13: HSPI MOSI',id:'GPIO13: MOSI HSPI'}),
 io('D8','R',10,15,{en:'GPIO15: HSPI select, must be low at boot',id:'GPIO15: select HSPI, harus low saat boot'}),
 io('RX','R',11,3,{en:'GPIO3: UART0 RX from the USB chip',id:'GPIO3: RX UART0 dari chip USB'}),
 io('TX','R',12,1,{en:'GPIO1: UART0 TX to the USB chip',id:'GPIO1: TX UART0 ke chip USB'}),
 gnd('GND4','R',13),v33('3V3_3','R',14),
];

export const device=defineDevice<NodemcuV3State>({
 kind:'nodemcu-v3',protocol:'gpio',runtime:'not-emulated',
 pins:NODE_PINS.map(p=>p.key),
 copy:{
  name:{en:'NodeMCU v3 (ESP8266)',id:'NodeMCU v3 (ESP8266)'},
  desc:{en:'ESP8266 development board with USB, FLASH and RST buttons and 30 pins. The pin map is shown for wiring, but ESP8266 code does not run in the browser yet.',id:'Papan pengembangan ESP8266 dengan USB, tombol FLASH dan RST, serta 30 pin. Peta pin ditampilkan untuk pengkabelan, tetapi kode ESP8266 belum berjalan di browser.'},
  note:{en:'Not emulated: the lab runs AVR (Uno) code only. Pins are 3.3 V logic.',id:'Belum diemulasi: lab hanya menjalankan kode AVR (Uno). Pin berlogika 3,3 V.'},
 },
 inputs:[],
 create(){return {state:()=>({runtime:'not-emulated',pinCount:NODE_PINS.length})};},
});
