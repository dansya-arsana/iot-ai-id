/**
 * Raspberry Pi 4 Model B (BCM2711), model only. The Pi runs Linux: the gateway.py that Pro writes for it is lint-checked, never run here.
 * Protocol 'gpio' is only a scaffold label; `runtime:'not-emulated'` says so on the def and in state().
 * Shared by rpi-5.ts (same 40-pin header, same numbering). Header map: Raspberry Pi hardware docs / pinout.xyz [K].
 * Alt functions: BCM2711 ARM Peripherals, section 5.3 "Alternative Function Assignments"
 * (https://datasheets.raspberrypi.com/bcm2711/bcm2711-peripherals.pdf), typed by us and cross-checked against pinout.xyz [K, see docs/lab-parts/rpi-4b.md].
 * Pair: scene/parts/rpi-4b.ts (3D). Both are auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import type {Copy} from './types';

export type RpiState={runtime:'not-emulated';pinCount:number;variant:string};

export interface RpiHeaderPin{
 /** wire name: GPIOn, or 3V3_p / 5V_p / GND_p (p = physical pin) */key:string;
 /** physical pin 1..40 (odd = inner row near the board edge side of pin 1) */phys:number;
 kind:'power'|'ground'|'gpio';
 gpio?:number;
 /** default (boot) function silk, e.g. SDA1 */dflt?:string;
 /** HAT ID EEPROM pins (GPIO0/1): leave free unless you are a HAT */reserved?:boolean;
 /** pull at reset: GPIO0-8 pull-up, 9-27 pull-down [K] */pull?:'up'|'down';
 note:Copy;
}
const pw=(phys:number,v:'3V3'|'5V'):RpiHeaderPin=>({key:`${v}_${phys}`,phys,kind:'power',note:v==='3V3'?{en:'3.3 V from the board regulator (keep the total below about 500 mA)',id:'3,3 V dari regulator papan (jaga total di bawah sekitar 500 mA)'}:{en:'5 V straight from the USB-C input (also powers the Pi when fed here)',id:'5 V langsung dari input USB-C (juga menyalakan Pi bila diberi di sini)'}});
const gd=(phys:number):RpiHeaderPin=>({key:`GND_${phys}`,phys,kind:'ground',note:{en:'Ground',id:'Ground'}});
const g=(phys:number,gpio:number,dflt?:string,o:Partial<RpiHeaderPin>={}):RpiHeaderPin=>({key:`GPIO${gpio}`,phys,kind:'gpio',gpio,...(dflt?{dflt}:{}),pull:gpio<=8?'up':'down',note:{en:dflt?`GPIO${gpio}, default ${dflt}. 3.3 V logic, not 5 V tolerant`:`GPIO${gpio}. 3.3 V logic, not 5 V tolerant`,id:dflt?`GPIO${gpio}, bawaan ${dflt}. Logika 3,3 V, tidak tahan 5 V`:`GPIO${gpio}. Logika 3,3 V, tidak tahan 5 V`},...o});

/** The 40-pin header in physical order (pin 1 first). Odd pins are on the pin-1 row. */
export const RPI_HEADER:readonly RpiHeaderPin[]=[
 pw(1,'3V3'),pw(2,'5V'),
 g(3,2,'SDA1'),pw(4,'5V'),
 g(5,3,'SCL1'),gd(6),
 g(7,4,'GPCLK0'),g(8,14,'TXD0'),
 gd(9),g(10,15,'RXD0'),
 g(11,17),g(12,18,'PCM_CLK / PWM0'),
 g(13,27),gd(14),
 g(15,22),g(16,23),
 pw(17,'3V3'),g(18,24),
 g(19,10,'SPI0_MOSI'),gd(20),
 g(21,9,'SPI0_MISO'),g(22,25),
 g(23,11,'SPI0_SCLK'),g(24,8,'SPI0_CE0'),
 gd(25),g(26,7,'SPI0_CE1'),
 g(27,0,'ID_SD',{reserved:true,note:{en:'HAT ID EEPROM data (I2C0): leave free unless you are a HAT',id:'Data EEPROM ID HAT (I2C0): biarkan kosong kecuali Anda HAT'}}),
 g(28,1,'ID_SC',{reserved:true,note:{en:'HAT ID EEPROM clock (I2C0): leave free unless you are a HAT',id:'Clock EEPROM ID HAT (I2C0): biarkan kosong kecuali Anda HAT'}}),
 g(29,5,'GPCLK1'),gd(30),
 g(31,6,'GPCLK2'),g(32,12,'PWM0'),
 g(33,13,'PWM1'),gd(34),
 g(35,19,'PCM_FS / SPI1_MISO / PWM1'),g(36,16,'SPI1_CE2'),
 g(37,26),g(38,20,'PCM_DIN / SPI1_MOSI'),
 gd(39),g(40,21,'PCM_DOUT / SPI1_SCLK'),
];
/** Pin keys in physical order. */
export const RPI_PIN_KEYS:readonly string[]=RPI_HEADER.map(p=>p.key);

