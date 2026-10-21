import {useLang} from '../../i18n';
import {LESSONS} from '../lessons';
import type {LessonId} from '../contract';

export function Progress({done,active,popped}:{done:LessonId[];active:LessonId;popped:LessonId|null}){
 const {tr}=useLang();
 const total=LESSONS.length;
 return (
  <div className="lab-progress" data-testid="lab-progress" data-count={done.length} role="progressbar" aria-label={tr('Lesson progress','Progres pelajaran')} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done.length}>
   <span className="lab-ticks" aria-hidden="true">
    {LESSONS.map(l=><i key={l.id} data-done={done.includes(l.id)} data-current={l.id===active} data-pop={popped===l.id}/>)}
   </span>
   <span className="lab-progress-n">{done.length}/{total}</span>
  </div>
 );
}
