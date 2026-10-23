/**
 * Ai-Thinker Ra-02 LoRa module (Semtech SX1278, 433 MHz class), protocol 'spi'. LEARN LAB ONLY.
 * The register file, SPI framing and time on air are the shared SX127x model in lora-rfm95w.ts (createSx127x); only the hardware band
 * (410-525 MHz, SX1278 datasheet) and the pad order differ. Indonesia's LoRaWAN plan is AS923-2 (920-923 MHz), so a Pro design that uses
 * this part is a band error: the catalog record packages/catalog/data/lora-ra02.json carries freqMHz 410-525 and a pitfall saying so,
 * and Pro's design check (M6) compares it with the region plan. Use lora-rfm95w for Pro.
 * Pair: scene/parts/lora-ra02.ts (3D). Both are auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import {createSx127x,SX127X_INPUTS} from './lora-rfm95w';
import type {Sx127xState} from './lora-rfm95w';

export type LoraRa02State=Sx127xState;
export const RA02_BAND={min:410,max:525} as const;   // SX1278 datasheet: 410-525 MHz

export const device=defineDevice<LoraRa02State>({
 kind:'lora-ra02',protocol:'spi',
 // Ai-Thinker Ra-02 pad order (spec PDF V1.1, as listed by common distributors): 16 half-holes, 2.0 mm pitch. Stamp module, wires only.
 pins:['GND','GND2','3V3','RESET','DIO0','DIO1','DIO2','DIO3','GND3','DIO4','DIO5','SCK','MISO','MOSI','NSS','GND4'],
 power:{rail:['3V3','GND'],min:2.5,max:3.7,ma:120},
 copy:{
  name:{en:'Ra-02 LoRa module (433 MHz)',id:'Modul LoRa Ra-02 (433 MHz)'},
  desc:{en:'A 433 MHz LoRa radio (Semtech SX1278 inside), kept for the Learn lab. It is the wrong band for Indonesia (the LoRa plan is 920-923 MHz): Pro flags it as a band error. The simulation is the same SX127x register file as the RFM95W.',id:'Radio LoRa 433 MHz (berisi Semtech SX1278), dipertahankan untuk Lab Belajar. Pita ini salah untuk Indonesia (rencana LoRa 920-923 MHz): Pro menandainya sebagai galat pita. Simulasinya sama dengan RFM95W (register SX127x).'},
  note:{en:'3.3 V only, never 5 V. Solder it to an adapter board. 433 MHz: Learn only, not for Indonesian field designs.',id:'Hanya 3,3 V, jangan 5 V. Solder ke papan adaptor. 433 MHz: hanya untuk belajar, bukan untuk desain lapangan di Indonesia.'},
 },
 inputs:SX127X_INPUTS('lora-ra02'),
 create:ctx=>createSx127x(ctx,{kind:'lora-ra02',bandMin:RA02_BAND.min,bandMax:RA02_BAND.max}),
});
