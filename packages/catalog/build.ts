/** Run the four importers and merge. Pure given the old packages; scripts/catalog-import.ts writes the result to data/catalog.json. */
import {importHardwareLibrary} from './import/hardware-library.js';
import {importComponentCatalog} from './import/component-catalog.js';
import {importHardwareContract} from './import/hardware-contract.js';
import {importLabRegistry} from './import/lab-registry.js';
import {mergeFragments} from './merge.js';
import {CATALOG_SCHEMA_VERSION} from './schema.js';
import type {CatalogFile} from './index.js';
export const CATALOG_VERSION='import-2026-10-23';
export function buildCatalog():CatalogFile{
 const m=mergeFragments([...importHardwareLibrary(),...importComponentCatalog(),...importHardwareContract(),...importLabRegistry()]);
 return{catalogVersion:CATALOG_VERSION,schemaVersion:CATALOG_SCHEMA_VERSION,...m};
}
export const serializeCatalog=(c:CatalogFile):string=>JSON.stringify(c,null,1)+'\n';
