// Curator workflow: validate a locally prepared data package before writing it.
// No remote scraping, credentials, or silent changes to the confirmation time.
import { readFile, writeFile } from 'node:fs/promises';
import { validateCatalog, compareCatalog } from '../src/catalog.mjs';
import { CURRENT_CATALOG } from '../src/data/current.mjs';

const filename=process.argv[2];
if(!filename)throw new Error('Usage: node tools/update-catalog.mjs path/to/checked-catalog.json');
const bytes=await readFile(filename);
if(bytes.length>200000)throw new Error('JSON must be 200KB or smaller');
const input=validateCatalog(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')));
const next=compareCatalog(CURRENT_CATALOG,input);
if(!next)throw new Error('No update: use a newer checkedAt after verifying the sources');
await writeFile(new URL('../src/data/current.mjs',import.meta.url),'// Source-checked catalog. See docs/UPDATING.md.\nexport const CURRENT_CATALOG = '+JSON.stringify(next,null,2)+';\n');
console.log(`Validated and saved ${next.races.length} race(s), checkedAt ${next.checkedAt}. Run tests and build before publishing.`);
