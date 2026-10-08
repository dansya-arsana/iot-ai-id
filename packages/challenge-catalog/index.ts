import {z} from 'zod';

/** Deterministic challenge manifests. Electrical truth stays in manifests and the validator; the DB stores attempts (projects/experiments), not challenge definitions. */
export const ChallengeScenarioSchema=z.object({name:z.string().min(3),given:z.string().min(3),expect:z.string().min(3)}).strict();
/** Declarative judging: the system, not a person, decides each scenario from stored evidence. */
export const JudgeRuleSchema=z.object({type:z.enum(['latest-check','any-fail','recovery']),check:z.string().min(3)}).strict();
export const ChallengeSchema=z.object({
 id:z.string().regex(/^[a-z0-9-]{3,64}$/),
 version:z.number().int().positive(),
 title:z.string().min(3).max(120),
 goal:z.string().min(20).max(2000),
 summary:z.string().min(10).max(600),
 componentIds:z.array(z.string()).min(1).max(8),
 support:z.enum(['golden','draft']),
 scenario:z.array(z.object({...ChallengeScenarioSchema.shape,judge:JudgeRuleSchema.optional()}).strict()).min(1).max(12),
 verification:z.object({checks:z.array(z.string()).min(1).max(8)}).strict(),
}).strict().superRefine((value,ctx)=>{if(value.support==='golden'&&!value.scenario.every(s=>s.judge))ctx.addIssue({code:'custom',message:'Golden challenges require a judge rule on every scenario'});});
export type Challenge=z.infer<typeof ChallengeSchema>;
export type JudgeRule=z.infer<typeof JudgeRuleSchema>;

export const challenges:Challenge[]=[
 {id:'room-monitor',version:1,title:'Room monitor recovery',support:'golden',
  goal:'Build an ESP32 room monitor with temperature/humidity and an OLED.',
  summary:'ESP32 DevKit + BME280 + SSD1306 over shared I2C. Verify addresses, readings and display init, survive a deliberate SDA failure and prove recovery.',
  componentIds:['bme280','ssd1306'],
  scenario:[
   {name:'bus present',given:'Contract wiring connected, power on',expect:'I2C scan finds 0x76 and 0x3C',judge:{type:'latest-check',check:'device_addresses'}},
   {name:'readings in range',given:'BME280 answering',expect:'Temperature within -40..85 C and humidity within 0..100%',judge:{type:'latest-check',check:'sensor_readings'}},
   {name:'display acknowledged',given:'SSD1306 answering',expect:'oled_initialized true with address ACK',judge:{type:'latest-check',check:'oled_initialized'}},
   {name:'sda failure detected',given:'Shared SDA disconnected with power off',expect:'device_addresses fails with no devices and verification FAILED',judge:{type:'any-fail',check:'device_addresses'}},
   {name:'recovery',given:'SDA restored with power off, retest',expect:'Fresh experiment passes all named checks with a new nonce',judge:{type:'recovery',check:'device_addresses'}}],
  verification:{checks:['board_detected','compiled','flashed','device_addresses','sensor_readings','oled_initialized']}},
 {id:'button-led',version:1,title:'Button LED behavior',support:'golden',
  goal:'Build an ESP32 button and LED: pressing the button lights the indicator.',
  summary:'ESP32 DevKit + button assembly (10k pull-up, GPIO27) + LED assembly (330Ω series, GPIO26). Prove debounced input, commanded output and a completed press/release behavior sequence.',
  componentIds:['button-pullup-10k','led-series-330'],
  scenario:[
   {name:'input observed',given:'Wired assemblies, power on, button idle',expect:'button_input reports raw and stable state with cycle counters',judge:{type:'latest-check',check:'button_input'}},
   {name:'output follows input',given:'Button pressed during a run',expect:'output_commanded level HIGH while pressed and LOW when released',judge:{type:'latest-check',check:'output_commanded'}},
   {name:'behavior sequence completes',given:'At least one clean press and release during the run',expect:'behavior_sequence complete with presses equal to releases',judge:{type:'latest-check',check:'behavior_sequence'}},
   {name:'open signal detected',given:'Button SIGNAL wire disconnected with power off',expect:'button_input fails and verification FAILED',judge:{type:'any-fail',check:'button_input'}},
   {name:'recovery',given:'SIGNAL restored with power off, button pressed and released again',expect:'Fresh experiment passes every named check',judge:{type:'recovery',check:'behavior_sequence'}}],
  verification:{checks:['board_detected','compiled','flashed','button_input','output_commanded','behavior_sequence']}},
 {id:'threshold-alert',version:1,title:'Threshold alert light',support:'draft',
  goal:'Build an ESP32 environmental monitor that turns a warning LED on when temperature crosses 30C.',
  summary:'BME280 plus LED indicator. Requires component selection and firmware behavior outside the golden recipe; listed as a draft until a validated recipe exists.',
  componentIds:['bme280','led'],
  scenario:[
   {name:'below threshold',given:'Temperature below 30C',expect:'LED off'},
   {name:'above threshold',given:'Temperature above 30C',expect:'LED on'}],
  verification:{checks:['board_detected','compiled','flashed','device_addresses','sensor_readings','led_state']}},
 {id:'presence-button',version:1,title:'Presence counter button',support:'draft',
  goal:'Build an ESP32 counter that increments an OLED readout each time a button is pressed.',
  summary:'Button plus OLED. Debounce and edge counting need a recipe revision; draft only.',
  componentIds:['button','ssd1306'],
  scenario:[
   {name:'idle',given:'No press',expect:'Counter unchanged on display'},
   {name:'press',given:'One clean press',expect:'Counter increments by exactly one'}],
  verification:{checks:['board_detected','compiled','flashed','device_addresses','oled_initialized','button_events']}},
];

