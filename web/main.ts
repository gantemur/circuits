import { analyze, createLab, csvFor, dcBranchCurrents, dimensionless, exportNative, importNative,
  parseFinite, resetExample, updateDocument, validateSettings, type LabAnalysis, type Settings } from './lab.js';
import { presets } from './presets.js';
import { escapeHtml, schematic } from './schematic.js';
import { plot } from './plot.js';
import type { Component, SourceValue, Waveform } from '../src/model.js';

let state = createLab();
let analysis: LabAnalysis | null = null;
let notice = '';
let noticeIsError = false;
const byId = (id: string): HTMLElement => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing interface element ${id}`);
  return value;
};
const fmt = (value: number, digits = 5): string => {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return '0';
  return (Math.abs(value) < .001 || Math.abs(value) >= 1e5) ? value.toExponential(3) : Number(value.toPrecision(digits)).toString();
};
const sourceUnit = (id: string): 'V' | 'A' => state.document.circuit.components.find(c => c.id === id)?.type === 'I' ? 'A' : 'V';
const componentUnit = (c: Component) => c.type === 'R' ? 'Ω' : c.type === 'C' ? 'F' : c.type === 'L' ? 'H' : c.type === 'VCCS' ? 'S' : c.type === 'CCVS' ? 'Ω' : '';
function field(label:string,kind:string,id:string,value:string|number,unit='',positive=false):string {
  const key=`${kind}:${id}`;
  return `<div class="field"><label for="${escapeHtml(key)}">${escapeHtml(label)}${unit?` <span class="unit-note">(${escapeHtml(unit)})</span>`:''}</label><input id="${escapeHtml(key)}" data-kind="${escapeHtml(kind)}" data-id="${escapeHtml(id)}" data-positive="${positive?'1':'0'}" type="number" step="any" value="${escapeHtml(value)}"><small class="field-error" aria-live="polite"></small></div>`;
}
function selectField(label:string,kind:string,id:string,options:{value:string;label:string}[],selected:string):string {
  const key=`${kind}:${id}`;
  return `<div class="field"><label for="${escapeHtml(key)}">${escapeHtml(label)}</label><select id="${escapeHtml(key)}" data-kind="${escapeHtml(kind)}" data-id="${escapeHtml(id)}">${options.map(o=>`<option value="${escapeHtml(o.value)}"${o.value===selected?' selected':''}>${escapeHtml(o.label)}</option>`).join('')}</select><small class="field-error" aria-live="polite"></small></div>`;
}
function renderExamples():void {
  byId('example-list').innerHTML=`<div class="example-list">${presets.map(p=>`<button type="button" class="example-item${state.presetId===p.id?' active':''}" data-example="${p.id}" aria-current="${state.presetId===p.id?'true':'false'}"><span><span class="name">${escapeHtml(p.title)}</span><span class="detail">${escapeHtml(p.subtitle)}</span></span><span class="arrow" aria-hidden="true">↗</span></button>`).join('')}</div>`;
  byId('reset-example').textContent=state.presetId?'Reset example':'Load RC example';
}
function renderComponents():void {
  const c=state.document.circuit.components;
  byId('component-list').innerHTML=`<div class="component-list">${c.map(d=>`<button type="button" class="component-pill${state.selectedComponent===d.id?' active':''}" data-component="${escapeHtml(d.id)}" aria-pressed="${state.selectedComponent===d.id?'true':'false'}">${escapeHtml(d.id)} <span class="muted">${escapeHtml(d.type)}</span></button>`).join('')}</div>`;
  const selected=c.find(d=>d.id===state.selectedComponent);
  if(!selected){byId('component-editor').innerHTML='<div class="editor-card"><p class="muted small">Select a component here or in the diagram to inspect and edit it.</p></div>';return;}
  const p=analysis?.assembly.contributions.filter(x=>x.component===selected.id) ?? [];
  let param='';
  if('value' in selected)param=field('Value',`component`,selected.id,selected.value,componentUnit(selected),true);
  else if('gain' in selected)param=field('Gain',`component`,selected.id,selected.gain,componentUnit(selected));
  else param='<p class="muted small">Set this independent source in “Source & start” below.</p>';
  byId('component-editor').innerHTML=`<div class="editor-card"><p class="editor-title">${escapeHtml(selected.id)} · ${escapeHtml(selected.type)}</p><p class="terminal-note">Ordered terminals: p = ${escapeHtml(selected.p)}, n = ${escapeHtml(selected.n)}. Positive current: p → n.</p>${param}<div class="subheading">Kernel terminal law</div><div class="law-box">${p.length?escapeHtml([...new Set(p.map(x=>x.law))].join(' · ')):'No nonzero matrix contribution recorded for this component.'}</div><p class="muted small">${p.length} recorded matrix entries are highlighted below.</p></div>`;
}
function waveformFields(s:SourceValue):string {
  const w=s.waveform;
  if(w?.type==='step')return `<div class="field-row three">${field('At','waveform.at',s.id,w.at,'s')}${field('Before','waveform.before',s.id,w.before,sourceUnit(s.id))}${field('After','waveform.after',s.id,w.after,sourceUnit(s.id))}</div>`;
  if(w?.type==='sinusoid')return `<div class="field-row">${field('Offset','waveform.offset',s.id,w.offset,sourceUnit(s.id))}${field('Peak amplitude','waveform.amplitudePeak',s.id,w.amplitudePeak,sourceUnit(s.id))}${field('Frequency','waveform.frequencyHz',s.id,w.frequencyHz,'Hz')}${field('Phase','waveform.phaseRadians',s.id,w.phaseRadians,'rad')}</div><p class="muted small">Time amplitude is peak. The AC phasor above is RMS.</p>`;
  return `${field('Time value','waveform.value',s.id,w?.type==='constant'?w.value:s.dc,sourceUnit(s.id))}<p class="muted small">Time value is separate from DC once edited.</p>`;
}
function renderSources():void {
  const blocks=state.document.experiment.sources.map(s=>`<div class="source-block"><h3>${escapeHtml(s.id)} <span class="muted">· ${sourceUnit(s.id)} source</span></h3><div class="field-row three">${field('DC value','source.dc',s.id,s.dc,sourceUnit(s.id))}${field('AC real','source.ac.re',s.id,s.ac?.re??0,`${sourceUnit(s.id)} RMS`)}${field('AC imaginary','source.ac.im',s.id,s.ac?.im??0,`${sourceUnit(s.id)} RMS`)}</div>${selectField('Transient waveform','waveform.type',s.id,[{value:'constant',label:'Constant'},{value:'step',label:'Scheduled step'},{value:'sinusoid',label:'Sinusoid'}],s.waveform?.type??'constant')}${waveformFields(s)}</div>`).join('');
  const initial=state.document.experiment.initial;
  const stored=state.document.circuit.components.filter(c=>c.type==='C'||c.type==='L');
  const initialFields=initial.kind==='storage'?stored.map(c=>field(`${c.id} ${c.type==='C'?'voltage':'current'}`,'initial.value',c.id,initial.values.find(v=>v.id===c.id)?.value??0,c.type==='C'?'V':'A')).join(''):'';
  byId('source-editor').innerHTML=`${blocks||'<p class="muted small">No independent source in this document.</p>'}<div class="subheading">Initialization</div>${selectField('Policy','initial.kind','policy',[{value:'equilibrium',label:'Equilibrium before start'},{value:'storage',label:'Specified storage states'}],initial.kind)}${initialFields}<p class="muted small">Storage states use the device’s ordered terminal or current direction. Incompatible source constraints fail explicitly.</p>`;
}
function renderControls():void {
  const outputs=state.document.circuit.observations.map(o=>({value:o.id,label:`${o.id} · ${o.type==='voltage'?`V(${o.p})−V(${o.n})`:`I(${o.component})`}`}));
  const inputs=state.document.experiment.sources.map(s=>({value:s.id,label:`${s.id} · ${sourceUnit(s.id)} input`}));
  const s=state.settings;
  byId('analysis-controls').innerHTML=`<div class="controls-group"><h3>Unit-input transfer</h3><div class="controls-grid">${selectField('Independent input','selected.input','input',inputs,state.input)}${selectField('Measured output','selected.output','output',outputs,state.output)}${field('AC inspect frequency','setting','inspectHz',s.inspectHz,'Hz',true)}</div></div>
  <div class="controls-group"><h3>Logarithmic frequency sweep</h3><div class="controls-grid">${field('Minimum','setting','minHz',s.minHz,'Hz',true)}${field('Maximum','setting','maxHz',s.maxHz,'Hz',true)}${field('Samples','setting','points',s.points,'2–241',true)}</div></div>
  <div class="controls-group"><h3>Backward Euler transient</h3><div class="controls-grid">${field('Duration','setting','duration',s.duration,'s',true)}${field('Time step','setting','step',s.step,'s',true)}</div></div>
  <div class="controls-summary"><span class="summary-tag">Sweep ≤ 241 points</span><span class="summary-tag">Transient ≤ 3000 steps</span><span class="summary-tag">Fixed-step method</span></div>`;
}
function renderSchematic():void {
  const view=schematic(state);
  byId('schematic').innerHTML=view.html;
  byId('schematic-note').textContent=view.note;
  byId('schematic-badge').textContent=view.schematic?`Layout: ${state.presetId}`:'Topology table';
}
function statusMarkup(message:string):string { return `<div class="error-card" role="alert">${escapeHtml(message)}</div>`; }
function valueTable(items:{label:string;value:number;unit:string}[]):string {
  return `<div class="table-wrap"><table class="result-table"><thead><tr><th>Quantity</th><th>Value</th></tr></thead><tbody>${items.map(item=>`<tr><td>${escapeHtml(item.label)}</td><td>${fmt(item.value)} ${escapeHtml(item.unit)}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderDC(a:LabAnalysis):void {
  const dc=a.dc;
  if(dc.status!=='ok'){byId('dc-results').innerHTML=statusMarkup(`${dc.status}: ${dc.message}`);return;}
  const nodes=a.assembly.unknowns.filter(x=>x.id.startsWith('V(')).map(x=>({label:x.id,value:dc.unknowns[x.id]!.value.re,unit:'V'}));
  const branches=dcBranchCurrents(a,state).map(x=>({label:`I(${x.id})`,value:x.value,unit:'A'}));
  const max=Math.max(0,...dc.residuals.map(r=>r.absolute),dc.groundKcl.absolute);
  byId('dc-results').innerHTML=`<div class="two-col"><div><div class="subheading">Node voltages</div>${valueTable(nodes)}</div><div><div class="subheading">Signed branch currents</div>${valueTable(branches)}</div></div><p class="analysis-note">Max physical row residual ${fmt(max)} (each row keeps V or A units below). Scaled backward residual ${fmt(dc.diagnostics.scaledBackwardResidual)}.</p>`;
}
function renderFrequency(a:LabAnalysis):void {
  const dim=dimensionless(a.transferUnit), magLabel=dim?'Magnitude (dB)':`Magnitude (${a.transferUnit})`;
  const mag=a.sweep.map(p=>({x:p.frequencyHz,y:dim?p.magnitudeDb:p.magnitude,status:!dim&&p.status==='zero-magnitude'?'ok':p.status}));
  const phase=a.sweep.map(p=>({x:p.frequencyHz,y:p.phaseDegrees,status:p.status}));
  const failed=a.sweep.filter(p=>p.status!=='ok'&&p.status!=='zero-magnitude');
  const zero=a.sweep.filter(p=>p.status==='zero-magnitude');
  const ac=a.ac, acInputs=state.document.experiment.sources.map(s=>`${s.id}=${fmt(s.ac?.re??0)}${(s.ac?.im??0)<0?'':'+'}${fmt(s.ac?.im??0)}j ${sourceUnit(s.id)} RMS`).join('; ');
  const acText=ac.status==='ok'?`${fmt(ac.observations[state.output]!.value.re)}${ac.observations[state.output]!.value.im<0?'':'+'}${fmt(ac.observations[state.output]!.value.im)}j ${ac.observations[state.output]!.unit} RMS`:`${ac.status}: ${ac.message}`;
  const algebraic=a.algebraic.status==='ok'?`<div class="soft-note"><strong>Restricted algebraic extraction</strong> · H(s) = (${fmt(a.algebraic.numerator[0])} + ${fmt(a.algebraic.numerator[1])}s) / (${fmt(a.algebraic.denominator[0])} + ${fmt(a.algebraic.denominator[1])}s) ${escapeHtml(a.transferUnit)}. Scalar denominator root: ${fmt(a.algebraic.denominatorRoot)} s⁻¹. <span class="muted">${escapeHtml(a.algebraic.note)}</span></div>`:
    `<div class="soft-note"><strong>Algebraic extraction unavailable:</strong> ${escapeHtml(a.algebraic.message)} Numerical transfer remains available where solves succeed.</div>`;
  byId('frequency-results').innerHTML=`<p class="analysis-note"><strong>${escapeHtml(state.input)} → ${escapeHtml(state.output)}</strong> · one unit input, all other independent inputs zero, zero initial state. Gain unit: <strong>${escapeHtml(a.transferUnit)}</strong>. ${dim?'Dimensionless gain uses 20 log₁₀|H|.':'Magnitude retains physical ratio units.'}</p>
    <div class="plot-grid">${plot(mag,{title:'Magnitude',xLabel:'Frequency (Hz, log)',yLabel:magLabel,xLog:true})}${plot(phase,{title:'Phase',xLabel:'Frequency (Hz, log)',yLabel:'Phase (degrees)',xLog:true,color:'orange'})}</div>
    ${failed.length?`<p class="warning">${failed.length} frequency sample${failed.length===1?'':'s'} failed; plotted curves break at each failed point. ${escapeHtml(failed[0]!.status)}: ${escapeHtml(failed[0]!.message)}</p>`:''}${zero.length?`<p class="warning">${zero.length} sample${zero.length===1?' has':'s have'} zero magnitude: logarithmic magnitude and phase are undefined there.</p>`:''}
    <div class="subheading">Configured physical AC experiment</div><p class="analysis-note">At ${fmt(a.settings.inspectHz)} Hz, all configured source phasors act together: ${escapeHtml(acInputs||'none')}. Selected output: <strong>${escapeHtml(acText)}</strong>. This is separate from the unit-input transfer plotted above.</p>${algebraic}`;
}
function renderTime(a:LabAnalysis):void {
  const t=a.transient, unit=a.assembly.outputs.find(o=>o.id===state.output)!.unit;
  const samples=t.samples.map(s=>({x:s.time,y:s.observations[state.output]?.value.re??null,status:'ok'}));
  if(t.status!=='ok')samples.push({x:t.time,y:null,status:t.status});
  const details=t.status==='ok'?`<p class="analysis-note">${t.samples.length} samples. Initial policy: <strong>${escapeHtml(t.initialization.kind)}</strong>. Left/right samples share a time at scheduled source steps; storage remains continuous.</p>`:
    statusMarkup(`${t.status} at ${fmt(t.time)} s: ${t.message}. Only preceding valid samples are shown.`);
  byId('transient-results').innerHTML=`<p class="analysis-note"><strong>Backward Euler</strong> · requested step <strong>${fmt(a.settings.step)} s</strong> · duration ${fmt(a.settings.duration)} s · measured ${escapeHtml(state.output)} (${unit}). Shorter intervals land on source events and the end time.</p>${plot(samples,{title:`${state.output} over time`,xLabel:'Time (s)',yLabel:`${state.output} (${unit})`})}${details}`;
}
function matrix(name:'E'|'K'|'B',a:LabAnalysis):string {
  const assembly=a.assembly, cols=name==='B'?assembly.inputs:assembly.unknowns;
  const marked=new Set(assembly.contributions.filter(c=>c.component===state.selectedComponent&&c.matrix===name).map(c=>`${c.rowIndex}:${c.columnIndex}`));
  return `<div><h4>${name} <span class="muted">${name==='E'?'storage':name==='K'?'static laws':'input'}</span></h4><div class="table-wrap"><table class="matrix-table"><thead><tr><th>Row ↓ / column →</th>${cols.map(c=>`<th title="${escapeHtml(c.description)}">${escapeHtml(c.id)} (${c.unit})</th>`).join('')}</tr></thead><tbody>${assembly[name].map((row,i)=>`<tr><th title="${escapeHtml(assembly.rows[i]!.description)}">${escapeHtml(assembly.rows[i]!.id)} (${assembly.rows[i]!.unit})</th>${row.map((v,j)=>`<td class="${marked.has(`${i}:${j}`)?'highlight':''}">${fmt(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
function renderEquations(a:LabAnalysis):void {
  const output=a.assembly.outputs.find(o=>o.id===state.output)!;
  const relation=output.kind==='fixed'?`${state.output} = Cₒ·x + Dₒ·u; Cₒ=[${output.C.map(fmt).join(', ')}], Dₒ=[${output.D.map(fmt).join(', ')}]`:
    `${state.output} = Q·ẋ; Q=[${output.Q.map(fmt).join(', ')}] (capacitor derivative observation)`;
  const c=a.assembly.contributions.filter(p=>p.component===state.selectedComponent);
  const provenance=c.length?`<div class="table-wrap"><table class="result-table provenance-table"><thead><tr><th>Matrix</th><th>Row</th><th>Column</th><th>Value</th><th>Units</th><th>Terminal law</th></tr></thead><tbody>${c.map(p=>`<tr><td>${p.matrix}</td><td>${escapeHtml(p.row)}</td><td>${escapeHtml(p.column)}</td><td>${fmt(p.value)}</td><td>${escapeHtml(p.units)}</td><td>${escapeHtml(p.law)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted small">Select a component to see its recorded contributions and highlighted matrix cells.</p>';
  const dc=a.dc;
  const diagnostic=dc.status==='ok'?`<div class="table-wrap"><table class="result-table"><thead><tr><th>Residual row</th><th>Absolute</th><th>Limit</th><th>Unit</th></tr></thead><tbody>${[...dc.residuals,dc.groundKcl].map(r=>`<tr><td>${escapeHtml(r.label)}</td><td>${fmt(r.absolute)}</td><td>${fmt(r.tolerance)}</td><td>${r.unit}</td></tr>`).join('')}</tbody></table></div><p class="analysis-note">Equilibrated infinity-norm backward residual: ${fmt(dc.diagnostics.scaledBackwardResidual)}; pivot ratio: ${fmt(dc.diagnostics.pivotRatio)}. ${escapeHtml(dc.diagnostics.scaling)}</p>`:statusMarkup(`No DC residuals: ${dc.status}: ${dc.message}`);
  byId('equations-results').innerHTML=`<p class="equation-line">E · ẋ + K · x = B · u</p><p class="analysis-note">Unknowns: ${escapeHtml(a.assembly.unknowns.map(x=>`${x.id} [${x.unit}]`).join(', ')||'none')}. Inputs: ${escapeHtml(a.assembly.inputs.map(x=>`${x.id} [${x.unit}]`).join(', ')||'none')}.</p><p class="soft-note">Selected output relation: <strong>${escapeHtml(relation)}</strong>. Matrices below use the kernel’s row and column order.</p><div class="matrix-grid">${matrix('E',a)}${matrix('K',a)}${matrix('B',a)}</div><div class="subheading">Selected component provenance</div>${provenance}<div class="subheading">Numerical diagnostics</div>${diagnostic}`;
}
function renderResults():void {
  const ids=['dc-results','frequency-results','transient-results','equations-results'];
  if(!analysis){for(const id of ids)byId(id).innerHTML='<p class="warning">Results need a valid circuit, experiment, and analysis settings. Correct the highlighted input to recompute.</p>';}
  else {renderDC(analysis);renderFrequency(analysis);renderTime(analysis);renderEquations(analysis);}
  (byId('export-frequency') as HTMLButtonElement).disabled=!analysis;
  (byId('export-transient') as HTMLButtonElement).disabled=!analysis;
}
function renderStatus():void {
  byId('global-status').innerHTML=notice?`<div class="${noticeIsError?'error-card':'soft-note'}">${escapeHtml(notice)}</div>`:'';
}
function renderAll():void { renderExamples();renderComponents();renderSources();renderControls();renderSchematic();renderStatus();renderResults(); }
function recompute():void {
  try { analysis=analyze(state);notice='';noticeIsError=false; }
  catch(error){analysis=null;notice=error instanceof Error?error.message:String(error);noticeIsError=true;}
  renderAll();
}
function invalid(target:HTMLInputElement|HTMLSelectElement,message:string):void {
  target.setAttribute('aria-invalid','true');
  const slot=target.closest('.field')?.querySelector('.field-error');if(slot)slot.textContent=message;
  analysis=null;notice='Correct the highlighted input to recompute the results.';noticeIsError=true;
  renderStatus();renderResults();
}
function edited(target:HTMLInputElement|HTMLSelectElement):void {
  const kind=target.dataset.kind,id=target.dataset.id??'';
  if(!kind)return;
  try {
    if(kind==='selected.input'||kind==='selected.output'){
      if(kind==='selected.input')state.input=target.value;else state.output=target.value;
      state.revision++;recompute();return;
    }
    if(kind==='waveform.type'){
      const result=updateDocument(state,d=>{
        const source=d.experiment.sources.find(s=>s.id===id)!;
        if(target.value==='constant')source.waveform={type:'constant',value:source.dc};
        else if(target.value==='step')source.waveform={type:'step',at:0,before:0,after:source.dc};
        else if(target.value==='sinusoid')source.waveform={type:'sinusoid',offset:0,amplitudePeak:Math.abs(source.dc),frequencyHz:100,phaseRadians:0};
        else throw new RangeError('Unsupported waveform');
      });
      if(!result.ok)throw new RangeError(result.error);recompute();return;
    }
    if(kind==='initial.kind'){
      const result=updateDocument(state,d=>{
        if(target.value==='equilibrium')d.experiment.initial={kind:'equilibrium'};
        else if(target.value==='storage'){
          const prior=d.experiment.initial;
          d.experiment.initial={kind:'storage',values:d.circuit.components.filter(c=>c.type==='C'||c.type==='L').map(c=>({id:c.id,value:prior.kind==='storage'?prior.values.find(v=>v.id===c.id)?.value??0:0}))};
        } else throw new RangeError('Unsupported initialization policy');
      });
      if(!result.ok)throw new RangeError(result.error);recompute();return;
    }
    const value=parseFinite(target.value, target.labels?.[0]?.textContent?.trim()??id,target.dataset.positive==='1');
    if(kind==='setting'){
      const key=id as keyof Settings;
      if(!(key in state.settings))throw new RangeError('Unknown analysis setting');
      const next={...state.settings,[key]:value};
      const events=state.document.experiment.sources.filter(s=>s.waveform?.type==='step'&&s.waveform.at>=0&&s.waveform.at<=next.duration).length;
      const errors=validateSettings(next,events);
      if(errors.length)throw new RangeError(errors.join('; '));
      state.settings=next;state.revision++;recompute();return;
    }
    const result=updateDocument(state,d=>{
      if(kind==='component'){
        const c=d.circuit.components.find(c=>c.id===id);
        if(!c)throw new RangeError('Unknown component');
        if('value' in c)c.value=value;else if('gain' in c)c.gain=value;
        else throw new RangeError('This component has no editable numeric parameter');
      }else if(kind==='source.dc'||kind==='source.ac.re'||kind==='source.ac.im'){
        const s=d.experiment.sources.find(s=>s.id===id)!;
        if(kind==='source.dc')s.dc=value;
        else {s.ac??={re:0,im:0};if(kind.endsWith('.re'))s.ac.re=value;else s.ac.im=value;}
      }else if(kind.startsWith('waveform.')){
        const s=d.experiment.sources.find(s=>s.id===id)!;
        if(kind==='waveform.value'&&!s.waveform)s.waveform={type:'constant',value};
        if(!s.waveform)throw new RangeError('Choose a waveform first');
        const key=kind.slice('waveform.'.length) as keyof Waveform;
        if(!(key in s.waveform))throw new RangeError('Waveform field does not apply to the selected type');
        Object.assign(s.waveform,{[key]:value});
      }else if(kind==='initial.value'){
        const initial=d.experiment.initial;
        if(initial.kind!=='storage')throw new RangeError('Select specified storage states first');
        initial.values.find(v=>v.id===id)!.value=value;
      }else throw new RangeError('Unknown editable field');
    });
    if(!result.ok)throw new RangeError(result.error);
    recompute();
  }catch(error){invalid(target,error instanceof Error?error.message:String(error));}
}
function download(name:string,text:string,type:string):void {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.addEventListener('click',event=>{
  const target=event.target as Element;
  const example=target.closest<HTMLElement>('[data-example]');if(example){state=createLab(example.dataset.example);recompute();return;}
  const comp=target.closest<HTMLElement>('[data-component], [data-schematic-component]');
  if(comp){state.selectedComponent=comp.dataset.component??comp.dataset.schematicComponent??null;if(analysis)renderAll();else recompute();return;}
  const button=target.closest<HTMLButtonElement>('button');
  if(button?.id==='reset-example'){state=resetExample(state);recompute();}
  if(button?.id==='export-json')download('circuits-unfolded.json',exportNative(state),'application/json');
  if(button?.id==='export-frequency'&&analysis)download('circuits-frequency.csv',csvFor(analysis,state,'frequency'),'text/csv');
  if(button?.id==='export-transient'&&analysis)download('circuits-transient.csv',csvFor(analysis,state,'transient'),'text/csv');
});
document.addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  const node=(event.target as Element).closest<HTMLElement>('[data-schematic-component]');
  if(node){event.preventDefault();state.selectedComponent=node.dataset.schematicComponent??null;if(analysis)renderAll();else recompute();}
});
document.addEventListener('change',async event=>{
  const target=event.target;
  if(target instanceof HTMLInputElement&&target.id==='import-file'){
    const file=target.files?.[0];if(!file)return;
    try{
      const result=importNative(state,await file.text());
      if(!result.ok){byId('import-error').textContent=`Import rejected: ${result.error}. The current document is unchanged.`;return;}
      byId('import-error').textContent='';recompute();
    }catch(error){byId('import-error').textContent=`Import failed: ${error instanceof Error?error.message:String(error)}. The current document is unchanged.`;}
    return;
  }
  if(target instanceof HTMLInputElement||target instanceof HTMLSelectElement)edited(target);
});
recompute();
