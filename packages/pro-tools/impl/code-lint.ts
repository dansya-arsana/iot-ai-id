/**
 * Deterministic code lint (arch §3.5), run before the sandbox compile. The code is never executed.
 * Errors: no CONFIG block; a numeric pin literal in a pin API outside the block; an include outside the board allowlist;
 * a URL, IP or hostname literal other than the placeholders; unsafe Python (eval, exec, os.system, subprocess, socket, __import__);
 * AIOT_BOOT_BANNER not printed in setup. Warning: a CONFIG pin symbol that is never used. `pinsReferenced` comes from this parser, never the LLM.
 */
import {boardProfile} from './common.js';
import {CONFIG_BEGIN,CONFIG_END,BANNER_SYMBOL} from './config-block.js';

export type LintLanguage='arduino-cpp'|'micropython'|'python';
export type LintDiag={line:number;message:string;severity:'error'|'warning'};
export type LintPin={symbol:string;pin:string;lines:number[]};
export type LintResult={ok:boolean;diagnostics:LintDiag[];pinsReferenced:LintPin[];configFound:boolean};

const ARDUINO_COMMON=['Arduino.h','Wire.h','SPI.h','OneWire.h','DallasTemperature.h','DHT.h','RadioLib.h','ArduinoJson.h','Preferences.h','time.h','math.h','stdint.h','string.h','stdlib.h'];
export const INCLUDE_ALLOW:Record<string,string[]>={
 esp32:[...ARDUINO_COMMON,'WiFi.h','WiFiClientSecure.h','PubSubClient.h','esp_sleep.h','esp_task_wdt.h','esp_system.h','driver/adc.h','SD.h','FS.h','RTClib.h','Adafruit_BME280.h','Adafruit_Sensor.h','BH1750.h','Adafruit_SHT31.h','ModbusMaster.h'],
 esp32s3:[...ARDUINO_COMMON,'WiFi.h','WiFiClientSecure.h','PubSubClient.h','esp_sleep.h','esp_task_wdt.h','esp_system.h','SD.h','FS.h','RTClib.h','Adafruit_BME280.h','Adafruit_Sensor.h','BH1750.h','Adafruit_SHT31.h','ModbusMaster.h'],
 avr:[...ARDUINO_COMMON,'avr/sleep.h','avr/wdt.h','avr/power.h','EEPROM.h','SoftwareSerial.h','LowPower.h','RTClib.h','Adafruit_BME280.h','Adafruit_Sensor.h','BH1750.h'],
 rp2040:[...ARDUINO_COMMON,'WiFi.h','PubSubClient.h','LittleFS.h'],
 rpi:[],
};
export const PY_IMPORT_ALLOW=['paho','serial','RPi','gpiozero','spidev','smbus2','LoRaRF','json','time','logging','sqlite3','sys','os','datetime','signal','struct','threading','collections','math','argparse','random','binascii'];
export const MPY_IMPORT_ALLOW=['machine','network','utime','ujson','umqtt','onewire','ds18x20','dht','neopixel','esp32','urandom','gc','ubinascii','micropython','esp','sys','time','json','math','struct'];
const FILE_EXT=new Set(['ino','py','h','cpp','c','json','txt','csv','cfg','bin','md','log','hpp','ini']);

/** Replace comments with spaces (same line count and offsets). Strings are kept. */
export function stripComments(src:string,py:boolean):string{
 const o=src.split('');let i=0;const n=src.length;
 while(i<n){
  const c=src[i]!,d=src[i+1];
  if(py){
   if(c==='#'){while(i<n&&src[i]!=='\n'){o[i]=' ';i++;}continue;}
   if((c==='"'||c==="'")&&src.startsWith(c.repeat(3),i)){const q=c.repeat(3);i+=3;while(i<n&&!src.startsWith(q,i))i++;i+=3;continue;}
  }else{
   if(c==='/'&&d==='/'){while(i<n&&src[i]!=='\n'){o[i]=' ';i++;}continue;}
   if(c==='/'&&d==='*'){while(i<n&&!(src[i]==='*'&&src[i+1]==='/')){if(src[i]!=='\n')o[i]=' ';i++;}if(i<n){o[i]=' ';o[i+1]=' ';}i+=2;continue;}
  }
  if(c==='"'||c==="'"){i++;while(i<n&&src[i]!==c&&src[i]!=='\n'){if(src[i]==='\\')i++;i++;}i++;continue;}
  i++;
 }
 return o.join('');
}
const lineOf=(text:string,idx:number)=>text.slice(0,idx).split('\n').length;

