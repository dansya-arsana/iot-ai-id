/** Raspberry Pi 5: 85 x 56 mm, 2x20 header, RP1 I/O (model only). Body in scene/rpi-body.ts. Guide: docs/lab-extending.md */
import type {PartProps} from '../../contract';
import {RPI_HEADER} from '../../sim/devices/rpi-4b';
import {buildPi,piPin,PI_TOP,PI_SOC_X,PI_L,PI_W} from '../rpi-body';
import {definePart,c,pin,callout,type Inner} from './kit';
import type {PinDef} from './types';

const pins:Record<string,PinDef>={};
for(const p of RPI_HEADER)pins[p.key]=pin(piPin(p.phys),p.kind==='power'?'power':p.kind==='ground'?'ground':'output',`Pin ${p.phys}: ${p.note.en}`,`Pin ${p.phys}: ${p.note.id}`);

export const rpi5=definePart({
 kind:'rpi-5',name:c('Raspberry Pi 5','Raspberry Pi 5'),
 pins,deskMm:[PI_L,PI_W],
 callouts:[
  callout('header',[piPin(1)[0]-3,piPin(1)[1]+1,piPin(1)[2]],'40-pin header, pin 1 marked: GPIO is 3.3 V and not 5 V tolerant','Header 40 pin, pin 1 bertanda: GPIO 3,3 V dan tidak tahan 5 V'),
  callout('power',[-31.3,PI_TOP+5,PI_W/2-3],'USB-C power: 5 V at 5 A (PD)','Daya USB-C: 5 V pada 5 A (PD)'),
  callout('soc',[PI_SOC_X,PI_TOP+2,3],'BCM2712 SoC with a metal lid','SoC BCM2712 dengan tutup logam'),
  callout('rp1',[26,PI_TOP+2,-3],'RP1 chip: it drives the header GPIO, so use gpiozero or lgpio, not RPi.GPIO','Chip RP1: menggerakkan GPIO header, jadi pakai gpiozero atau lgpio, bukan RPi.GPIO'),
  callout('model',[-10,PI_TOP+6,10],'Model only: the gateway runs Linux; gateway.py is lint-checked, never run here','Hanya model: gateway menjalankan Linux; gateway.py hanya di-lint, tidak dijalankan di sini'),
 ],
 make(_p:PartProps,g):Inner{buildPi(g,{model:'5'});return {apply(){}};},
});
