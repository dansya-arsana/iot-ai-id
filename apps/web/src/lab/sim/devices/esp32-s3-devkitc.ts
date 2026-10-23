/**
 * ESP32-S3-DevKitC-1 v1.1, model only (the lab emulates AVR only). 44 pins: J1 1-22 and J3 1-22.
 * Pin map: Espressif user guide v1.1 (https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html) [V].
 * Chip: https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf
 * GPIO35/36/37 are used by octal flash/PSRAM on the N8R8/N16R8 modules, so `module` marks them kind 'flash'.
 * ADC2 cannot be used while Wi-Fi is on [K]. Strapping pins: 0, 3, 45, 46 [K].
 * Pair: scene/parts/esp32-s3-devkitc.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import type {Copy} from './types';

export type Esp32S3State={runtime:'not-emulated';pinCount:number;module:string;usb:string};

export interface S3Pin{
 key:string;/** 'J1' or 'J3' header */hdr:'J1'|'J3';/** 1..22 along the header */n:number;silk:string;
 kind:'power'|'ground'|'io'|'reset'|'flash';gpio?:number;adc?:string;touch?:number;strap?:boolean;fn?:string;note:Copy;
}
const IO_NOTE:Copy={en:'General purpose I/O, 3.3 V',id:'I/O serbaguna, 3,3 V'};
const io=(hdr:'J1'|'J3',n:number,gpio:number,o:Partial<S3Pin>={}):S3Pin=>({key:`GPIO${gpio}`,hdr,n,silk:o.silk??String(gpio),kind:'io',gpio,note:IO_NOTE,...o});
const pwr=(hdr:'J1'|'J3',n:number,key:string,en:string,id:string):S3Pin=>({key,hdr,n,silk:key.replace(/_\d+$/,''),kind:'power',note:{en,id}});
const gnd=(hdr:'J1'|'J3',n:number,key:string):S3Pin=>({key,hdr,n,silk:'G',kind:'ground',note:{en:'Ground',id:'Ground'}});
const strap=(en:string,id:string):Copy=>({en:'Strapping pin: '+en,id:'Pin strapping: '+id});

export const S3_PINS:readonly S3Pin[]=[
 // J1, 22 pins
 pwr('J1',1,'3V3_1','3.3 V supply (on-board LDO output; or feed 3.3 V here with 3V3+G, one input only)','Catu 3,3 V (keluaran LDO; atau beri 3,3 V di sini, hanya satu input)'),
 pwr('J1',2,'3V3_2','3.3 V supply','Catu 3,3 V'),
 {key:'RST',hdr:'J1',n:3,silk:'RST',kind:'reset',note:{en:'EN / reset: pull low to reset',id:'EN / reset: tarik ke low untuk reset'}},
 io('J1',4,4,{touch:4,adc:'ADC1_CH3'}),io('J1',5,5,{adc:'ADC1_CH4'}),io('J1',6,6,{adc:'ADC1_CH5'}),io('J1',7,7,{adc:'ADC1_CH6'}),
 io('J1',8,15,{adc:'ADC2_CH4',fn:'U0RTS / XTAL_32K_P'}),io('J1',9,16,{adc:'ADC2_CH5',fn:'U0CTS / XTAL_32K_N'}),
 io('J1',10,17,{adc:'ADC2_CH6',fn:'U1TXD'}),io('J1',11,18,{adc:'ADC2_CH7',fn:'U1RXD'}),
 io('J1',12,8,{adc:'ADC1_CH7'}),
 io('J1',13,3,{adc:'ADC1_CH2',strap:true,note:strap('selects the JTAG source at boot','memilih sumber JTAG saat boot')}),
 io('J1',14,46,{strap:true,note:strap('boot mode / ROM log (input only at boot)','mode boot / log ROM (hanya input saat boot)')}),
 io('J1',15,9,{adc:'ADC1_CH8',fn:'FSPIHD'}),io('J1',16,10,{adc:'ADC1_CH9',fn:'FSPICS0'}),
 io('J1',17,11,{adc:'ADC2_CH0',fn:'FSPID'}),io('J1',18,12,{adc:'ADC2_CH1',fn:'FSPICLK'}),
 io('J1',19,13,{adc:'ADC2_CH2',fn:'FSPIQ'}),io('J1',20,14,{adc:'ADC2_CH3',fn:'FSPIWP'}),
 pwr('J1',21,'5V','5 V in/out: from USB or feed 5 V here with 5V+G, one input only','5 V masuk/keluar: dari USB atau beri 5 V di sini, hanya satu input'),
 gnd('J1',22,'G_1'),
 // J3, 22 pins
 gnd('J3',1,'G_2'),
 io('J3',2,43,{key:'TX',silk:'TX',fn:'U0TXD',note:{en:'UART0 TX (serial monitor)',id:'UART0 TX (monitor serial)'}}),
 io('J3',3,44,{key:'RX',silk:'RX',fn:'U0RXD',note:{en:'UART0 RX',id:'UART0 RX'}}),
 io('J3',4,1,{adc:'ADC1_CH0'}),io('J3',5,2,{adc:'ADC1_CH1'}),
 io('J3',6,42,{fn:'MTMS'}),io('J3',7,41,{fn:'MTDI'}),io('J3',8,40,{fn:'MTDO'}),io('J3',9,39,{fn:'MTCK'}),
 io('J3',10,38,{note:{en:'RGB LED data on v1.1 boards (WS2812)',id:'Data LED RGB pada papan v1.1 (WS2812)'}}),
 io('J3',11,37,{}),io('J3',12,36,{}),io('J3',13,35,{}),
 io('J3',14,0,{strap:true,fn:'BOOT',note:strap('held low at reset enters download mode (BOOT button)','low saat reset masuk mode unduh (tombol BOOT)')}),
 io('J3',15,45,{strap:true,note:strap('sets the flash voltage (VDD_SPI) at boot','mengatur tegangan flash (VDD_SPI) saat boot')}),
 io('J3',16,48,{note:{en:'RGB LED data on v1.0 boards',id:'Data LED RGB pada papan v1.0'}}),
 io('J3',17,47,{}),io('J3',18,21,{}),
 io('J3',19,20,{fn:'USB_D+',note:{en:'Native USB D+: leave free if you use USB',id:'USB native D+: biarkan kosong bila memakai USB'}}),
 io('J3',20,19,{fn:'USB_D-',note:{en:'Native USB D-: leave free if you use USB',id:'USB native D-: biarkan kosong bila memakai USB'}}),
 gnd('J3',21,'G_3'),gnd('J3',22,'G_4'),
];
export const S3_MODULES=['n8','n8r8','n16r8','n32r16v'] as const;
/** Modules with octal PSRAM (or WROOM-2) that take GPIO35/36/37. */
export const OCTAL_MODULES:readonly string[]=['n8r8','n16r8','n32r16v'];
/** The pins marked 'flash' for a module (the base table keeps them as io). */
export function s3Pins(module:string):S3Pin[]{
 const octal=OCTAL_MODULES.includes(module);
 return S3_PINS.map(p=>octal&&(p.gpio===35||p.gpio===36||p.gpio===37)?{...p,kind:'flash' as const,note:{en:'Used by the octal flash/PSRAM of this module: do not use',id:'Dipakai flash/PSRAM octal modul ini: jangan dipakai'}}:p);
}

