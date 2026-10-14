import {readFileSync} from 'node:fs';
import {bridge} from './project-fixtures.mjs';
import {synthesizeRc,synthesizeRcFoster} from '../../dist/index.js';
export const fixture=name=>JSON.parse(readFileSync(new URL(`../../fixtures/${name}.json`,import.meta.url),'utf8'));
export function parallel(rc=false) {
  return {circuit:{schemaVersion:1,nodes:rc?['0','port','middle']:['0','port'],components:rc?[
    {id:'R1',type:'R',p:'port',n:'0',value:1000},
    {id:'R2',type:'R',p:'port',n:'middle',value:2000},
    {id:'C',type:'C',p:'middle',n:'0',value:1e-6}
  ]:[{id:'R1',type:'R',p:'port',n:'0',value:1000},{id:'R2',type:'R',p:'0',n:'port',value:2000}],
  observations:[{id:'voltage',type:'voltage',p:'port',n:'0'}]},experiment:{schemaVersion:1,sources:[],initial:{kind:'equilibrium'}}};
}
export function synthesis() {
  const scales={referenceResistanceOhm:'1000',referenceAngularFrequencyPerSecond:'1000'};
  return [synthesizeRc({...scales,quantity:'impedance',method:'cauer-infinity',numerator:['3','4','1'],denominator:['0','2','1']}),
    synthesizeRcFoster({...scales,quantity:'impedance',method:'foster-I',decomposition:{rInfinity:'1',kZero:'3/2',terms:[{pole:'2',residue:'1/2'}]}}),
    synthesizeRcFoster({...scales,quantity:'admittance',method:'foster-II',decomposition:{gZero:'0',cInfinity:'0',terms:[{pole:'1',coefficient:'1/2'},{pole:'3',coefficient:'1/2'}]}})]
    .map(r=>r.native.document);
}
export function examples() {
  const rl=fixture('rc');rl.circuit.components.find(c=>c.type==='C').type='L';rl.circuit.components.find(c=>c.type==='L').value=1;
  const list=[['divider',fixture('divider'),'chain'],['rc-low',fixture('rc'),'chain'],['rc-high',fixture('rc-high-pass'),'chain'],
    ['rl',rl,'chain'],['rlc',fixture('rlc'),'chain'],['parallel-r',parallel(),'parallel'],['parallel-rc',parallel(true),'foster-II'],
    ['bridge-balanced',bridge().document,'bridge'],['bridge-unbalanced',bridge(2000).document,'bridge']];
  synthesis().forEach((d,i)=>list.push([['cauer','foster-I','foster-II'][i],d,['cauer','foster-I','foster-II'][i]]));
  return list.map(([name,document,family])=>({name,document,family,options:document.experiment.sources.length?{}:{port:['port','0']}}));
}
