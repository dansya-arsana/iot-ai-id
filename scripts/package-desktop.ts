import {cp,mkdir,readFile,writeFile,rm,chmod,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build, Platform} from 'electron-builder';
import {packager} from '@electron/packager';
const root=resolve('.'),output=join(root,'dist/desktop'),stage=join(output,'.stage');
if(!['darwin','win32'].includes(process.platform))throw new Error('Build on native macOS or Windows');
if(process.platform==='win32'&&process.arch!=='x64')throw new Error('Windows release supports x64 only');
await rm(stage,{recursive:true,force:true});await mkdir(stage,{recursive:true});
const shell=join(stage,'shell'),runtime=join(stage,'runtime'),bin=join(stage,'bin');
await mkdir(shell);await mkdir(runtime);await mkdir(bin);
await cp(join(root,'apps/desktop'),shell,{recursive:true});
const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
await writeFile(join(shell,'package.json'),JSON.stringify({name:'iot-ai-id-desktop',version:manifest.version,productName:'IOT AI ID',main:'main.cjs'},null,2));
for(const folder of ['services','packages','runtime'])await cp(join(root,folder),join(runtime,folder),{recursive:true});
await cp(join(root,'dist/web'),join(runtime,'dist/web'),{recursive:true});
await writeFile(join(runtime,'package.json'),JSON.stringify({name:'iot-ai-id-runtime',version:manifest.version,private:true,type:'module',dependencies:{...manifest.dependencies,tsx:manifest.devDependencies.tsx}},null,2));
execFileSync(process.platform==='win32'?'npm.cmd':'npm',['install','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],{cwd:runtime,stdio:'inherit',shell:process.platform==='win32'});
// Source-only allowlist: no home configuration, credentials, databases or build history.
await mkdir(join(runtime,'docs/licenses'),{recursive:true});
for(const file of ['THIRD_PARTY_NOTICES.md','docs/licenses/arduino-mcp-server-MIT.txt','docs/licenses/node-v24.13.1-LICENSE.txt','docs/licenses/arduino-cli-1.5.1-LICENSE.txt'])await cp(join(root,file),join(runtime,file));
async function copyStandalone(source:string,name:string){const actual=await realpath(source);const linked=execFileSync('otool',['-L',actual],{encoding:'utf8'}).split('\n').filter(line=>/^\s+\//.test(line)).map(line=>line.trim().split(' ')[0]).filter(Boolean);if(linked.some(path=>!path.startsWith('/usr/lib/')&&!path.startsWith('/System/Library/')))throw new Error(`${name} has non-system dylibs; cannot bundle safely`);await cp(actual,join(bin,name));await chmod(join(bin,name),0o755);}
if(process.platform==='darwin'){await copyStandalone(process.execPath,'node');
const arduino=process.env.ARDUINO_CLI_PATH??execFileSync('/usr/bin/which',['arduino-cli'],{encoding:'utf8'}).trim();
await copyStandalone(arduino,'arduino-cli');}else{
 async function verified(url:string,manifestUrl:string,file:string){const response=await fetch(url);if(!response.ok)throw new Error('Binary download HTTP '+response.status);const data=Buffer.from(await response.arrayBuffer());const sums=await fetch(manifestUrl);if(!sums.ok)throw new Error('Checksum manifest unavailable');const line=(await sums.text()).split('\n').find(line=>line.trim().split(/\s+/).at(-1)?.replace(/^\*/, '')===file);if(!line||createHash('sha256').update(data).digest('hex')!==line.trim().split(/\s+/)[0])throw new Error('Binary integrity mismatch: '+file);return data;}
 await writeFile(join(bin,'node.exe'),await verified('https://nodejs.org/dist/v24.13.1/win-x64/node.exe','https://nodejs.org/dist/v24.13.1/SHASUMS256.txt','win-x64/node.exe'));
 const archive='arduino-cli_1.5.1_Windows_64bit.zip',base='https://github.com/arduino/arduino-cli/releases/download/v1.5.1/';
 const zip=join(stage,archive);await writeFile(zip,await verified(base+archive,base+'1.5.1-checksums.txt',archive));
 execFileSync('tar',['-xf',zip,'-C',bin],{stdio:'inherit'});
}
if(execFileSync(join(bin,process.platform==='win32'?'node.exe':'node'),['--version'],{encoding:'utf8'}).trim()!=='v24.13.1'||!execFileSync(join(bin,process.platform==='win32'?'arduino-cli.exe':'arduino-cli'),['version'],{encoding:'utf8'}).includes('Version: 1.5.1'))throw new Error('Bundled binary versions differ from checked-in license notices; update notices before packaging');
await writeFile(join(runtime,'docs/licenses/bundled-binaries.txt'),'Node.js v24.13.1: https://github.com/nodejs/node/tree/v24.13.1\nLicense: node-v24.13.1-LICENSE.txt\nArduino CLI 1.5.1: https://github.com/arduino/arduino-cli/tree/v1.5.1\nLicense: arduino-cli-1.5.1-LICENSE.txt\nElectron 44.6.0: https://github.com/electron/electron/tree/v44.6.0\nElectron and Chromium notices are included in the application bundle.\n');
const paths=await packager({dir:shell,out:output,name:'IOT AI ID',appBundleId:'id.iot.ai.desktop',appVersion:manifest.version,platform:process.platform as 'darwin'|'win32',arch:process.arch as 'arm64'|'x64',electronVersion:'44.6.0',asar:false,overwrite:true,prune:true,extraResource:[runtime,bin]});
await build({prepackaged:paths[0],targets:process.platform==='darwin'?Platform.MAC.createTarget('dmg'):Platform.WINDOWS.createTarget('nsis'),config:{appId:'id.iot.ai.desktop',productName:'IOT AI ID',artifactName:'IOT-AI-ID-${version}-${os}-${arch}.${ext}',directories:{output:join(output,'installers')},mac:{identity:null,category:'public.app-category.developer-tools'},win:{signAndEditExecutable:false},nsis:{oneClick:false,perMachine:false,allowToChangeInstallationDirectory:true},publish:null}});
await rm(stage,{recursive:true,force:true});
console.log('Desktop app: '+join(paths[0],'IOT AI ID.app'));
