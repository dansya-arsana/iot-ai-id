/**
 * OLED-SSD1306 (0.96in 128x64 I2C module, slave address 0x3C).
 * Models the SSD1306 command/data stream per the public datasheet: I2C control byte (Co, D/C#), the three memory
 * addressing modes, column/page windows, start line, display offset, segment/COM remap, contrast, invert, entire-on and
 * display on/off. GDDRAM is 128 columns x 8 pages (1 byte = 8 vertical pixels, LSB on top). Scroll commands are
 * parsed (arguments consumed) but not animated. state().fb is the composed visible 128x64 frame, same page layout, hex.
 * Pair: scene/parts/oled-ssd1306.ts. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';

export type OledSsd1306State={fb:string;on:boolean;contrast:number;writes:number;cmds:number;color:string};

const W=128,PAGES=8;
const HEX='0123456789abcdef';
/** Number of argument bytes that follow a command byte. */
function argCount(c:number):number{
 switch(c){
  case 0x20:case 0x81:case 0x8d:case 0xa8:case 0xd3:case 0xd5:case 0xd9:case 0xda:case 0xdb:return 1;
  case 0x21:case 0x22:case 0xa3:return 2;
  case 0x29:case 0x2a:return 5;
  case 0x26:case 0x27:return 6;
  case 0xd6:case 0xad:case 0xdc:return 1; // zoom, IREF select, display start line (consumed, not modelled)
  case 0x2c:case 0x2d:return 6; // not on all parts; harmless
  default:return 0;
 }
}

export const device=defineDevice<OledSsd1306State>({
 kind:'oled-ssd1306',protocol:'i2c',
 pins:['VCC','SDA','SCL','GND'],holes:[0,1,2,3],bodyX:[-9.7,17.3],
 copy:{
  name:{en:'OLED display 0.96" (SSD1306)',id:'Layar OLED 0,96" (SSD1306)'},
  desc:{en:'A 128x64 pixel monochrome screen on I2C (address 0x3C). The sketch sends real SSD1306 commands and pixel bytes; every pixel you see was written by the code.',id:'Layar monokrom 128x64 piksel lewat I2C (alamat 0x3C). Sketch mengirim perintah dan byte piksel SSD1306 yang asli; setiap piksel yang tampak ditulis oleh kode.'},
  note:{en:'Needs Wire on A4/A5. Nothing shows until the sketch sends display-on and pixel data.',id:'Butuh Wire di A4/A5. Tidak ada tampilan sebelum sketch mengirim perintah display-on dan data piksel.'},
 },
 power:{rail:['VCC','GND'],min:3.0,max:5.5,ma:20},
 inputs:[{type:'choice',key:'color',label:{en:'Panel colour',id:'Warna panel'},options:[{value:'white',label:{en:'White',id:'Putih'}},{value:'blue',label:{en:'Blue',id:'Biru'}}],default:'white'}],
 create(ctx){
  const ram=new Uint8Array(W*PAGES);
  let mode=2,col=0,page=0,colS=0,colE=127,pgS=0,pgE=7;
  let start=0,offset=0,contrast=0x7f,segRemap=false,comRev=false,entireOn=false,inverse=false,on=false;
  let writes=0,cmds=0;
  // I2C framing
  let ctrl=true,dataMode=false,pendingData=false;
  // command parser
  let cmd=-1,args:number[]=[];
  let version=0,cacheV=-1,cache='';

  const advance=():void=>{
   if(mode===2){col=(col+1)%W;return;}
   if(mode===0){
    if(col>=colE){col=colS;page=page>=pgE?pgS:page+1;}else col++;
   }else{
    if(page>=pgE){page=pgS;col=col>=colE?colS:col+1;}else page++;
   }
  };
  const data=(b:number):void=>{writes++;ram[(page&7)*W+(col&127)]=b;version++;advance();};
  const finish=(c:number,a:number[]):void=>{
   switch(c){
    case 0x20:mode=a[0]!&3;if(mode===3)mode=2;break;
    case 0x21:colS=a[0]!&127;colE=a[1]!&127;col=colS;break;
    case 0x22:pgS=a[0]!&7;pgE=a[1]!&7;page=pgS;break;
    case 0x81:contrast=a[0]!;break;
    case 0xa8:break; // mux ratio: 64 assumed
    case 0xd3:offset=a[0]!&63;break;
   }
   version++;
  };
  const command=(b:number):void=>{
   cmds++;
   if(cmd>=0){
    args.push(b);
    if(args.length>=argCount(cmd)){const c=cmd,a=args;cmd=-1;args=[];finish(c,a);}
    return;
   }
   if(b<=0x0f){if(mode===2)col=(col&0xf0)|b;}
   else if(b<=0x1f){if(mode===2)col=((b&0x0f)<<4)|(col&0x0f);}
   else if(b>=0xb0&&b<=0xb7){if(mode===2)page=b&7;}
   else if(b>=0x40&&b<=0x7f)start=b&63;
   else if(b===0xa0)segRemap=false;else if(b===0xa1)segRemap=true;
   else if(b===0xa4)entireOn=false;else if(b===0xa5)entireOn=true;
   else if(b===0xa6)inverse=false;else if(b===0xa7)inverse=true;
   else if(b===0xae)on=false;else if(b===0xaf)on=true;
   else if(b===0xc0)comRev=false;else if(b===0xc8)comRev=true;
   else if(argCount(b)>0){cmd=b;args=[];return;}
   version++;
  };
  /** Compose the visible frame from GDDRAM and the display settings (page-packed, hex). */
  const compose=():string=>{
   const out=new Uint8Array(W*PAGES);
   if(on){
    for(let r=0;r<64;r++){
     // the module glass is mounted rotated 180 degrees: the usual init (A1 + C8) is what makes data appear upright
     const com=comRev?r:63-r;
     const ramRow=((com-offset+start)%64+64)%64;
     const sp=ramRow>>3,sb=ramRow&7;
     for(let x=0;x<W;x++){
      const sx=segRemap?x:W-1-x;
      let v=entireOn?1:(ram[sp*W+sx]!>>sb)&1;
      if(inverse)v^=1;
      if(v)out[(r>>3)*W+x]!|=1<<(r&7);
     }
    }
   }
   let s='';
   for(const b of out)s+=HEX[b>>4]!+HEX[b&15]!;
   return s;
  };
  return {
   state:()=>{
    if(cacheV!==version){cache=compose();cacheV=version;}
    return {fb:cache,on,contrast,writes,cmds,color:ctx.props.color==='blue'?'blue':'white'};
   },
   i2c:{
    address:0x3c,
    onStart(){ctrl=true;pendingData=false;cmd=-1;args=[];},
    onWrite(byte){
     if(pendingData){pendingData=false;ctrl=true;if(dataMode)data(byte);else command(byte);return true;}
     if(ctrl){
      // control byte: bit7 Co, bit6 D/C#
      dataMode=(byte&0x40)!==0;
      if(byte&0x80)pendingData=true;else ctrl=false;
      return true;
     }
     if(dataMode)data(byte);else command(byte);
     return true;
    },
    onRead(){return on?0x00:0x40;}, // status register: bit6 = display off
    onStop(){ctrl=true;pendingData=false;},
   },
  };
 },
});
