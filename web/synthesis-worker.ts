import { computeSynthesis } from './synthesis-compute.js';
import type { SynthesisRequest,SynthesisReply } from './synthesis-state.js';
self.onmessage=(event:MessageEvent<SynthesisRequest>):void=>{
  const request=event.data;
  try{
    for(const method of request.methods)self.postMessage({token:request.token,method,result:computeSynthesis(request.draft,method)} satisfies SynthesisReply);
  }catch(error){self.postMessage({token:request.token,error:String(error)} satisfies SynthesisReply);}
};
