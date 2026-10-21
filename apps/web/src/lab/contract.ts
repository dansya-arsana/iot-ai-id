/**
 * Arduino lab (/lab) shared contract. Owned by the sim-core module: other modules import it and never edit it.
 * Plain types and constant data only. No imports, no DOM, no side effects: safe in Node tests and build scripts.
 */

// ---------- lessons ----------
export const LESSON_IDS=['board','blink','button','knob','rgb','light','distance','sound','motor','servo','parking'] as const;
export type LessonId=typeof LESSON_IDS[number];
export function isLessonId(s:string|null|undefined):s is LessonId{return !!s&&(LESSON_IDS as readonly string[]).includes(s);}

// ---------- board ----------
export const SIM_CLOCK_HZ=16_000_000;
export const FLASH_WORDS=16384; // ATmega328P: 32 KiB program memory
export const MOTOR_MAX_RPM=6000;
export const UNO_PINS=['D0','D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','A0','A1','A2','A3','A4','A5'] as const;
export type UnoPin=typeof UNO_PINS[number];
export type PowerPin='5V'|'3V3'|'GND'|'VIN';
export type BoardPin=UnoPin|PowerPin;
export type AvrPort='B'|'C'|'D';
/** ATmega328P port and bit behind each UNO pin. */
export const PIN_PORT:Record<UnoPin,{port:AvrPort;bit:number}>={
 D0:{port:'D',bit:0},D1:{port:'D',bit:1},D2:{port:'D',bit:2},D3:{port:'D',bit:3},D4:{port:'D',bit:4},D5:{port:'D',bit:5},D6:{port:'D',bit:6},D7:{port:'D',bit:7},
 D8:{port:'B',bit:0},D9:{port:'B',bit:1},D10:{port:'B',bit:2},D11:{port:'B',bit:3},D12:{port:'B',bit:4},D13:{port:'B',bit:5},
 A0:{port:'C',bit:0},A1:{port:'C',bit:1},A2:{port:'C',bit:2},A3:{port:'C',bit:3},A4:{port:'C',bit:4},A5:{port:'C',bit:5},
};
export const PWM_PINS:readonly UnoPin[]=['D3','D5','D6','D9','D10','D11'];
export const ADC_CHANNEL:Partial<Record<UnoPin,number>>={A0:0,A1:1,A2:2,A3:3,A4:4,A5:5};
/** Clickable features of the UNO board itself. The scene treats them like part ids. */
export const BOARD_FEATURES=['uno.usb','uno.power-jack','uno.mcu','uno.usb-chip','uno.crystal','uno.reset','uno.led-on','uno.led-l','uno.led-txrx','uno.digital-header','uno.analog-header','uno.power-header','uno.icsp'] as const;
export type BoardFeatureId=typeof BOARD_FEATURES[number];
/** A PartSpec.id or a BoardFeatureId. */
export type TargetId=string;

// ---------- circuit ----------
export type PartKind='led'|'resistor'|'button'|'potentiometer'|'rgb-led'|'ldr'|'lamp'|'hcsr04'|'obstacle'|'buzzer'|'transistor'|'diode'|'motor'|'servo';
/** Physical pins per kind (lamp and obstacle are off-board props). motor.net.DRIVE is logical: the PWM pin behind its driver transistor. */
export const PART_PINS:Record<PartKind,readonly string[]>={led:['A','C'],resistor:['1','2'],button:['1','2'],potentiometer:['VCC','SIG','GND'],'rgb-led':['R','G','B','K'],ldr:['A','B'],lamp:[],hcsr04:['VCC','TRIG','ECHO','GND'],obstacle:[],buzzer:['+','-'],transistor:['B','C','E'],diode:['A','K'],motor:['+','-'],servo:['SIG','V','GND']};
export type LedColor='red'|'yellow'|'green'|'blue'|'white';
/**
 * Props by kind: led {color:LedColor}; resistor {ohms, seriesWith?:partId, role:'series'|'pull-down'|'divider'|'base'};
 * button {pull:'down'} (pressed=HIGH); potentiometer {value 0..1023}; ldr {fixedOhms}; lamp {target:ldrId, distanceCm 5..150, on};
 * obstacle {target:hcsr04Id, distanceCm 3..250, shape:'box'|'car'|'ball'|'wall'}; transistor {model:'NPN'}; others {}.
 */
