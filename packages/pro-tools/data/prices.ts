/**
 * Indicative IDR price table (agri-domain §6, October 2026). `basis` V = seen in marketplace listings, E = estimated typical range.
 * The model never sets a price; a kind with no row is reported as missing.
 */
export type PriceRow={minIdr:number;maxIdr:number;unit:'pcs'|'m';basis:'V'|'E'};
export const PRICE_CHECKED_AT='2026-10-23';
export const PRICE_SOURCE='agri-domain.md §6 (indicative, Oct 2026)';
export const PRICE_TABLE_NAME='prices.ts';
export const PRICE_DISCLAIMER={en:'Indicative prices, Oct 2026. Verify before purchase.',id:'Harga indikatif, Okt 2026. Verifikasi sebelum membeli.'} as const;
const r=(minIdr:number,maxIdr:number,basis:'V'|'E'='E',unit:'pcs'|'m'='pcs'):PriceRow=>({minIdr,maxIdr,unit,basis});
export const PRICES:Record<string,PriceRow>={
 'esp32-devkitc':r(60_000,120_000),'esp32-s3-devkitc':r(80_000,160_000),'esp32-module':r(40_000,70_000),'nano':r(35_000,60_000),'uno':r(60_000,150_000),
 'pico-w':r(90_000,160_000),'rpi-4b':r(1_000_000,1_800_000),'rpi-5':r(1_000_000,1_800_000),
 'lora-rfm95w':r(100_000,150_000,'V'),'lora-ra01h':r(70_000,120_000),'lora-devboard':r(250_000,550_000),'lorawan-gateway':r(1_500_000,6_000_000),
 'soil-moisture-capacitive':r(10_000,25_000),'soil-probe-rs485':r(300_000,700_000),'soil-npk-3in1':r(2_000_000,2_000_000,'V'),'soil-7in1':r(2_750_000,4_250_000,'V'),
 'max485':r(5_000,15_000),'rs485-isolated':r(80_000,200_000),
 'dht22':r(40_000,70_000),'bme280':r(40_000,90_000),'sht31':r(80_000,250_000),'rs485-th':r(400_000,1_200_000),
 'bh1750':r(15_000,35_000),'lux-dome':r(150_000,400_000),'par-sensor':r(2_000_000,6_000_000),
 'rain-sensor':r(10_000,20_000),'rain-gauge-tipping':r(500_000,2_500_000),'leaf-wetness':r(800_000,2_500_000),
 'jsn-sr04t':r(60_000,120_000),'float':r(15_000,40_000),'level-4-20ma':r(400_000,1_500_000),
 'ph-analog':r(150_000,400_000),'ec-gravity':r(600_000,1_000_000),'ec-ph-transmitter':r(1_500_000,5_000_000),
 'ds18b20':r(15_000,45_000),
 'valve-12v-plastic':r(50_000,120_000),'valve-12v-brass':r(150_000,400_000),'valve-motorized':r(250_000,600_000),
 'relay-module':r(10_000,20_000),'relay-module-4ch':r(30_000,60_000),'ssr-25a':r(50_000,120_000),'ac-circuit-protection':r(300_000,800_000),
 'dc-pump':r(150_000,350_000),
 'solar-panel-2w':r(30_000,60_000),'solar-panel-20w':r(200_000,350_000),'solar-panel-50w':r(400_000,700_000),
 'charge-controller-pwm':r(50_000,100_000,'V'),'charge-controller-mppt':r(400_000,1_200_000),
 'lifepo4-12v-15ah':r(900_000,1_800_000),'battery-18650-pack':r(30_000,70_000),'cn3791':r(25_000,50_000),'tp4056':r(5_000,10_000),
 'enclosure-ip65':r(50_000,150_000),'cable-gland':r(2_000,5_000),'ptfe-vent':r(10_000,40_000),
 'dc-spd-pv':r(150_000,400_000),'coax-arrester-n':r(100_000,350_000),'earth-rod':r(100_000,250_000),
 'cable-3-core-shielded':r(8_000,20_000,'E','m'),'cable-4-core-shielded':r(8_000,20_000,'E','m'),'cable-power-2x0.75':r(10_000,20_000,'E','m'),
};
/** Kind aliases: catalog kinds that share a row. */
export const PRICE_ALIASES:Record<string,string>={'soil-moisture':'soil-moisture-capacitive','esp32-devkit':'esp32-devkitc','relay-module-1ch':'relay-module','dc-pump-12v':'dc-pump','enclosure-ip65-200x150x100':'enclosure-ip65','cable-gland-pg9':'cable-gland','cable-gland-pg7':'cable-gland'};
export const priceRow=(kind:string):PriceRow|undefined=>PRICES[kind]??PRICES[PRICE_ALIASES[kind]??''];
