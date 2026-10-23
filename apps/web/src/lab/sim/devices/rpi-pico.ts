/**
 * Raspberry Pi Pico (RP2040), model only: the lab emulates AVR only. 40 edge pins plus 3 SWD pads, `runtime:'not-emulated'`.
 * Pin map: Pico datasheet pinout (https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf) [K].
 * Alt functions are COMPUTED (RP2040 datasheet 2.19.2 GPIO function table, https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf), not hand-typed:
 * SPI: 0-7 and 16-23 = SPI0, 8-15 and 24-29 = SPI1, n%4 -> RX, CSn, SCK, TX. UART: n>>2 in [0,1,1,0,0,1,1,0] -> UART0/1, n%4 -> TX, RX, CTS, RTS.
 * I2C: even = SDA, odd = SCL, I2C0 when (n>>1)%2==0. PWM slice (n>>1)%8, channel A for even n and B for odd n. tests/lab-part-rpi-pico.test.ts checks 6 datasheet rows.
 * Pair: scene/parts/rpi-pico.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import type {Copy} from './types';

export type RpiPicoState={runtime:'not-emulated';pinCount:number;variant:string};

export interface PicoPin{
 key:string;phys?:number;kind:'power'|'ground'|'gpio'|'adc'|'reset'|'debug';
 gpio?:number;/** ADC channel 0-2 on GP26-28 */adc?:number;note:Copy;
}
const GPIO_PHYS:Readonly<Record<number,number>>={0:1,1:2,2:4,3:5,4:6,5:7,6:9,7:10,8:11,9:12,10:14,11:15,12:16,13:17,14:19,15:20,16:21,17:22,18:24,19:25,20:26,21:27,22:29,26:31,27:32,28:34};
export interface PicoFn{spi?:{bus:0|1;role:'RX'|'CSn'|'SCK'|'TX'};uart?:{bus:0|1;role:'TX'|'RX'|'CTS'|'RTS'};i2c:{bus:0|1;role:'SDA'|'SCL'};pwm:{slice:number;ch:'A'|'B'}}
/** Alt functions of GPn (RP2040 GPIO0-29). */
export function picoFunctions(n:number):PicoFn{
 const r=n%4;
 return {
  ...(n<=29?{spi:{bus:((n>>3)&1) as 0|1,role:(['RX','CSn','SCK','TX'] as const)[r]!}}:{}),
  uart:{bus:([0,1,1,0,0,1,1,0][n>>2]??0) as 0|1,role:(['TX','RX','CTS','RTS'] as const)[r]!},
  i2c:{bus:(((n>>1)%2===0)?0:1) as 0|1,role:n%2===0?'SDA':'SCL'},
  pwm:{slice:(n>>1)%8,ch:n%2===0?'A':'B'},
 };
}
const gp=(n:number):PicoPin=>({key:`GP${n}`,phys:GPIO_PHYS[n],kind:'gpio',gpio:n,note:{en:`GPIO${n}. 3.3 V logic, not 5 V tolerant`,id:`GPIO${n}. Logika 3,3 V, tidak tahan 5 V`}});
const ad=(n:number,ch:number):PicoPin=>({key:`GP${n}`,phys:GPIO_PHYS[n],kind:'adc',gpio:n,adc:ch,note:{en:`GPIO${n} or ADC${ch} (12-bit). 3.3 V logic, not 5 V tolerant`,id:`GPIO${n} atau ADC${ch} (12-bit). Logika 3,3 V, tidak tahan 5 V`}});
const gd=(phys:number):PicoPin=>({key:`GND_${phys}`,phys,kind:'ground',note:{en:'Ground',id:'Ground'}});

/** Edge pins in physical order 1..40, then the 3 SWD pads. */
export const PICO_PINS:readonly PicoPin[]=[
 gp(0),gp(1),gd(3),gp(2),gp(3),gp(4),gp(5),gd(8),gp(6),gp(7),gp(8),gp(9),gd(13),gp(10),gp(11),gp(12),gp(13),gd(18),gp(14),gp(15),
 gp(16),gp(17),gd(23),gp(18),gp(19),gp(20),gp(21),gd(28),gp(22),
 {key:'RUN',phys:30,kind:'reset',note:{en:'Reset: pull low to reset the RP2040',id:'Reset: tarik ke low untuk mereset RP2040'}},
 ad(26,0),ad(27,1),
 {key:'AGND',phys:33,kind:'ground',note:{en:'Analog ground (for the ADC)',id:'Ground analog (untuk ADC)'}},
 ad(28,2),
 {key:'ADC_VREF',phys:35,kind:'power',note:{en:'ADC reference, 3.3 V through a filter',id:'Referensi ADC, 3,3 V lewat filter'}},
 {key:'3V3_OUT',phys:36,kind:'power',note:{en:'3.3 V output, about 300 mA',id:'Keluaran 3,3 V, sekitar 300 mA'}},
 {key:'3V3_EN',phys:37,kind:'reset',note:{en:'Pull low to switch the 3.3 V regulator off',id:'Tarik ke low untuk mematikan regulator 3,3 V'}},
 gd(38),
 {key:'VSYS',phys:39,kind:'power',note:{en:'System supply in, 1.8 to 5.5 V (buck-boost)',id:'Masukan catu sistem, 1,8 sampai 5,5 V (buck-boost)'}},
 {key:'VBUS',phys:40,kind:'power',note:{en:'USB 5 V',id:'USB 5 V'}},
 {key:'SWCLK',kind:'debug',note:{en:'SWD clock pad',id:'Pad clock SWD'}},
 {key:'GND_D',kind:'ground',note:{en:'SWD ground pad',id:'Pad ground SWD'}},
 {key:'SWDIO',kind:'debug',note:{en:'SWD data pad',id:'Pad data SWD'}},
];

export const device=defineDevice<RpiPicoState>({
 kind:'rpi-pico',protocol:'gpio',runtime:'not-emulated',
 pins:PICO_PINS.map(p=>p.key),
 power:{rail:['VSYS','GND_3'],min:1.8,max:5.5},
 copy:{
  name:{en:'Raspberry Pi Pico',id:'Raspberry Pi Pico'},
  desc:{en:'RP2040 microcontroller board (dual Cortex-M0+, 264 KB RAM) with 26 GPIO, 3 ADC inputs, 2 UART, 2 SPI, 2 I2C and 16 PWM channels. Wiring and the pin map are shown; RP2040 code does not run in the browser.',id:'Papan mikrokontroler RP2040 (dual Cortex-M0+, RAM 264 KB) dengan 26 GPIO, 3 input ADC, 2 UART, 2 SPI, 2 I2C, dan 16 kanal PWM. Pengkabelan dan peta pin ditampilkan; kode RP2040 tidak berjalan di browser.'},
  note:{en:'Model only: not emulated. GPIO is 3.3 V and not 5 V tolerant. The on-board LED is GP25 (on the Pico W it sits on the Wi-Fi chip).',id:'Hanya model: tidak diemulasi. GPIO 3,3 V dan tidak tahan 5 V. LED papan di GP25 (di Pico W ada di chip Wi-Fi).'},
 },
 inputs:[{type:'choice',key:'variant',label:{en:'Variant',id:'Varian'},options:[{value:'pico',label:{en:'Pico',id:'Pico'}},{value:'pico-w',label:{en:'Pico W',id:'Pico W'}},{value:'pico2',label:{en:'Pico 2',id:'Pico 2'}}],default:'pico'}],
 create(ctx){return {state:()=>({runtime:'not-emulated',pinCount:PICO_PINS.length,variant:String(ctx.props.variant??'pico')})};},
});