export type PartProps=Record<string,string|number|boolean>;
/** net: part pin -> board pin it is electrically tied to (through series resistors / driver). The simulator reads only this. */
export interface PartSpec{id:string;kind:PartKind;net:Partial<Record<string,BoardPin>>;props:PartProps;}
export type WireColor='red'|'black'|'orange'|'yellow'|'green'|'blue'|'purple'|'white';
/** Jumper from a board header pin to a part pin, or to a breadboard rail (componentId 'bb', pin '5v-rail'|'gnd-rail'). Same shape as our canvas Wiring. Visual/export only. */
export interface Wire{componentId:string;pin:string;boardPin:BoardPin;color:WireColor;}
export interface Circuit{parts:PartSpec[];wires:Wire[];}
export const INPUT_RANGES={potentiometer:{min:0,max:1023},lamp:{min:5,max:150},obstacle:{min:3,max:250}} as const;

const w=(componentId:string,pin:string,boardPin:BoardPin,color:WireColor):Wire=>({componentId,pin,boardPin,color});
const GND_RAIL=w('bb','gnd-rail','GND','black');
const RAILS:Wire[]=[w('bb','5v-rail','5V','red'),GND_RAIL];
const ledOn=(id:string,pin:UnoPin,color:LedColor,rId:string):PartSpec[]=>[{id,kind:'led',net:{A:pin,C:'GND'},props:{color}},{id:rId,kind:'resistor',net:{'1':pin},props:{ohms:220,seriesWith:id,role:'series'}}];
const sonar=(distanceCm:number,shape:'box'|'car'|'ball'|'wall'):PartSpec[]=>[{id:'us1',kind:'hcsr04',net:{VCC:'5V',TRIG:'D7',ECHO:'D6',GND:'GND'},props:{}},{id:'obs1',kind:'obstacle',net:{},props:{target:'us1',distanceCm,shape}}];
const SONAR_WIRES:Wire[]=[w('us1','VCC','5V','red'),w('us1','TRIG','D7','yellow'),w('us1','ECHO','D6','green'),w('us1','GND','GND','black')];
export const CIRCUITS:Record<LessonId,Circuit>={
 board:{parts:[],wires:[]},
 blink:{parts:[...ledOn('led1','D8','red','r1')],wires:[w('r1','1','D8','orange'),GND_RAIL]},
 button:{parts:[{id:'btn1',kind:'button',net:{'1':'5V','2':'D2'},props:{pull:'down'}},{id:'r2',kind:'resistor',net:{'1':'D2','2':'GND'},props:{ohms:10000,role:'pull-down'}},...ledOn('led1','D8','red','r1')],wires:[w('btn1','2','D2','yellow'),w('r1','1','D8','orange'),...RAILS]},
 knob:{parts:[{id:'pot1',kind:'potentiometer',net:{VCC:'5V',SIG:'A0',GND:'GND'},props:{value:512}},...ledOn('led1','D9','green','r1')],wires:[w('pot1','SIG','A0','yellow'),w('r1','1','D9','orange'),...RAILS]},
 rgb:{parts:[{id:'rgb1',kind:'rgb-led',net:{R:'D9',G:'D10',B:'D11',K:'GND'},props:{}},{id:'rR',kind:'resistor',net:{'1':'D9'},props:{ohms:220,seriesWith:'rgb1',role:'series'}},{id:'rG',kind:'resistor',net:{'1':'D10'},props:{ohms:220,seriesWith:'rgb1',role:'series'}},{id:'rB',kind:'resistor',net:{'1':'D11'},props:{ohms:220,seriesWith:'rgb1',role:'series'}}],wires:[w('rR','1','D9','orange'),w('rG','1','D10','green'),w('rB','1','D11','blue'),GND_RAIL]},
 light:{parts:[{id:'ldr1',kind:'ldr',net:{A:'5V',B:'A1'},props:{fixedOhms:10000}},{id:'r2',kind:'resistor',net:{'1':'A1','2':'GND'},props:{ohms:10000,role:'divider'}},{id:'lamp1',kind:'lamp',net:{},props:{target:'ldr1',distanceCm:40,on:true}},...ledOn('led1','D8','yellow','r1')],wires:[w('ldr1','B','A1','green'),w('r1','1','D8','orange'),...RAILS]},
 distance:{parts:sonar(40,'box'),wires:SONAR_WIRES},
 sound:{parts:[{id:'bz1',kind:'buzzer',net:{'+':'D5','-':'GND'},props:{}}],wires:[w('bz1','+','D5','orange'),w('bz1','-','GND','black')]},
 motor:{parts:[{id:'q1',kind:'transistor',net:{B:'D6',E:'GND'},props:{model:'NPN'}},{id:'rb',kind:'resistor',net:{'1':'D6'},props:{ohms:1000,role:'base'}},{id:'d1',kind:'diode',net:{K:'5V'},props:{}},{id:'m1',kind:'motor',net:{DRIVE:'D6'},props:{}}],wires:[w('rb','1','D6','orange'),...RAILS]},
 servo:{parts:[{id:'sv1',kind:'servo',net:{SIG:'D9',V:'5V',GND:'GND'},props:{}}],wires:[w('sv1','SIG','D9','orange'),w('sv1','V','5V','red'),w('sv1','GND','GND','black')]},
 parking:{parts:[...sonar(60,'car'),...ledOn('ledG','D10','green','rG'),...ledOn('ledY','D11','yellow','rY'),...ledOn('ledR','D12','red','rR'),{id:'bz1',kind:'buzzer',net:{'+':'D5','-':'GND'},props:{}}],wires:[...SONAR_WIRES,w('rG','1','D10','green'),w('rY','1','D11','yellow'),w('rR','1','D12','orange'),w('bz1','+','D5','purple'),GND_RAIL]},
};

