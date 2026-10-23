/** Standalone dev entry (vite: /src/pro/workspace/dev.html) until the integrator mounts /pro/dev. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ProDev} from './ProDev';
createRoot(document.getElementById('root')!).render(<React.StrictMode><ProDev/></React.StrictMode>);
