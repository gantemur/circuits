// Development-only evidence, using the unchanged editor renderer and stylesheet.
// Run after build:app. No generated image or layout enters the application bundle.
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {generateTopologyLayout,importWiring,renderWiringSvg,fitWiring} from '../dist/layout-test.js';
import {examples} from '../test/support/layout-fixtures.mjs';
const directory=process.argv[2]??'/tmp/circuits-layout-evidence';
await mkdir(directory,{recursive:true});
const css=await readFile('web/style.css','utf8');
const selected=['divider','rc-low','bridge-unbalanced','cauer','foster-I','foster-II'];
const records=[];
for(const item of examples().filter(e=>selected.includes(e.name))){
  const result=generateTopologyLayout(item.document,item.options);
  if(result.status!=='generated')throw Error(item.name+': '+result.reason);
  const provisional=importWiring(item.document).graph;
  for(const [kind,graph]of[['generated',result.graph],['provisional',provisional]]){
    const svg=renderWiringSvg(graph,null,fitWiring(graph),null);
    const standalone=svg.replace('>',`><style>${css.slice(css.indexOf('#w-canvas {'),css.indexOf('#w-canvas .wire-pending')+css.slice(css.indexOf('#w-canvas .wire-pending')).indexOf('}')+1)}</style>`);
    await writeFile(`${directory}/${item.name}-${kind}.svg`,standalone);
    await writeFile(`${directory}/${item.name}-${kind}.html`,`<!doctype html><meta charset="utf-8"><title>${item.name} ${kind}</title><style>${css}</style><h1>${item.name} — ${kind}</h1>${svg}`);
  }
  await writeFile(`${directory}/${item.name}.cuf.json`,JSON.stringify(result.project,null,2)+'\n');
  records.push({example:item.name,family:result.witness.family,evidence:result.evidence});
}
await writeFile(`${directory}/evidence.json`,JSON.stringify(records,null,2)+'\n');
console.log(directory);