/**
 * BCM2711 ALT0..ALT5 per GPIO0-27 (peripherals datasheet section 5.3) [K, verify against the PDF]. '-' = reserved.
 * The header exposes GPIO0-27 only.
 */
export const BCM2711_ALT:Readonly<Record<number,readonly [string,string,string,string,string,string]>>={
 0:['SDA0','SA5','PCLK','SPI3_CE0_N','TXD2','SDA6'],
 1:['SCL0','SA4','DE','SPI3_MISO','RXD2','SCL6'],
 2:['SDA1','SA3','LCD_VSYNC','SPI3_MOSI','CTS2','SDA3'],
 3:['SCL1','SA2','LCD_HSYNC','SPI3_SCLK','RTS2','SCL3'],
 4:['GPCLK0','SA1','DPI_D0','SPI4_CE0_N','TXD3','SDA3'],
 5:['GPCLK1','SA0','DPI_D1','SPI4_MISO','RXD3','SCL3'],
 6:['GPCLK2','SOE_N','DPI_D2','SPI4_MOSI','CTS3','SDA4'],
 7:['SPI0_CE1_N','SWE_N','DPI_D3','SPI4_SCLK','RTS3','SCL4'],
 8:['SPI0_CE0_N','SD0','DPI_D4','BSCSL_CE_N','TXD4','SDA4'],
 9:['SPI0_MISO','SD1','DPI_D5','BSCSL_MISO','RXD4','SCL4'],
 10:['SPI0_MOSI','SD2','DPI_D6','BSCSL_SDA_MOSI','CTS4','SDA5'],
 11:['SPI0_SCLK','SD3','DPI_D7','BSCSL_SCL_SCLK','RTS4','SCL5'],
 12:['PWM0_0','SD4','DPI_D8','SPI5_CE0_N','TXD5','SDA5'],
 13:['PWM0_1','SD5','DPI_D9','SPI5_MISO','RXD5','SCL5'],
 14:['TXD0','SD6','DPI_D10','SPI5_MOSI','CTS5','TXD1'],
 15:['RXD0','SD7','DPI_D11','SPI5_SCLK','RTS5','RXD1'],
 16:['-','SD8','DPI_D12','CTS0','SPI1_CE2_N','CTS1'],
 17:['-','SD9','DPI_D13','RTS0','SPI1_CE1_N','RTS1'],
 18:['PCM_CLK','SD10','DPI_D14','SPI6_CE0_N','SPI1_CE0_N','PWM0_0'],
 19:['PCM_FS','SD11','DPI_D15','SPI6_MISO','SPI1_MISO','PWM0_1'],
 20:['PCM_DIN','SD12','DPI_D16','SPI6_MOSI','SPI1_MOSI','GPCLK0'],
 21:['PCM_DOUT','SD13','DPI_D17','SPI6_SCLK','SPI1_SCLK','GPCLK1'],
 22:['SD0_CLK','SD14','DPI_D18','SD1_CLK','ARM_TRST','SDA6'],
 23:['SD0_CMD','SD15','DPI_D19','SD1_CMD','ARM_RTCK','SCL6'],
 24:['SD0_DAT0','SD16','DPI_D20','SD1_DAT0','ARM_TDO','SPI3_CE1_N'],
 25:['SD0_DAT1','SD17','DPI_D21','SD1_DAT1','ARM_TCK','SPI4_CE1_N'],
 26:['SD0_DAT2','TE0','DPI_D22','SD1_DAT2','ARM_TDI','SPI5_CE1_N'],
 27:['SD0_DAT3','TE1','DPI_D23','SD1_DAT3','ARM_TMS','SPI6_CE1_N'],
};

export const device=defineDevice<RpiState>({
 kind:'rpi-4b',protocol:'gpio',runtime:'not-emulated',
 pins:RPI_PIN_KEYS,
 power:{rail:['5V_2','GND_6'],min:4.75,max:5.25,ma:3000},
 copy:{
  name:{en:'Raspberry Pi 4 Model B',id:'Raspberry Pi 4 Model B'},
  desc:{en:'Quad-core Linux single-board computer with a 40-pin header, Wi-Fi, Gigabit Ethernet and 2 x micro-HDMI. Used as the farm gateway: wiring and the pin map are shown, nothing runs here.',id:'Komputer papan tunggal Linux quad-core dengan header 40 pin, Wi-Fi, Ethernet Gigabit, dan 2 x micro-HDMI. Dipakai sebagai gateway kebun: pengkabelan dan peta pin ditampilkan, tidak ada yang berjalan di sini.'},
  note:{en:'Model only: the gateway runs Linux; the gateway.py that Pro writes for it is lint-checked, never run here. GPIO is 3.3 V and not 5 V tolerant.',id:'Hanya model: gateway menjalankan Linux; gateway.py yang ditulis Pro untuknya hanya di-lint, tidak pernah dijalankan di sini. GPIO 3,3 V dan tidak tahan 5 V.'},
 },
 inputs:[],
 create(){return {state:()=>({runtime:'not-emulated',pinCount:RPI_HEADER.length,variant:'4b'})};},
});
