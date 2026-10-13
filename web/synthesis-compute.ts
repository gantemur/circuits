// This adapter is used only by the worker (and headless regression tests).
import { ExactBudget, ExactInputError, ExactResourceError, parseExact } from '../src/exact-rational.js';
import { synthesizeRc } from '../src/rc-synthesis.js';
import { synthesizeRcFoster } from '../src/foster-synthesis.js';
import type { SynthesisDraft,SynthesisMethod,SynthesisResult } from './synthesis-state.js';
export function computeSynthesis(d:SynthesisDraft,method:SynthesisMethod):SynthesisResult {
  const numerator=d.numerator.split(',').map(s=>s.trim());
  const denominator=d.denominator.split(',').map(s=>s.trim());
  const primary={quantity:d.quantity,method:'cauer-infinity',numerator,denominator,
    referenceResistanceOhm:d.resistance.trim(),referenceAngularFrequencyPerSecond:d.frequency.trim()};
  if(method==='cauer-infinity')return synthesizeRc(primary);
  try{
    // Use the accepted exact parser only to recognize zero before inversion.
    // Reject an invalid primary denominator before exchanging the polynomials.
    // Otherwise 1/0 could masquerade as the valid reciprocal zero boundary.
    const budget=new ExactBudget();
    if(Math.max(numerator.length,denominator.length)>budget.limits.rawDegree+1)throw new ExactResourceError('browser target','input degree');
    if(denominator.map(s=>parseExact(s,budget)).every(q=>q.n===0n))throw new ExactInputError('Zero denominator polynomial');
    if(numerator.map(s=>parseExact(s,budget)).every(q=>q.n===0n))return synthesizeRc(primary);
    const first=method==='foster-I';
    const same=(first&&d.quantity==='impedance')||(!first&&d.quantity==='admittance');
    const target=same?{numerator,denominator}:{numerator:denominator,denominator:numerator};
    const enabled=first?d.fosterI:d.fosterII;
    const text=first?d.termsI:d.termsII;
    const terms=enabled&&text.trim()?text.split('\n').filter(line=>line.trim()).map(line=>{
      const pair=line.split(',').map(s=>s.trim());
      if(pair.length!==2)throw new ExactInputError('Each finite term needs exactly two comma-separated rational strings');
      return first?{pole:pair[0],residue:pair[1]}:{pole:pair[0],coefficient:pair[1]};
    }):[];
    const decomposition=first?{rInfinity:d.rInfinity.trim(),kZero:d.kZero.trim(),terms}:{gZero:d.gZero.trim(),cInfinity:d.cInfinity.trim(),terms};
    return synthesizeRcFoster({method,quantity:first?'impedance':'admittance',target,
      referenceResistanceOhm:primary.referenceResistanceOhm,referenceAngularFrequencyPerSecond:primary.referenceAngularFrequencyPerSecond,
      ...(enabled?{decomposition}:{})});
  }catch(error){
    if(!(error instanceof ExactInputError)&&!(error instanceof ExactResourceError))throw error;
    return {mathematical:{status:error instanceof ExactResourceError?'resource-limit':'invalid-input',stage:'browser input',reason:String(error)},
    native:{status:'unavailable',reason:'No accepted mathematical result'},verification:{status:'unresolved',reason:'No native realization',samples:[]}};}
}
