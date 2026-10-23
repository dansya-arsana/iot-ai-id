/** Rebuild packages/catalog/data/catalog.json from the four old sources. `--check` exits 1 when the committed file is stale. */
import {readFileSync,writeFileSync} from 'node:fs';
import {CATALOG_DATA_URL} from '../packages/catalog/index.js';
import {buildCatalog,serializeCatalog} from '../packages/catalog/build.js';

const next=serializeCatalog(buildCatalog());
if(process.argv.includes('--check')){
 let cur='';try{cur=readFileSync(CATALOG_DATA_URL,'utf8');}catch{/* missing */}
 if(cur!==next){console.error('catalog data is stale: run `npx tsx scripts/catalog-import.ts`');process.exit(1);}
 console.log('catalog data is current');
}else{
 writeFileSync(CATALOG_DATA_URL,next);
 console.log(`wrote ${next.length} bytes`);
}
