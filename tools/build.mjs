import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURRENT_CATALOG } from '../src/data/current.mjs';
import { validateCatalog } from '../src/catalog.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src=path.join(root,'src'),out=path.join(root,'dist');
await mkdir(out,{recursive:true});
validateCatalog(CURRENT_CATALOG);
const modules=['engine.mjs','catalog.mjs','data/current.mjs','data/races.mjs','data/results.mjs','track.mjs','app.mjs'];
let script='';
for(const filename of modules) {
  const content=await readFile(path.join(src,filename),'utf8');
  script+='\n'+content.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
}
// A single self-contained HTML works on GitHub Pages subpaths and file://.
let html=await readFile(path.join(src,'index.html'),'utf8');
const css=await readFile(path.join(src,'style.css'),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+css+'</style>');
html=html.replace('<script type="module" src="app.mjs"></script>',()=>'<script type="module">'+script.replaceAll('</script','<\\/script')+'</script>');
await writeFile(path.join(out,'index.html'),html);
await writeFile(path.join(out,'.nojekyll'),'');
await mkdir(path.join(out,'data'),{recursive:true});
await writeFile(path.join(out,'data/current.json'),JSON.stringify(CURRENT_CATALOG,null,2));
await copyFile(path.join(root,'README.md'),path.join(out,'README.md'));
console.log('Built dist/index.html and dist/data/current.json (zero dependencies).');
