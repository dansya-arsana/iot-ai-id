/** Goals and readouts of every lesson, collected from the lesson modules (lessons/<id>.ts: `check` and `readouts`). */
import {LESSON_MODULES} from './lessons/index';
import type {GoalFn,ReadoutFn} from './lessons/index';
import type {LessonId} from './contract';

export type {GoalMemory} from './lessons/index';
export {oledLitPixels} from './lessons/kit';

export const GOALS:Record<LessonId,GoalFn>={};
export const READOUTS:Record<LessonId,ReadoutFn>={};
for(const m of LESSON_MODULES){GOALS[m.id]=m.check;READOUTS[m.id]=m.readouts??(()=>[]);}
