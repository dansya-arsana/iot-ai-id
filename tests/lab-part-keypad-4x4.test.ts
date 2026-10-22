import test from 'node:test';
import assert from 'node:assert/strict';
import {fakeBoard,modelOf,frame,type Board} from './lab-input-fake.js';
import {MIN_TAP_MS,ghosts,groups,keyPos} from '../apps/web/src/lab/sim/devices/keypad-4x4.js';
import type {UnoPin} from '../apps/web/src/lab/contract.js';

const NET={R1:'D2',R2:'D3',R3:'D4',R4:'D5',C1:'D6',C2:'D7',C3:'D8',C4:'D9'} as const;
const ROWS:UnoPin[]=['D2','D3','D4','D5'],COLS:UnoPin[]=['D6','D7','D8','D9'];

/** Sketch-style scan: row r LOW (output), other rows HIGH, columns INPUT_PULLUP. Returns the columns that read LOW. */
function scan(b:Board,m:ReturnType<typeof modelOf>,r:number):number[]{
 ROWS.forEach((p,i)=>{b.mode[p]='output';b.out[p]=i===r?0:1;m.onEdge!(p,i===r?0:1,0);});
 COLS.forEach(p=>{b.mode[p]='input-pullup';});
 m.update(frame(0));
 return COLS.map((p,i)=>b.pinLevel(p)===0?i:-1).filter(i=>i>=0);
}

test('keypad: key layout and net groups',()=>{
 assert.deepEqual(keyPos('5'),{r:1,c:1});assert.deepEqual(keyPos('D'),{r:3,c:3});assert.deepEqual(keyPos('#'),{r:3,c:2});
 assert.equal(groups([]).length,8);
 assert.equal(groups(['5']).length,7);
 assert.deepEqual(ghosts(['1','2','4']),['5']);
 assert.deepEqual(ghosts(['1','2']),[]);
});

test('keypad: no key pressed, a row scan reads every column HIGH',()=>{
 const b=fakeBoard();const m=modelOf(b,'keypad-4x4',NET);
 for(let r=0;r<4;r++)assert.deepEqual(scan(b,m,r),[]);
});

test('keypad: pressing 5 pulls column 2 LOW only while row 2 is driven LOW',()=>{
 const b=fakeBoard();const m=modelOf(b,'keypad-4x4',NET);
 m.props.key='5';
 assert.deepEqual(scan(b,m,0),[]);
 assert.deepEqual(scan(b,m,1),[1]);
 assert.deepEqual(scan(b,m,2),[]);
 m.props.key='none';
 b.at(400*16000);   // past the shortest tap
 assert.deepEqual(scan(b,m,1),[],'release brings the column back HIGH');
});

test('keypad: a tap the page already put back stays down for MIN_TAP_MS of simulated time (a stalled browser frame cannot swallow it)',()=>{
 const b=fakeBoard();const m=modelOf(b,'keypad-4x4',NET);
 b.at(1000);
 m.props.key='5';
 assert.deepEqual(scan(b,m,1),[1]);
 m.props.key='none';                       // the 150 ms wall-clock timer fired before the simulation advanced
 assert.deepEqual(scan(b,m,1),[1],'still down: no simulated time has passed');
 b.at(1000+(MIN_TAP_MS-5)*16000);
 assert.deepEqual(scan(b,m,1),[1],'still down just before the minimum');
 b.at(1000+(MIN_TAP_MS+5)*16000);
 assert.deepEqual(scan(b,m,1),[],'released after the minimum');
 // the same key again is a new tap
 m.props.key='5';assert.deepEqual(scan(b,m,1),[1]);
});

test('keypad: every one of the 16 keys is found by a full scan at the right row and column',()=>{
 const b=fakeBoard();const m=modelOf(b,'keypad-4x4',NET);
 const all='123A456B789C*0#D'.split('');
 all.forEach((k,i)=>{
  m.props.key=k;
  const found:[number,number][]=[];
  for(let r=0;r<4;r++)for(const c of scan(b,m,r))found.push([r,c]);
  assert.deepEqual(found,[[Math.floor(i/4),i%4]],`key ${k}`);
  m.props.key='none';b.at((i+1)*400*16000);   // let the tap end before the next key
 });
});

test('keypad: scanning the other way (columns driven, rows read) works too',()=>{
 const b=fakeBoard();const m=modelOf(b,'keypad-4x4',NET,{key:'9'});   // row 3, column 3
 COLS.forEach((p,i)=>{b.mode[p]='output';b.out[p]=i===2?0:1;m.onEdge!(p,i===2?0:1,0);});
 ROWS.forEach(p=>{b.mode[p]='input-pullup';});
 m.update(frame(0));
 assert.deepEqual(ROWS.map(p=>b.pinLevel(p)),[1,1,0,1]);
});

test('keypad: three keys in an L make a ghost key (the real membrane has no diodes)',()=>{
 const b=fakeBoard();const m=modelOf(b,'keypad-4x4',NET,{key:'1',key2:'2',key3:'4'});
 assert.deepEqual(scan(b,m,1),[0,1],'row 2 LOW shows column 1 (key 4) and column 2 (ghost of 5)');
 const s=m.state();assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.pressed,'1,2,4');assert.equal(s.v.ghost,'5');assert.equal(s.v.count,3);}
});

test('keypad: state reports pressed keys and the lines that are LOW',()=>{
 const b=fakeBoard();const m=modelOf(b,'keypad-4x4',NET,{key:'A'});   // row 1, column 4
 scan(b,m,0);
 const s=m.state();
 if(s.kind==='ext'){assert.equal(s.v.pressed,'A');assert.equal(s.v.lowMask,(1<<0)|(1<<7));}
});
