import {cp,mkdir,readFile,writeFile,rm,chmod,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {packager} from '@electron/packager';
const root=resolve('.'),output=join(root,'dist/desktop'),stage=join(output,'.stage');
if(process.platform!=='darwin')throw new Error('Desktop packaging currently supports macOS only');
await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});
const shell=join(stage,'shell'),runtime=join(stage,'runtime'),bin=join(stage,'bin');
await mkdir(shell);await mkdir(runtime);await mkdir(bin);
await cp(join(root,'apps/desktop'),shell,{recursive:true});
const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
await writeFile(join(shell,'package.json'),JSON.stringify({name:'iot-ai-id-desktop',version:manifest.version,productName:'IOT AI ID',main:'main.cjs'},null,2));
for(const folder of ['services','packages','runtime'])await cp(join(root,folder),join(runtime,folder),{recursive:true});
await cp(join(root,'dist/web'),join(runtime,'dist/web'),{recursive:true});
await writeFile(join(runtime,'package.json'),JSON.stringify({name:'iot-ai-id-runtime',version:manifest.version,private:true,type:'module',dependencies:{...manifest.dependencies,tsx:manifest.devDependencies.tsx}},null,2));
execFileSync('npm',['install','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],{cwd:runtime,stdio:'inherit'});
// Source-only allowlist: no home configuration, credentials, databases or build history.
await mkdir(join(runtime,'docs/licenses'),{recursive:true});
for(const file of ['THIRD_PARTY_NOTICES.md','docs/licenses/arduino-mcp-server-MIT.txt','docs/licenses/node-v24.13.1-LICENSE.txt','docs/licenses/arduino-cli-1.5.1-LICENSE.txt'])await cp(join(root,file),join(runtime,file));
async function copyStandalone(source:string,name:string){const actual=await realpath(source);const linked=execFileSync('otool',['-L',actual],{encoding:'utf8'}).split('\n').filter(line=>/^\s+\//.test(line)).map(line=>line.trim().split(' ')[0]).filter(Boolean);if(linked.some(path=>!path.startsWith('/usr/lib/')&&!path.startsWith('/System/Library/')))throw new Error(`${name} has non-system dylibs; cannot bundle safely`);await cp(actual,join(bin,name));await chmod(join(bin,name),0o755);}
await copyStandalone(process.execPath,'node');
const arduino=process.env.ARDUINO_CLI_PATH??execFileSync('/usr/bin/which',['arduino-cli'],{encoding:'utf8'}).trim();
await copyStandalone(arduino,'arduino-cli');
if(execFileSync(join(bin,'node'),['--version'],{encoding:'utf8'}).trim()!=='v24.13.1'||!execFileSync(join(bin,'arduino-cli'),['version'],{encoding:'utf8'}).includes('Version: 1.5.1'))throw new Error('Bundled binary versions differ from checked-in license notices; update notices before packaging');
await writeFile(join(runtime,'docs/licenses/bundled-binaries.txt'),'Node.js v24.13.1: https://github.com/nodejs/node/tree/v24.13.1\nLicense: node-v24.13.1-LICENSE.txt\nArduino CLI 1.5.1: https://github.com/arduino/arduino-cli/tree/v1.5.1\nLicense: arduino-cli-1.5.1-LICENSE.txt\nElectron 44.6.0: https://github.com/electron/electron/tree/v44.6.0\nElectron and Chromium notices are included in the application bundle.\n');
const paths=await packager({dir:shell,out:output,name:'IOT AI ID',appBundleId:'id.iot.ai.desktop',appVersion:manifest.version,platform:'darwin',arch:process.arch as 'arm64'|'x64',electronVersion:'44.6.0',asar:false,overwrite:true,prune:true,extraResource:[runtime,bin]});
await rm(stage,{recursive:true,force:true});
console.log('Desktop app: '+join(paths[0],'IOT AI ID.app'));
