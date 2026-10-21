import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {UNO_PINS} from '../apps/web/src/lab/contract.js';
import {UNO_W,UNO_D} from '../apps/web/src/lab/scene/layout.js';

const src=readFileSync(new URL('../apps/web/src/lab/scene/board-uno.ts',import.meta.url),'utf8');

test('UNO R3 outline is 68.6 x 53.3 mm',()=>{assert.equal(UNO_W,68.6);assert.equal(UNO_D,53.3);});
test('header layout has 10+8 digital and 8+6 power/analog pins',()=>{
 assert.match(src,/fillHeader\(dig,\['D0'(?:,'D\d'){7}\]\)/);
 assert.match(src,/\['D8','D9','D10','D11','D12','D13','GND3','AREF','SDA','SCL'\]/);
 assert.match(src,/\['NC','IOREF','RESET','3V3','5V','GND','GND2','VIN'\]/);
 assert.match(src,/\['A0','A1','A2','A3','A4','A5'\]/);
 assert.ok(UNO_PINS.includes('D13')&&UNO_PINS.includes('A5'));
});
test('DIP-28 has 14 legs per side, no Arduino logo text',()=>{
 assert.match(src,/for\(let i=0;i<14;i\+\+\)for\(const s of \[-1,1\]\)/);
 assert.doesNotMatch(src,/Arduino/);
 assert.match(src,/UNO R3-compatible/);
});