export type LintInput={content:string;language:LintLanguage;board?:string;localHeaders?:string[]};
export function lintCode(input:LintInput):LintResult{
 const py=input.language!=='arduino-cpp',cm=py?'#':'//';
 const diags:LintDiag[]=[];
 const err=(line:number,message:string)=>diags.push({line,message:message.slice(0,400),severity:'error'});
 const warn=(line:number,message:string)=>diags.push({line,message:message.slice(0,400),severity:'warning'});
 const lines=input.content.split('\n');
 const bi=lines.findIndex(l=>l.trim().startsWith(cm)&&l.includes('==== CONFIG ('));
 const ei=bi<0?-1:lines.findIndex((l,k)=>k>bi&&l.trim().startsWith(cm)&&l.includes(CONFIG_END));
 const configFound=bi>=0&&ei>bi;
 if(!configFound)err(0,`Missing generated CONFIG block (${CONFIG_BEGIN} ... ${CONFIG_END}).`);
 // config symbols
 const symbols=new Map<string,{pin:string;line:number}>();
 if(configFound){
  for(let k=bi+1;k<ei;k++){
   const l=lines[k]!;
   const m=py?/^\s*(PIN_[A-Z0-9_]+)\s*=\s*\S+\s*(?:#\s*(\S+))?/.exec(l):/^\s*#define\s+(PIN_[A-Z0-9_]+)\s+\S+\s*(?:\/\/\s*(\S+))?/.exec(l);
   if(m)symbols.set(m[1]!,{pin:(m[2]??'').slice(0,12)||'?',line:k+1});
  }
 }
 // code outside the block, comments blanked
 const outside=lines.map((l,k)=>configFound&&k>=bi&&k<=ei?'':l).join('\n');
 const code=stripComments(outside,py);
 const clines=code.split('\n');
 const each=(re:RegExp,fn:(m:RegExpExecArray,line:number)=>void)=>{const g=new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g');let m:RegExpExecArray|null;while((m=g.exec(code)))fn(m,lineOf(code,m.index));};

 // pin literals
 if(!py){
  each(/\b(pinMode|digitalWrite|digitalRead|analogRead|analogWrite|ledcAttach|ledcAttachPin|dacWrite|touchRead|pulseIn|tone|noTone|shiftOut|shiftIn)\s*\(\s*(-?\d+|A\d+|GPIO_NUM_\d+|GPIO\d+)\b/,(m,l)=>err(l,`Numeric pin literal ${m[2]} in ${m[1]}(). Use a PIN_ symbol from the CONFIG block.`));
  each(/\battachInterrupt\s*\(\s*(?:digitalPinToInterrupt\s*\(\s*)?(\d+)\b/,(m,l)=>err(l,`Numeric pin literal ${m[1]} in attachInterrupt(). Use a PIN_ symbol.`));
  each(/\bOneWire\s+\w+\s*\(\s*\d+\s*\)|\bOneWire\s*\(\s*\d+\s*\)/,(_m,l)=>err(l,'Numeric pin literal in OneWire(). Use a PIN_ symbol.'));
  each(/\b(Wire|SPI)\.begin\s*\(\s*\d+/,(m,l)=>err(l,`Numeric pin literal in ${m[1]}.begin(). Use PIN_ symbols.`));
  each(/\bSerial[12]\.begin\s*\([^)]*,[^)]*,\s*\d+\s*,\s*\d+/,(_m,l)=>err(l,'Numeric pin literal in Serial.begin(). Use PIN_ symbols.'));
  each(/\bModule\s+\w+\s*\(\s*\d+|\bnew\s+Module\s*\(\s*\d+|\bModule\s*\(\s*\d+/,(_m,l)=>err(l,'Numeric pin literal in the radio Module(). Use PIN_ symbols.'));
  each(/^\s*#\s*define\s+PIN_\w+\s+\S+/m,(_m,l)=>err(l,'PIN_ symbols are defined only in the CONFIG block.'));
 }else{
  each(/\bGPIO\.(?:setup|output|input)\s*\(\s*\d+/,(_m,l)=>err(l,'Numeric pin literal in GPIO call. Use a PIN_ constant from the CONFIG block.'));
  each(/\b(?:Pin|ADC|PWM|LED|Button|OutputDevice|InputDevice|DigitalOutputDevice|DigitalInputDevice|PWMOutputDevice)\s*\(\s*\d+/,(_m,l)=>err(l,'Numeric pin literal. Use a PIN_ constant from the CONFIG block.'));
  each(/^\s*PIN_[A-Z0-9_]+\s*=/m,(_m,l)=>err(l,'PIN_ constants are defined only in the CONFIG block.'));
 }
 // includes / imports
 if(!py){
  const fam=input.board?boardProfile(input.board).family:'esp32';
  const allow=new Set([...(INCLUDE_ALLOW[fam]??[]),...(input.localHeaders??[])]);
  each(/^\s*#\s*include\s*([<"])([^>"]+)[>"]/m,(m,l)=>{if(!allow.has(m[2]!))err(l,`#include ${m[1]}${m[2]}${m[1]==='<'?'>':'"'} is not in the ${fam} allowlist.`);});
 }else{
  const allow=new Set(input.language==='micropython'?MPY_IMPORT_ALLOW:PY_IMPORT_ALLOW);
  each(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+(?:\s*,\s*[\w.]+)*))/m,(m,l)=>{
   const mods=m[1]?[m[1]]:m[2]!.split(',').map(x=>x.trim());
   for(const mod of mods){const root=mod.split('.')[0]!;if(!allow.has(root))err(l,`import ${mod} is not allowed.`);}
  });
  each(/\beval\s*\(/,(_m,l)=>err(l,'eval() is not allowed.'));
  each(/\bexec\s*\(/,(_m,l)=>err(l,'exec() is not allowed.'));
  each(/\bos\.system\b|\bos\.popen\b/,(_m,l)=>err(l,'os.system/os.popen is not allowed.'));
  each(/\bsubprocess\b/,(_m,l)=>err(l,'subprocess is not allowed.'));
  each(/\b__import__\b/,(_m,l)=>err(l,'__import__ is not allowed.'));
  each(/\bsocket\b/,(_m,l)=>err(l,'socket is not allowed.'));
 }
 // URLs, IPs, hostnames (placeholders YOUR_* are fine)
 each(/\b(?:https?|mqtts?|wss?|ftp|tcp|ssh):\/\/[^\s"')]*/i,(m,l)=>{if(!/YOUR_/.test(m[0]))err(l,`URL literal ${m[0].slice(0,60)} is not allowed; the user fills endpoints in on their own machine.`);});
 each(/["'](?:\d{1,3}\.){3}\d{1,3}(?::\d+)?["']/,(m,l)=>err(l,`IP literal ${m[0]} is not allowed.`));
 each(/"([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)"|'([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)'/,(m,l)=>{
  const h=m[1]??m[2]!,tld=h.split('.').pop()!;
  if(/^[A-Za-z]{2,}$/.test(tld)&&!FILE_EXT.has(tld.toLowerCase())&&!/^YOUR_/.test(h))err(l,`Hostname literal "${h}" is not allowed.`);
 });
 // pin symbol usage
 const pinsReferenced:LintPin[]=[];
 for(const [sym,info] of symbols){
  const used:number[]=[];
  clines.forEach((l,k)=>{if(new RegExp(`\\b${sym}\\b`).test(l))used.push(k+1);});
  if(used.length===0)warn(info.line,`${sym} is defined in CONFIG but never used.`);
  else pinsReferenced.push({symbol:sym,pin:info.pin,lines:used.slice(0,50)});
 }
 // boot banner
 if(!py){
  const m=/\bvoid\s+setup\s*\(\s*(?:void)?\s*\)\s*\{/.exec(code);
  if(!m)err(0,'setup() not found.');
  else{
   let depth=1,k=m.index+m[0].length;
   while(k<code.length&&depth>0){if(code[k]==='{')depth++;else if(code[k]==='}')depth--;k++;}
   const body=code.slice(m.index+m[0].length,k);
   if(!new RegExp(`\\bSerial\\d?\\s*\\.\\s*(?:print|println|printf|write)\\s*\\([^;]*${BANNER_SYMBOL}`).test(body))err(lineOf(code,m.index),`setup() must print ${BANNER_SYMBOL} (Serial.println(${BANNER_SYMBOL})).`);
  }
 }else if(!new RegExp(`\\bprint\\s*\\([^)]*${BANNER_SYMBOL}`).test(code))err(0,`The script must print ${BANNER_SYMBOL} at start (print(${BANNER_SYMBOL})).`);

 diags.sort((a,b)=>(a.severity===b.severity?0:a.severity==='error'?-1:1)||a.line-b.line);
 return {ok:!diags.some(d=>d.severity==='error'),diagnostics:diags.slice(0,20),pinsReferenced,configFound};
}
