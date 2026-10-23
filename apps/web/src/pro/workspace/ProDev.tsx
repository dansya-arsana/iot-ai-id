/** Staff dev page for /pro/dev: the farm fixture, no API. */
import {useEffect} from 'react';
import {Workspace} from './Workspace';
import {loadDevFixture} from './dev-fixture';

export function ProDev(){
 useEffect(()=>{loadDevFixture();},[]);
 return <Workspace/>;
}
export default ProDev;