export const device=defineDevice<Esp32S3State>({
 kind:'esp32-s3-devkitc',protocol:'gpio',runtime:'not-emulated',
 pins:S3_PINS.map(p=>p.key),
 power:{rail:['5V','G_1'],min:4.5,max:5.5,ma:500},
 copy:{
  name:{en:'ESP32-S3-DevKitC-1',id:'ESP32-S3-DevKitC-1'},
  desc:{en:'ESP32-S3 development board (dual-core, Wi-Fi 4 and Bluetooth 5 LE) with two USB ports, BOOT and RST buttons and an RGB LED. Wiring and the pin map are shown; ESP32 code does not run in the browser.',id:'Papan pengembangan ESP32-S3 (dua inti, Wi-Fi 4 dan Bluetooth 5 LE) dengan dua port USB, tombol BOOT dan RST, dan LED RGB. Pengkabelan dan peta pin ditampilkan; kode ESP32 tidak berjalan di browser.'},
  note:{en:'Model only: not emulated. Use one power input at a time. On N8R8 and N16R8 modules GPIO35 to 37 are taken by the PSRAM. ADC2 does not work while Wi-Fi is on.',id:'Hanya model: tidak diemulasi. Pakai satu input daya dalam satu waktu. Pada modul N8R8 dan N16R8 GPIO35 sampai 37 dipakai PSRAM. ADC2 tidak jalan saat Wi-Fi aktif.'},
 },
 inputs:[
  {type:'choice',key:'module',label:{en:'Module',id:'Modul'},options:S3_MODULES.map(v=>({value:v,label:{en:v.toUpperCase(),id:v.toUpperCase()}})),default:'n8r8'},
  {type:'choice',key:'usb',label:{en:'USB connector',id:'Konektor USB'},options:[{value:'micro',label:{en:'Micro-USB',id:'Micro-USB'}},{value:'c',label:{en:'USB-C',id:'USB-C'}}],default:'micro'},
 ],
 create(ctx){return {state:()=>({runtime:'not-emulated',pinCount:S3_PINS.length,module:String(ctx.props.module??'n8r8'),usb:String(ctx.props.usb??'micro')})};},
});
