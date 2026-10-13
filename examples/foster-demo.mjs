import { synthesizeRc, synthesizeRcFoster } from '../dist/index.js';
const scales={referenceResistanceOhm:'1000',referenceAngularFrequencyPerSecond:'1000'};
const F={numerator:['3','4','1'],denominator:['0','2','1']};
const G={numerator:['0','2','1'],denominator:['3','4','1']};
const results=[
 ['Cauer',synthesizeRc({...scales,method:'cauer-infinity',quantity:'impedance',...F})],
 ['Foster I',synthesizeRcFoster({...scales,method:'foster-I',quantity:'impedance',target:F,
   decomposition:{rInfinity:'1',kZero:'3/2',terms:[{pole:'2',residue:'1/2'}]}})],
 ['Foster II',synthesizeRcFoster({...scales,method:'foster-II',quantity:'admittance',target:G,
   decomposition:{gZero:'0',cInfinity:'0',terms:[{pole:'1',coefficient:'1/2'},{pole:'3',coefficient:'1/2'}]}})],
];
console.log('Prescribed F(z)=(z²+4z+3)/(z²+2z), z=s/1000; Z=1000 F ohm.');
for(const [name,result] of results){
 console.log(name, result.mathematical.status, result.native.status, result.verification.status);
 if(result.mathematical.status!=='certified' || result.native.status!=='generated' || result.verification.status!=='passed')
   throw new Error(JSON.stringify(result));
 console.log('Exact reconstruction:',result.mathematical.reconstructed);
 console.log('Exact stages/sections:',result.mathematical.sections ?? result.mathematical.elements);
 console.table(result.native.elements);
 console.table(result.native.document.circuit.components);
 const sample=result.verification.samples[2];
 console.log('Independent Z(i1000) [ohm]:',sample.impedanceOhm,'Y [S]:',sample.admittanceSiemens);
 console.log('RMS power checks:',sample.power,'all sample pairs:',result.verification.samples.length);
}
