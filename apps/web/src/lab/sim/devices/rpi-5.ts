/**
 * Raspberry Pi 5 (BCM2712 + RP1 I/O controller), model only. Same 40-pin header and numbering as the Pi 4, so RPI_HEADER is imported from rpi-4b.ts.
 * The header GPIO is driven by RP1, not the SoC: function select comes from the RP1 peripherals datasheet, GPIO bank 0
 * (https://datasheets.raspberrypi.com/rp1/rp1-peripherals.pdf). Only the header-default functions that Raspberry Pi documents
 * (and that match the Pi 4) are listed in RP1_ALT [K]; the full a0..a8 FUNCSEL table is NOT typed from memory [U, see docs/lab-parts/rpi-5.md].
 * Pair: scene/parts/rpi-5.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import {RPI_HEADER,RPI_PIN_KEYS} from './rpi-4b';
import type {RpiState} from './rpi-4b';

/** Documented RP1 header functions per GPIO (defaults match the Pi 4). Not the full FUNCSEL table. */
export const RP1_ALT:Readonly<Record<number,readonly string[]>>={
 0:['I2C0_SDA','ID_SD'],1:['I2C0_SCL','ID_SC'],
 2:['I2C1_SDA'],3:['I2C1_SCL'],
 4:['GPCLK0'],5:['GPCLK1'],6:['GPCLK2'],
 7:['SPI0_CE1'],8:['SPI0_CE0'],9:['SPI0_MISO'],10:['SPI0_MOSI'],11:['SPI0_SCLK'],
 12:['PWM0_CH0'],13:['PWM0_CH1'],
 14:['UART0_TX'],15:['UART0_RX'],
 16:['SPI1_CE2'],18:['PCM_CLK','SPI1_CE0','PWM0_CH2'],19:['PCM_FS','SPI1_MISO','PWM0_CH3'],
 20:['PCM_DIN','SPI1_MOSI'],21:['PCM_DOUT','SPI1_SCLK'],
};
export const RPI5_HEADER=RPI_HEADER;

export const device=defineDevice<RpiState>({
 kind:'rpi-5',protocol:'gpio',runtime:'not-emulated',
 pins:RPI_PIN_KEYS,
 power:{rail:['5V_2','GND_6'],min:4.75,max:5.25,ma:5000},
 copy:{
  name:{en:'Raspberry Pi 5',id:'Raspberry Pi 5'},
  desc:{en:'Faster Linux single-board computer with the RP1 I/O chip, a power button, PCIe and a 40-pin header. Used as the farm gateway: wiring and the pin map are shown, nothing runs here.',id:'Komputer papan tunggal Linux lebih cepat dengan chip I/O RP1, tombol daya, PCIe, dan header 40 pin. Dipakai sebagai gateway kebun: pengkabelan dan peta pin ditampilkan, tidak ada yang berjalan di sini.'},
  note:{en:'Model only; lint-checked, never run here. On Pi 5 the legacy RPi.GPIO does not work: use gpiozero/lgpio (spidev and smbus2 are unchanged). Needs a 5 V / 5 A supply.',id:'Hanya model; hanya di-lint, tidak dijalankan di sini. Di Pi 5 RPi.GPIO lama tidak berfungsi: pakai gpiozero/lgpio (spidev dan smbus2 tetap). Butuh catu 5 V / 5 A.'},
 },
 inputs:[],
 create(){return {state:()=>({runtime:'not-emulated',pinCount:RPI_HEADER.length,variant:'5'})};},
});