// ---------- firmware (generated by scripts/build-lab-firmware.ts) ----------
/** C declaration per ctype: uint8 'byte', uint16 'unsigned int', int16 'int', uint32 'unsigned long', int32 'long'. */
export type ParamCType='uint8'|'int16'|'uint16'|'int32'|'uint32';
export interface ParamSpec{name:string;ctype:ParamCType;defaultValue:number;min:number;max:number;step:number;}
/** Sketch folder = `${lessonId}-${variant.id}`. The first variant is the default. */
export interface VariantSpec{id:string;params:ParamSpec[];}
const P=(name:string,ctype:ParamCType,defaultValue:number,min:number,max:number,step:number):ParamSpec=>({name,ctype,defaultValue,min,max,step});
export const FIRMWARE_SPEC:Record<LessonId,{variants:VariantSpec[]}>={
 board:{variants:[{id:'default',params:[P('waitMs','uint16',1000,100,3000,100)]}]},
 blink:{variants:[{id:'default',params:[P('onTime','uint16',500,50,2000,50),P('offTime','uint16',500,50,2000,50)]}]},
 button:{variants:[{id:'hold',params:[]},{id:'toggle',params:[P('debounceMs','uint16',50,5,300,5)]}]},
 knob:{variants:[{id:'default',params:[P('printEvery','uint16',200,50,1000,50)]}]},
 rgb:{variants:[{id:'default',params:[P('red','uint8',255,0,255,1),P('green','uint8',64,0,255,1),P('blue','uint8',160,0,255,1)]}]},
 light:{variants:[{id:'default',params:[P('threshold','uint16',400,50,1000,10)]}]},
 distance:{variants:[{id:'default',params:[P('interval','uint16',250,60,1000,10)]}]},
 sound:{variants:[{id:'scale',params:[P('noteMs','uint16',300,60,800,20)]},{id:'alarm',params:[P('noteMs','uint16',300,60,800,20)]}]},
 motor:{variants:[{id:'default',params:[P('topSpeed','uint8',200,60,255,5),P('stepMs','uint8',20,5,100,5)]}]},
 servo:{variants:[{id:'default',params:[P('fromDeg','uint8',10,0,90,5),P('toDeg','uint8',170,90,180,5),P('stepMs','uint8',15,2,50,1)]}]},
 parking:{variants:[{id:'default',params:[P('nearCm','uint16',15,5,50,1),P('farCm','uint16',40,20,150,5)]}]},
};
export interface FirmwareParam extends ParamSpec{offset:number;} // byte offset of the little-endian initial value in the flash image
export interface FirmwareVariant{
 id:string; sketch:string;      // e.g. 'blink-default'
 source:string;                 // exact .ino text (default values)
 template:string;               // source with each param initialiser replaced by {{name}}
 flashBase64:string; bytes:number; sha256:string; // sha256 of source
 lines:[number,number,number][]; // [firstWord,lastWord,inoLine1Based], sorted, word = byte address / 2
 params:FirmwareParam[];
}
export interface FirmwareBundle{lessonId:LessonId;variants:FirmwareVariant[];}
export interface FirmwareRegistry{toolchain:string;lessons:Record<LessonId,FirmwareBundle>;}
export type ParamValues=Record<string,number>;

