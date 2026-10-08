import type {AgentProvider,Plan,Diagnosis} from './provider.js';
const steps=['Matikan daya sebelum merangkai.','Sambungkan VCC kedua modul ke 3V3 dan GND ke GND bersama.','Sambungkan SDA ke GPIO21 dan SCL ke GPIO22.','Periksa label pin breakout sebenarnya, lalu nyalakan daya.'];
const golden:Plan={supported:true,recipe:'esp32-room-monitor',buttonPin:27,ledPin:26,title:'Monitor Ruangan',summary:'Monitor ruangan ESP32 dengan sensor BME280 dan layar OLED SSD1306 melalui I2C.',sda:21,scl:22,sensorAddress:118,displayAddress:60,steps,clarification:''};

const buttonGolden:Plan={supported:true,recipe:'esp32-button-led',title:'Tombol & LED',summary:'Tombol dengan pull-up internal 10k membaca GPIO27; LED seri 330Ω menyala saat tombol ditekan (GPIO26).',sda:21,scl:22,sensorAddress:118,displayAddress:60,buttonPin:27,ledPin:26,steps:['Matikan daya sebelum merangkai.','Rakit assembly tombol: resistor 10k antara VCC dan SIGNAL, saklar antara SIGNAL dan GND.','Rakit assembly LED: resistor 330Ω dari GPIO26 ke anoda, katoda ke GND.','Nyalakan daya, lalu tekan dan lepas tombol saat eksperimen berjalan.'],clarification:''};
const buttonGoal=/(tombol|button|tekan|press|counter|penghitung|\bled\b|lampu indikator)/i;
const otherUnsupported=/(jarak|distance|ultrasonic|hc-?sr04|relay|relai|servo|motor|kamera|camera|wifi|cloud|storage|sd card|rgb|buzzer|kipas|\bfan\b|threshold|ambang)/i;
const buttonGoalRelevant=(goal:string)=>buttonGoal.test(goal)&&!otherUnsupported.test(goal)&&!goldenGoal.test(goal);
const goldenGoal=/(bme280|oled|ssd1306|suhu|temperature|humidity|kelembapan|monitor ruangan|room monitor)/i;

const pin=(pattern:RegExp,goal:string,fallback:number)=>{const matches=[...goal.matchAll(new RegExp(pattern.source,'gi'))];const match=matches.at(-1);return match?Number(match[1]):fallback;};
/** Mirrors the JevProvider plan rules deterministically: extra actuators, custom thresholds or behavior, networking, storage, other sensors or boards stay unsupported. */
const unsupportedGoal=(goal:string)=>otherUnsupported.test(goal)||(buttonGoal.test(goal)&&!buttonGoalRelevant(goal));
export class FixtureAgent implements AgentProvider {
 async plan(goal:string){
  const unsupported=unsupportedGoal(goal)||buttonGoal.test(goal)&&!buttonGoalRelevant(goal);
  if(!unsupported&&buttonGoal.test(goal)&&!goldenGoal.test(goal)){const plan=structuredClone(buttonGolden);return{plan,route:{fixture:true,note:'Deterministic fixture for automated verification; not a model decision'},provider:'FixtureAgent'};}
  const plan=structuredClone(golden);
  if(unsupported){plan.supported=false;plan.clarification='Perilaku atau komponen di luar resep executable; belum ada resep yang tervalidasi.';}
  return{plan,route:{fixture:true,note:'Deterministic fixture for automated verification; not a model decision'},provider:'FixtureAgent'};
 }
 async revise(goal:string){
  if(buttonGoalRelevant(goal)){const plan=structuredClone(buttonGolden);return{plan,route:{fixture:true},provider:'FixtureAgent'};}
  const unsupported=unsupportedGoal(goal);
  const plan:Plan={...golden,sda:pin(/sda[^0-9]{0,12}(\d{1,2})/i,goal,golden.sda),scl:pin(/scl[^0-9]{0,12}(\d{1,2})/i,goal,golden.scl),supported:!unsupported,clarification:unsupported?'Komponen atau perilaku ini belum punya resep executable yang tervalidasi.':''};
  return{plan,route:{fixture:true},provider:'FixtureAgent'};
 }
 async diagnose():Promise<{diagnosis:Diagnosis;route:unknown;provider:string}>{
  const diagnosis:Diagnosis={category:'communication',summary:'Perangkat I2C tidak merespons sesuai kontrak.',checks:['Periksa kabel SDA dan SCL longgar atau tertukar.','Periksa VCC dan GND dengan daya dimatikan.','Pastikan alamat I2C sesuai kontrak.'],repair:'Matikan daya, rapikan sambungan SDA/SCL, nyalakan ulang, lalu uji ulang.',retryAllowed:true};
  return{diagnosis,route:{fixture:true},provider:'FixtureAgent'};
 }
}
