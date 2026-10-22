/**
 * NTC thermistor module, 10 kOhm at 25 degC, B = 3950 K (protocol 'adc'), with its divider on the module.
 * Resistance follows the beta model R(T) = R25 * exp(B * (1/T - 1/T25)) with T in kelvin; that is what the common 10k B3950 bead follows
 * between 0 and 50 degC (the B value is specified for 25/50 degC, so far outside that range a real bead drifts from this curve).
 * Divider: 3V3/5V (VCC) -> NTC -> SIG -> series resistor (default 10k) -> GND, so the voltage on SIG RISES when it gets warmer.
 * A sketch inverts it with the beta equation or the Steinhart-Hart one.
 * Pair: scene/parts/ntc-thermistor.ts. Both are auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';

export const NTC={r25:10000,beta:3950,t25:298.15,min:-40,max:125};

/** Thermistor resistance in ohms at tempC. */
export const ntcOhms=(tempC:number,beta=NTC.beta,r25=NTC.r25):number=>r25*Math.exp(beta*(1/(tempC+273.15)-1/NTC.t25));
/** The temperature a resistance means (inverse of ntcOhms). */
export const ntcTempC=(ohms:number,beta=NTC.beta,r25=NTC.r25):number=>1/(1/NTC.t25+Math.log(ohms/r25)/beta)-273.15;
/** Voltage on SIG for a supply, temperature and series resistor. */
export const ntcVolts=(supply:number,tempC:number,seriesOhms:number):number=>supply*seriesOhms/(seriesOhms+ntcOhms(tempC));

export type NtcState={tempC:number;ohms:number;volts:number;adc:number};

export const device=defineDevice<NtcState>({
 kind:'ntc-thermistor',protocol:'adc',
 pins:['VCC','SIG','GND'],holes:[0,1,2],
 copy:{
  name:{en:'NTC thermistor (10k, B3950)',id:'Termistor NTC (10k, B3950)'},
  desc:{en:'A resistor that gets smaller when it is warm. With its fixed 10k resistor it makes a voltage divider your analog pin can read.',id:'Resistor yang mengecil saat hangat. Bersama resistor tetap 10k ia membentuk pembagi tegangan yang bisa dibaca pin analog.'},
  note:{en:'Slide the temperature and the series resistor. The voltage on SIG rises as it warms; the sketch turns it back into degrees with the beta equation.',id:'Geser suhu dan resistor serinya. Tegangan di SIG naik saat makin hangat; sketsa mengubahnya kembali menjadi derajat dengan persamaan beta.'},
 },
 power:{rail:['VCC','GND'],min:3,max:5.5,ma:0.5},
 inputs:[
  {type:'range',key:'tempC',label:{en:'Temperature',id:'Suhu'},min:NTC.min,max:NTC.max,step:0.5,unit:'°C',default:25},
  {type:'range',key:'seriesOhms',label:{en:'Series resistor',id:'Resistor seri'},min:1000,max:100000,step:1000,unit:'Ω',default:10000},
 ],
 defaults:{tempC:25,seriesOhms:10000},
 create(ctx){
  const pin=ctx.analogPin('SIG');
  const temp=():number=>clamp(num(ctx.props.tempC,25),NTC.min,NTC.max);
  const series=():number=>clamp(num(ctx.props.seriesOhms,10000),1000,100000);
  const supply=():number=>ctx.supply()??ctx.volts('VCC')??5;
  const volts=():number=>ntcVolts(supply(),temp(),series());
  return {
   state:()=>{const v=volts();return {tempC:temp(),ohms:Math.round(ntcOhms(temp())),volts:v,adc:Math.round(clamp(v/5,0,1)*1023)};},
   adc:()=>pin?{pin,volts:volts()}:null,
  };
 },
});
