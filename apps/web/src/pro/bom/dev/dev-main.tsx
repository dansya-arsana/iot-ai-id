/** Dev entry: farm fixture in the real workspace with the three tabs registered. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {LangProvider} from '../../../i18n';
import {ProDev} from '../../workspace/ProDev';
import {registerBomPowerChecksTabs} from '../register';
registerBomPowerChecksTabs();
createRoot(document.getElementById('root')!).render(<React.StrictMode><MemoryRouter><LangProvider><ProDev/></LangProvider></MemoryRouter></React.StrictMode>);