export function getChallenge(id:string,version?:number):Challenge{
 const found=challenges.find(c=>c.id===id&&(version===undefined||c.version===version));
 if(!found)throw new Error(`Unknown challenge ${id}${version!==undefined?' v'+version:''}; pick from GET /api/challenges`);
 return found;
}
export function challengeReference(value:{challengeId?:unknown;challengeVersion?:unknown}){
 if((value.challengeId===undefined)!==(value.challengeVersion===undefined))throw new Error('challengeId and challengeVersion must be provided together');
 if(value.challengeId===undefined)return undefined;
 const id=ChallengeSchema.shape.id.parse(value.challengeId),version=ChallengeSchema.shape.version.parse(value.challengeVersion);
 return getChallenge(id,version);
}
export const publicChallenges=()=>challenges.map(c=>({id:c.id,version:c.version,title:c.title,summary:c.summary,goal:c.goal,componentIds:c.componentIds,support:c.support,scenario:c.scenario,verification:c.verification}));

export interface ScenarioVerdict{name:string;given:string;expect:string;status:'pass'|'fail'|'pending';evidence:string}
/** Judges a challenge purely from stored project state (experiments + observations on the current contract). Draft challenges stay pending: no executable recipe exists to judge. */
export function judgeChallenge(challenge:Challenge,project:{contractId:string|null;experiments:{id:string;contractId:string;status:string;createdAt:string;mode?:string;fault?:string;parentId?:string|null;identity?:{nonce:string}}[];observations:{evidence:{experimentId:string;check:string;passed:boolean;data?:Record<string,unknown>}}[];verifications?:{experimentId:string;status:string;passed:boolean}[];events?:{type:string;payload?:Record<string,unknown>}[];humanActions?:{experimentId?:string;actionType:string;description:string}[]}){
 const pending=(reason:string):ScenarioVerdict[]=>challenge.scenario.map(s=>({name:s.name,given:s.given,expect:s.expect,status:'pending',evidence:reason}));
 if(challenge.support!=='golden')return pending('Draft challenge: no validated executable recipe yet');
 if(!project.contractId)return pending('No validated contract yet');
 const experiments=project.experiments.filter(e=>e.contractId===project.contractId);
 if(!experiments.length)return pending('No experiments on the current contract yet');
 const checksOf=(experimentId:string)=>{const map=new Map<string,boolean>();for(const o of project.observations){if(o.evidence.experimentId===experimentId)map.set(o.evidence.check,o.evidence.passed);}return map;};
 const allPass=(experimentId:string)=>challenge.verification.checks.every(check=>checksOf(experimentId).get(check)===true);
 const intentionalFailure=(e:typeof experiments[number],check:string)=>e.status==='FAILED'&&checksOf(e.id).get(check)===false
  &&project.observations.some(o=>o.evidence.experimentId===e.id&&o.evidence.check===check&&Array.isArray(o.evidence.data?.addresses)&&o.evidence.data.addresses.length===0)
  &&(e.mode==='simulation'&&e.fault==='sda'||e.mode==='physical'&&(project.humanActions??[]).some(a=>a.experimentId===e.id&&a.actionType==='reported_edit'&&/sda/i.test(a.description)&&/disconnect|lepas|putus/i.test(a.description)))
  &&(project.verifications??[]).some(v=>v.experimentId===e.id&&v.status==='FAILED'&&!v.passed);
 const firstFailOf=(check:string)=>experiments.find(e=>intentionalFailure(e,check));
 const latest=experiments.at(-1)!;
 const verdicts:ScenarioVerdict[]=[];
 for(const s of challenge.scenario){
  const rule=s.judge; if(!rule){verdicts.push({name:s.name,given:s.given,expect:s.expect,status:'pending',evidence:'No judge rule'});continue;}
  if(rule.type==='latest-check'){
   const observed=checksOf(latest.id).get(rule.check);
   verdicts.push({name:s.name,given:s.given,expect:s.expect,status:observed===undefined?'pending':observed?'pass':'fail',evidence:observed===undefined?`Check ${rule.check} not observed in the newest experiment`:`Newest experiment ${latest.id.slice(0,8)}: ${rule.check} ${observed?'passed':'failed'}`});
  }else if(rule.type==='any-fail'){
   const failed=firstFailOf(rule.check);
   verdicts.push({name:s.name,given:s.given,expect:s.expect,status:failed?'pass':'pending',evidence:failed?`Experiment ${failed.id.slice(0,8)} observed ${rule.check} failing`:'Deliberate failure not observed yet'});
  }else{
   const failure=firstFailOf(rule.check);
   const recovered=failure?experiments.find(e=>e.parentId===failure.id&&e.mode===failure.mode&&e.identity?.nonce&&failure.identity?.nonce&&e.identity.nonce!==failure.identity.nonce&&new Date(e.createdAt)>new Date(failure.createdAt)&&allPass(e.id)
    &&['VERIFIED','SIMULATED_VERIFIED'].includes(e.status)&&(project.verifications??[]).some(v=>v.experimentId===e.id&&v.status===e.status&&v.passed)
    &&(project.events??[]).some(event=>event.type==='repair.confirmed'&&event.payload?.parentId===failure.id&&event.payload?.mode===e.mode)):undefined;
   verdicts.push({name:s.name,given:s.given,expect:s.expect,status:recovered?'pass':'pending',evidence:recovered?`Experiment ${recovered.id.slice(0,8)} passed every named check after the observed failure`:'No full recovery experiment after an observed failure yet'});
  }
 }
 return verdicts;
}