// ---------- simulator (apps/web/src/lab/sim exports createLabRunner) ----------
export type SimStatus='idle'|'stopped'|'running'|'error';
export type PinMode='input'|'input-pullup'|'output';
export interface PinSample{mode:PinMode;level:0|1;duty:number;freqHz:number;highUs:number;analog:number|null;}
export type PartInput=
 |{kind:'button';pressed:boolean}
 |{kind:'potentiometer';value:number}
 |{kind:'lamp';distanceCm?:number;on?:boolean}
 |{kind:'obstacle';distanceCm:number};
export type PartState=
 |{kind:'led';brightness:number;on:boolean;currentMa:number;overCurrent:boolean}
 |{kind:'rgb-led';r:number;g:number;b:number}
 |{kind:'button';pressed:boolean}
 |{kind:'potentiometer';value:number}
 |{kind:'ldr';lux:number;adc:number}
 |{kind:'lamp';distanceCm:number;on:boolean}
 |{kind:'hcsr04';pinging:boolean;echoCm:number|null}
 |{kind:'obstacle';distanceCm:number}
 |{kind:'buzzer';on:boolean;freqHz:number}
 |{kind:'motor';duty:number;rpm:number}
 |{kind:'servo';pulseUs:number;angleDeg:number}
 |{kind:'passive'};
export interface SimSnapshot{
 status:SimStatus; error:string|null;
 simTimeMs:number;      // emulated time since load
 speed:number;          // emulated/real time ratio (1 = real time)
 pins:Record<UnoPin,PinSample>;
 parts:Record<string,PartState>; // every PartSpec id of the loaded circuit
 currentLine:number|null;        // 1-based .ino line of the last executed sketch instruction
 txActive:boolean;               // UART sent a byte in the last 30 ms (TX LED)
}
export interface LoadReport{sketch:string;bytes:number;toolchain:string;patched:{name:string;value:number;offset:number}[];}
export interface LabRunner{
 /** Reset the emulated ATmega328P and load the variant with params written into flash. Throws RangeError on bad params. Status -> 'stopped'. */
 load(variant:FirmwareVariant,params:ParamValues,circuit:Circuit,toolchain:string):LoadReport;
 start():void;
 stop():void;
 /** Advance by real elapsed ms (rAF); caps at 50 ms and ~12 ms CPU; no-op unless running. */
 tick(wallMs:number):SimSnapshot;
 /** Advance exactly simMs of emulated time (tests); no-op unless running. */
 advance(simMs:number):SimSnapshot;
 snapshot():SimSnapshot;
 setInput(partId:string,input:PartInput):void;
 setPartProps(partId:string,props:PartProps):void;
 onSerial(cb:(chunk:string)=>void):()=>void;
 serialText():string;
 dispose():void;
}
export type CreateLabRunner=()=>LabRunner;

// ---------- 3D scene (apps/web/src/lab/scene exports createLabScene) ----------
export type ViewCommand='rotate-left'|'rotate-right'|'zoom-in'|'zoom-out'|'reset';
export interface ScreenPoint{x:number;y:number;visible:boolean;} // CSS px relative to the canvas top-left
export interface SceneSettings{grid:boolean;autoRotate:boolean;reducedMotion:boolean;}
export interface LabSceneOptions{
 canvas:HTMLCanvasElement; settings:SceneSettings;
 onSelect(target:TargetId|null):void;
 onHover(target:TargetId|null,at:ScreenPoint|null):void;
 onInput(partId:string,input:PartInput):void;
}
export interface LabScene{
 readonly ready:Promise<void>;
 setLesson(lesson:LessonId,circuit:Circuit):void;
 setPartProps(partId:string,props:PartProps):void;
 update(snap:SimSnapshot,dtMs:number):void; // apply state + render one frame
 resize(cssWidth:number,cssHeight:number,dpr:number):void;
 project(target:TargetId):ScreenPoint|null;
 view(cmd:ViewCommand):void;
 focus(target:TargetId|null):void;
 highlight(target:TargetId|null):void;
 setSettings(s:Partial<SceneSettings>):void;
 zoomLevel():number; // 1 = lesson preset
 dispose():void;
}
/** Throws Error('webgl-unavailable') when no WebGL context can be created. */
export type CreateLabScene=(o:LabSceneOptions)=>LabScene;
