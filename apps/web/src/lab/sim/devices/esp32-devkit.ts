/**
 * ESP32-DevKitC V4 (ESP32-WROOM-32 module, 38 pins; Espressif public datasheet behaviour, written by us).
 * Protocol 'gpio' only as a scaffold label: the model has NO signal behaviour. The lab emulator is AVR only (avr8js),
 * so ESP32 firmware does not run in the browser yet. The device says so honestly with `runtime:'not-emulated'`
 * (on the def and in state()) so the UI can show it. It does not fake pin activity.
 * Pair: scene/parts/esp32-devkit.ts (3D). Both are auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import type {Copy} from './types';

export type Esp32DevkitState={runtime:'not-emulated';pinCount:number};

/** One header pin. side 'L' is the row with 3V3/EN (z-), 'R' the row with TX0/RX0 (z+); idx 0 is at the antenna end. */
export interface Esp32Pin{
 key:string;side:'L'|'R';idx:number;
 /** silkscreen text */silk:string;
 kind:'power'|'ground'|'io'|'input-only'|'reset'|'flash';
 gpio?:number;adc?:string;touch?:number;strap?:boolean;dac?:number;
 note:Copy;
}
const io=(key:string,side:'L'|'R',idx:number,gpio:number,o:Partial<Esp32Pin>&{note?:Copy}={}):Esp32Pin=>({key,side,idx,silk:o.silk??String(gpio),kind:'io',gpio,...o,note:o.note??{en:'General purpose I/O',id:'I/O serbaguna'}});
const gnd=(key:string,side:'L'|'R',idx:number):Esp32Pin=>({key,side,idx,silk:'GND',kind:'ground',note:{en:'Ground',id:'Ground'}});
const inOnly=(key:string,side:'L'|'R',idx:number,gpio:number,adc:string,silk?:string):Esp32Pin=>({key,side,idx,silk:silk??String(gpio),kind:'input-only',gpio,adc,note:{en:'Input only: no output driver, no pull-up or pull-down',id:'Hanya input: tanpa driver output, tanpa pull-up/pull-down'}});
const flash=(key:string,side:'L'|'R',idx:number,gpio:number,silk:string):Esp32Pin=>({key,side,idx,silk,kind:'flash',gpio,note:{en:'Wired to the SPI flash inside the module: do not use',id:'Terhubung ke flash SPI di dalam modul: jangan dipakai'}});
const strapNote=(en:string,id:string):Copy=>({en:'Strapping pin: '+en,id:'Pin strapping: '+id});

/** Pin map in physical order, antenna end first. 38 pins. */
export const ESP32_PINS:readonly Esp32Pin[]=[
 {key:'3V3',side:'L',idx:0,silk:'3V3',kind:'power',note:{en:'3.3 V supply (output of the on-board regulator)',id:'Catu 3,3 V (keluaran regulator di papan)'}},
 {key:'EN',side:'L',idx:1,silk:'EN',kind:'reset',note:{en:'Chip enable / reset: pull low to reset',id:'Enable chip / reset: tarik ke low untuk reset'}},
 inOnly('VP','L',2,36,'ADC1_0','VP'),
 inOnly('VN','L',3,39,'ADC1_3','VN'),
 inOnly('IO34','L',4,34,'ADC1_6'),
 inOnly('IO35','L',5,35,'ADC1_7'),
 io('IO32','L',6,32,{adc:'ADC1_4',touch:9}),
 io('IO33','L',7,33,{adc:'ADC1_5',touch:8}),
 io('IO25','L',8,25,{adc:'ADC2_8',dac:1}),
 io('IO26','L',9,26,{adc:'ADC2_9',dac:2}),
 io('IO27','L',10,27,{adc:'ADC2_7',touch:7}),
 io('IO14','L',11,14,{adc:'ADC2_6',touch:6}),
 io('IO12','L',12,12,{adc:'ADC2_5',touch:5,strap:true,note:strapNote('high at boot selects 1.8 V flash and can stop the boot','high saat boot memilih flash 1,8 V dan bisa menggagalkan boot')}),
 gnd('GND1','L',13),
 io('IO13','L',14,13,{adc:'ADC2_4',touch:4}),
 flash('D2','L',15,9,'D2'),flash('D3','L',16,10,'D3'),flash('CMD','L',17,11,'CMD'),
 {key:'5V',side:'L',idx:18,silk:'5V',kind:'power',note:{en:'5 V from USB (VIN)',id:'5 V dari USB (VIN)'}},
 gnd('GND2','R',0),
 io('IO23','R',1,23,{note:{en:'Default VSPI MOSI',id:'VSPI MOSI bawaan'}}),
 io('IO22','R',2,22,{note:{en:'Default I2C SCL',id:'I2C SCL bawaan'}}),
 io('TX0','R',3,1,{silk:'TX0',note:{en:'UART0 TX to the USB chip (serial monitor)',id:'UART0 TX ke chip USB (monitor serial)'}}),
 io('RX0','R',4,3,{silk:'RX0',note:{en:'UART0 RX from the USB chip',id:'UART0 RX dari chip USB'}}),
 io('IO21','R',5,21,{note:{en:'Default I2C SDA',id:'I2C SDA bawaan'}}),
 gnd('GND3','R',6),
 io('IO19','R',7,19,{note:{en:'Default VSPI MISO',id:'VSPI MISO bawaan'}}),
 io('IO18','R',8,18,{note:{en:'Default VSPI SCK',id:'VSPI SCK bawaan'}}),
 io('IO5','R',9,5,{strap:true,note:strapNote('sets SDIO timing at boot','mengatur timing SDIO saat boot')}),
 io('IO17','R',10,17),io('IO16','R',11,16),
 io('IO4','R',12,4,{adc:'ADC2_0',touch:0}),
 io('IO0','R',13,0,{adc:'ADC2_1',touch:1,strap:true,note:strapNote('held low at reset enters download mode (BOOT button)','low saat reset masuk mode unduh (tombol BOOT)')}),
 io('IO2','R',14,2,{adc:'ADC2_2',touch:2,strap:true,note:strapNote('must be low or floating to flash; often drives the on-board LED','harus low atau mengambang saat flash; sering menyalakan LED papan')}),
 io('IO15','R',15,15,{adc:'ADC2_3',touch:3,strap:true,note:strapNote('low at boot silences the boot log','low saat boot membisukan log boot')}),
 flash('D1','R',16,8,'D1'),flash('D0','R',17,7,'D0'),flash('CLK','R',18,6,'CLK'),
];

export const device=defineDevice<Esp32DevkitState>({
 kind:'esp32-devkit',protocol:'gpio',runtime:'not-emulated',
 pins:ESP32_PINS.map(p=>p.key),
 copy:{
  name:{en:'ESP32-DevKitC',id:'ESP32-DevKitC'},
  desc:{en:'ESP32 development board with a WROOM-32 module (dual-core, Wi-Fi and Bluetooth), 38 pins, USB and EN/BOOT buttons. Wiring and the pin map are shown, but ESP32 code does not run in the browser yet.',id:'Papan pengembangan ESP32 dengan modul WROOM-32 (dua inti, Wi-Fi dan Bluetooth), 38 pin, USB dan tombol EN/BOOT. Pengkabelan dan peta pin ditampilkan, tetapi kode ESP32 belum berjalan di browser.'},
  note:{en:'Not emulated: the lab runs AVR (Uno) code only.',id:'Belum diemulasi: lab hanya menjalankan kode AVR (Uno).'},
 },
 inputs:[],
 create(){
  return {state:()=>({runtime:'not-emulated',pinCount:ESP32_PINS.length})};
 },
});

