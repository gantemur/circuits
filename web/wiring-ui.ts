import { WiringSession } from './wiring-interaction.js';
import { fitWiring, renderWiringSvg, wiringTopology, ambiguousWiring, type ViewBox } from './wiring-render.js';
import { wt, type WiringCopyKey } from './wiring-copy.js';
import { wiringConflict } from './wiring-draft.js';
import { netNames, type Device, type DeviceType, type Point, type SourceDraft } from './wiring-graph.js';
import { numericText } from './wiring-native.js';
import type { WiringOperation } from './wiring-transactions.js';
import type { LabState } from './lab.js';
import { escapeHtml } from './schematic.js';
const e=(value:string|number)=>escapeHtml(String(value));
const button=(action:string,label:WiringCopyKey,extra='')=>`<button type="button" class="button outline" data-w-action="${action}" ${extra}>${e(wt(label))}</button>`;
const option=(value:string,label:string,selected:string)=>`<option value="${e(value)}"${value===selected?' selected':''}>${e(label)}</option>`;

export class WiringUI {
  readonly session: WiringSession;
  private view:ViewBox={x:-100,y:-100,width:800,height:500};
  private controls=new Map<string,string>();
  private openSections=new Set(['w-terminals','w-topology']);
  private pendingTools=new Set<string>();
  private pointer: {x:number;y:number;id:number}|null=null;
  private suppressClick=false;
  constructor(private root:HTMLElement,state:()=>LabState,private applied:()=>void,private hasPendingInspector:()=>boolean=()=>false) {
    this.session=new WiringSession(state);
    if(this.session.draft)this.view=fitWiring(this.session.draft.graph);
    root.addEventListener('input',event=>this.input(event.target));
    root.addEventListener('change',event=>{this.input(event.target);if(event.target instanceof HTMLSelectElement)this.render();});
    root.addEventListener('click',event=>this.click(event));
    root.addEventListener('keydown',event=>{
      if(event.key==='Escape'){this.session.cancel();this.render();}
      if((event.key==='Enter'||event.key===' ')&&event.target instanceof SVGElement){event.preventDefault();this.svgTarget(event.target);}
    });
    root.addEventListener('pointerdown',event=>{this.pointer={x:event.clientX,y:event.clientY,id:event.pointerId};this.suppressClick=false;});
    root.addEventListener('pointerup',event=>{
      if(this.pointer&&Math.hypot(event.clientX-this.pointer.x,event.clientY-this.pointer.y)>8)this.suppressClick=true;
      this.pointer=null;
    });
    root.addEventListener('pointercancel',()=>{this.pointer=null;this.suppressClick=true;this.session.cancel();this.render();});
  }
  hasUnappliedDraft():boolean {return this.session.hasDrafts() || this.pendingTools.size>0;}
  leave():void {this.session.moving=false;this.pointer=null;}
  private value(key:string,fallback=''):string{return this.controls.get(key)??fallback;}
  private input(target:EventTarget|null):void {
    if(!(target instanceof HTMLInputElement||target instanceof HTMLSelectElement||target instanceof HTMLTextAreaElement))return;
    if(target.dataset.wProp){this.session.pending.set(target.dataset.wProp,target.value);this.session.status='idle';
      const status=this.root.querySelector('[data-w-pending]');if(status)status.textContent=wt('pendingText');}
    if(target.dataset.wControl){
      const key=target.dataset.wControl;this.controls.set(key,target.value);
      if(['x','y','probe-id','probe-label'].includes(key)||key.startsWith('bends-')||key.startsWith('node-name-'))this.pendingTools.add(key);
    }
  }
  private field(key:string,label:WiringCopyKey,value:string,prop=false):string {
    const text=prop?this.session.pending.get(key)??value:this.value(key,value);
    return `<div class="field"><label for="w-${e(key)}">${e(wt(label))}</label><input id="w-${e(key)}" ${prop?'data-w-prop':'data-w-control'}="${e(key)}" value="${e(text)}"></div>`;
  }
  private select(key:string,label:WiringCopyKey,options:{value:string;label:string}[],fallback='',prop=false):string {
    const selected=prop?this.session.pending.get(key)??fallback:this.value(key,fallback);
    return `<div class="field"><label for="w-${e(key)}">${e(wt(label))}</label><select id="w-${e(key)}" ${prop?'data-w-prop':'data-w-control'}="${e(key)}">${options.map(o=>option(o.value,o.label,selected)).join('')}</select></div>`;
  }
  private deviceProperties(device:Device):string {
    const graph=this.session.draft!.graph,p=graph.placements.find(p=>p.key===device.key)!;
    const f=(field:string,label:WiringCopyKey,value:string)=>this.field(`${device.key}:${field}`,label,value,true);
    let content=f('id','id',device.id)+f('label','label',device.label??'')+f('x','x',String(p.x))+f('y','y',String(p.y));
    if(device.value!==undefined)content+=f('value','value',device.value);
    const source=graph.sources.find(s=>s.device===device.key);
    if(source){
      content+=f('dc','dc',source.dc)+this.select(`${device.key}:ac`,'ac',[{value:'no',label:wt('none')},{value:'yes',label:wt('ac')}],source.ac?'yes':'no',true);
      if((this.session.pending.get(`${device.key}:ac`)??(source.ac?'yes':'no'))==='yes')content+=f('re','real',source.ac?.re??'0')+f('im','imag',source.ac?.im??'0');
      const kind=this.session.pending.get(`${device.key}:waveform`)??source.waveform?.type??'none';
      content+=this.select(`${device.key}:waveform`,'waveform',['none','constant','step','sinusoid'].map(value=>({value,label:wt(value as WiringCopyKey)})),source.waveform?.type??'none',true);
      const fields=kind==='constant'?['timeValue']:kind==='step'?['at','before','after']:kind==='sinusoid'?['offset','amplitudePeak','frequencyHz','phaseRadians']:[];
      for(const field of fields){const sourceKey=field==='timeValue'?'value':field;const waveform=source.waveform as unknown as Record<string,string>|undefined;
        content+=f(field,field as WiringCopyKey,waveform?.[sourceKey]??(field==='frequencyHz'?'1':'0'));}
    }
    const initial=graph.storage.find(s=>s.device===device.key);
    if(initial)content+=f('initial','initialValue',initial.value);
    return `<h4>${e(device.id)} · ${device.type}</h4><div class="controls-grid">${content}</div><div class="file-actions">${button('save','save')}${button('rotate','rotate')}${button('move','move')}${button('copy','copy')}</div><label class="w-check"><input type="checkbox" id="w-delete-probes">${e(wt('removeProbes'))}</label>${button('delete-device','remove')}`;
  }
  render():void {
    for(const details of Array.from(this.root.querySelectorAll<HTMLDetailsElement>('details[id]'))){if(details.open)this.openSections.add(details.id);else this.openSections.delete(details.id);}
    const active=document.activeElement instanceof HTMLInputElement||document.activeElement instanceof HTMLTextAreaElement||document.activeElement instanceof HTMLSelectElement?document.activeElement:null;
    const focus=active&&this.root.contains(active)?{id:active.id,start:active instanceof HTMLSelectElement?null:active.selectionStart,end:active instanceof HTMLSelectElement?null:active.selectionEnd}:null;
    const base=this.session.draft?.ownership.document;
    if(!this.pendingTools.size)this.session.sync();
    if(base!==this.session.draft?.ownership.document){this.controls.clear();this.view=this.session.draft?fitWiring(this.session.draft.graph):this.view;}
    const s=this.session,draft=s.draft;
    const actions=`<div class="file-actions">${button('new','new')}${button('discard','discard')}${button('undo','undo')}${button('redo','redo')}${button('validate','validate')}${button('apply','apply')}${button('restore-text','restoreText')}</div>`;
    if(!draft||s.oversized()){
      this.root.innerHTML=`<p class="warning">${e(wt(s.oversized()?'oversized':'unsupported'))}</p>${button('new','new')}${button('discard','discard')}`;return;
    }
    const graph=draft.graph,names=netNames(graph);
    const vertices=graph.vertices.map(v=>({value:v.key,label:v.kind==='terminal'?`${graph.devices.find(d=>d.key===v.device)!.id}.${v.role} · ${names.get(v.key)} · ${wt(v.completion==='open'?'intentionallyOpen':v.completion)}`:`${names.get(v.key)} · ${wt(v.kind)} · ${v.key}`}));
    const devices=graph.devices.map(d=>({value:d.key,label:`${d.id} · ${d.type}`}));
    const nets=graph.names.map(n=>({value:n.name,label:n.name}));
    const wires=graph.edges.map(edge=>({value:edge.key,label:`${edge.key}: ${vertices.find(v=>v.value===edge.a)!.label} → ${vertices.find(v=>v.value===edge.b)!.label}`}));
    const endpoint=this.value('endpoint',vertices[0]?.value??'');
    const chosen=s.selection?.kind==='device'?graph.devices.find(d=>d.key===s.selection!.key):undefined;
    const selectedVertex=graph.vertices.find(v=>v.key===endpoint);
    const edgeKey=this.value('wire',graph.edges[0]?.key??'');
    const route=graph.routes.find(r=>r.key===edgeKey);
    const conflict=wiringConflict(draft,s.state());
    const status=conflict?'conflict':s.status==='valid'?'valid':s.status==='applied'?'applied':this.hasUnappliedDraft()?'dirty':'clean';
    const issue=s.issue;
    this.root.innerHTML=`<p>${e(wt('hint'))}</p><p class="small muted">${e(wt('provisional'))} ${e(wt('bounds'))}</p>${actions}
      <p class="${conflict?'warning':'soft-note'}" role="status" data-w-status>${e(wt(status))}</p><p data-w-pending>${s.pending.size||this.pendingTools.size?e(wt('pendingText')):''}</p>
      ${issue?`<div class="error-card" role="alert">${e(wt(issue.category))} ${issue.handles.map(key=>e(graph.devices.find(d=>d.key===key)?.id??vertices.find(v=>v.value===key)?.label??key)).join(', ')}<details><summary>${e(wt('technical'))}</summary><pre>${e(issue.message)}</pre></details></div>`:''}
      <div class="w-layout"><section class="w-drawing"><div class="file-actions">${(['fit','zoom-in','zoom-out','left','right','up','down'] as const).map((a,i)=>button(a,(['fit','zoomIn','zoomOut','left','right','up','down'] as WiringCopyKey[])[i]!)).join('')}</div>
      ${ambiguousWiring(graph)?`<p class="warning" data-w-ambiguity>${e(wt('warning'))}</p>`:''}
      ${s.gesture?`<p class="warning">${e(wt('activeWire'))}</p>`:''}${s.moving?`<p class="warning">${e(wt('move'))}</p>`:''}
      ${button('cancel','cancel')}<div class="w-viewport">${renderWiringSvg(graph,s.selection,this.view,s.gesture)}</div></section>
      <section class="w-inspector"><h3>${e(wt('palette'))}</h3><div class="file-actions">${(['R','C','L','V','I'] as const).map(type=>`<button type="button" class="button" data-w-add="${type}">${type}</button>`).join('')}</div>
      ${this.select('device','device',devices,devices[0]?.value??'')}${button('select-device','select')}
      <h3>${e(wt('properties'))}</h3>${chosen?this.deviceProperties(chosen):`<p>${e(wt('select'))}</p>`}
      <h3>${e(wt('initial'))}</h3>${this.select('initial','initial',['equilibrium','storage'].map(value=>({value,label:wt(value as 'equilibrium'|'storage')})),graph.initial)}${button('initial','save')}
      </section></div>
      <details id="w-terminals" class="w-tools" ${this.openSections.has('w-terminals')?'open':''}><summary>${e(wt('terminals'))}</summary><div class="controls-grid">${this.select('endpoint','endpoint',vertices,vertices[0]?.value??'')}${this.select('target','target',vertices,vertices[1]?.value??'')}${this.select('survivor','survivor',[{value:'',label:wt('choose')},...nets])}</div>
      <div class="file-actions">${button('select-vertex','select')}${button('start','start')}${button('connect','finish')}${button('disconnect','disconnect')}${button('open','open')}${button('reference','reference')}${button('move-vertex','move')}</div>
      ${this.field(`node-name-${endpoint}`,'name',names.get(endpoint)??'')}${button('rename','rename')}
      <div class="controls-grid">${this.field('x','x','100')}${this.field('y','y','100')}</div>${button('add-junction','addJunction')}${button('add-free','addFree')}${button('position-vertex','movePosition')}
      ${selectedVertex?.kind==='junction'?`<div class="w-incidents">${graph.edges.filter(edge=>edge.a===endpoint||edge.b===endpoint).map(edge=>`<label><input type="checkbox" data-w-incident="${edge.key}">${e(edge.key)}</label>`).join('')}${button('separate','separate')}</div>`:''}</details>
      <details id="w-wires" class="w-tools" ${this.openSections.has('w-wires')?'open':''}><summary>${e(wt('wires'))}</summary><div class="controls-grid">${this.select('wire','wire',wires,graph.edges[0]?.key??'')}${this.field('segment','segment','0')}${this.field('fraction','fraction','0.5')}${this.select('other-wire','otherWire',wires,graph.edges[1]?.key??'')}${this.field('other-segment','otherSegment','0')}</div>
      <div class="file-actions">${button('split','split')}${button('attach','attach')}${button('join','join')}${button('delete-wire','deleteWire')}</div>
      <div class="field"><label for="w-bends">${e(wt('bends'))}</label><textarea id="w-bends" data-w-control="bends-${edgeKey}">${e(this.value(`bends-${edgeKey}`,route?.bends.map(p=>`${p.x} ${p.y}`).join('\n')??''))}</textarea></div>${button('bends','saveBends')}</details>
      <details id="w-observations" class="w-tools" ${this.openSections.has('w-observations')?'open':''}><summary>${e(wt('observations'))}</summary><div class="controls-grid">${this.field('probe-id','id','out')}${this.field('probe-label','label','')}${this.select('probe-type','observations',[{value:'voltage',label:wt('voltage')},{value:'current',label:wt('current')}],'voltage')}${this.select('probe-p','endpoint',vertices,vertices[0]?.value??'')}${this.select('probe-n','target',vertices,vertices[1]?.value??'')}${this.select('probe-device','device',devices,devices[0]?.value??'')}</div>${button('add-probe','addObservation')}
      ${this.select('probe','observations',graph.observations.map(o=>({value:o.key,label:o.id})),graph.observations[0]?.key??'')}${button('delete-probe','removeObservation')}</details>
      <details id="w-topology" ${this.openSections.has('w-topology')?'open':''}><summary>${e(wt('topology'))}</summary>${wiringTopology(graph)}</details>`;
    if(focus){const element=document.getElementById(focus.id);if(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement||element instanceof HTMLSelectElement){element.focus({preventScroll:true});if(!(element instanceof HTMLSelectElement))element.setSelectionRange(focus.start,focus.end);}}
  }
  private read(key:string,fallback=''):string {
    return this.controls.get(key)??this.root.querySelector<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(`[data-w-control="${key}"]`)?.value??fallback;
  }
  private saveProperties(device:Device):void {
    const graph=this.session.draft!.graph,p=graph.placements.find(p=>p.key===device.key)!;
    const value=(field:string,fallback:string)=>this.session.pending.get(`${device.key}:${field}`)??fallback;
    const operations:WiringOperation[]=[{type:'rename-device',device:device.key,id:value('id',device.id)},
      {type:'edit-label',device:device.key,label:value('label',device.label??'')},
      {type:'move-device',device:device.key,point:{x:numericText(value('x',String(p.x))),y:numericText(value('y',String(p.y)))}}];
    if(device.value!==undefined)operations.push({type:'edit-value',device:device.key,value:value('value',device.value)});
    const old=graph.sources.find(s=>s.device===device.key);
    if(old){
      const source:Omit<SourceDraft,'key'|'device'>={dc:value('dc',old.dc)};
      if(value('ac',old.ac?'yes':'no')==='yes')source.ac={re:value('re',old.ac?.re??'0'),im:value('im',old.ac?.im??'0')};
      const kind=value('waveform',old.waveform?.type??'none');
      const previous=old.waveform as unknown as Record<string,string>|undefined;
      const w=(field:string,fallback='0')=>value(field,previous?.[field==='timeValue'?'value':field]??fallback);
      if(kind==='constant')source.waveform={type:kind,value:w('timeValue')};
      if(kind==='step')source.waveform={type:kind,at:w('at'),before:w('before'),after:w('after')};
      if(kind==='sinusoid')source.waveform={type:kind,offset:w('offset'),amplitudePeak:w('amplitudePeak'),frequencyHz:w('frequencyHz','1'),phaseRadians:w('phaseRadians')};
      operations.push({type:'edit-source',device:device.key,source});
    }
    const initial=graph.storage.find(s=>s.device===device.key);
    if(initial)operations.push({type:'edit-initial',device:device.key,value:value('initial',initial.value)});
    if(this.session.execute({type:'batch',operations})){
      for(const key of this.session.pending.keys())if(key.startsWith(device.key+':'))this.session.pending.delete(key);
      this.session.validate();
    }
  }
  private svgTarget(target:Element):boolean {
    const device=target.closest<SVGElement>('[data-w-device]');
    const vertex=target.closest<SVGElement>('[data-w-vertex]');
    const edge=target.closest<SVGElement>('[data-w-edge]');
    if(vertex){const key=vertex.dataset.wVertex!;this.controls.set('endpoint',key);
      if(this.session.gesture)this.session.finish(key,this.read('survivor'));else this.session.selection={kind:'vertex',key};}
    else if(device){this.session.selection={kind:'device',key:device.dataset.wDevice!};this.controls.set('device',device.dataset.wDevice!);}
    else if(edge){const key=edge.dataset.wEdge!;this.session.selection={kind:'edge',key,segment:Number(edge.dataset.wSegment)};this.controls.set('wire',key);this.controls.set('segment',edge.dataset.wSegment!);this.controls.delete('bends');}
    else return false;
    this.render();return true;
  }
  private click(event:MouseEvent):void {
    if(!(event.target instanceof Element))return;
    if(this.suppressClick){this.suppressClick=false;return;}
    try {
      const target=event.target;
      if(target.closest('svg')){
        if(this.session.moving){const svg=this.root.querySelector<SVGSVGElement>('svg')!,matrix=svg.getScreenCTM();if(!matrix)return;
          const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());this.moveTo({x:Math.round(point.x/10)*10,y:Math.round(point.y/10)*10});this.render();return;}
        if(this.svgTarget(target))return;
        if(this.session.gesture){const svg=this.root.querySelector<SVGSVGElement>('svg')!,matrix=svg.getScreenCTM();if(matrix){const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());if(this.session.gesture.bends.length<64)this.session.gesture.bends.push({x:Math.round(p.x/10)*10,y:Math.round(p.y/10)*10});this.render();}}return;
      }
      const add=target.closest<HTMLElement>('[data-w-add]');
      if(add){const graph=this.session.draft!.graph,type=add.dataset.wAdd as DeviceType;let index=1;while(graph.devices.some(d=>d.id===`${type}${index}`))index++;
        const keys=this.session.execute({type:'add-device',deviceType:type,id:`${type}${index}`,value:type==='C'?'0.000001':type==='L'?'0.001':'1000',point:{x:80+(graph.devices.length%4)*150,y:100+Math.floor(graph.devices.length/4)*150}});
        if(keys){this.session.selection={kind:'device',key:keys[0]!};this.controls.set('device',keys[0]!);}this.render();return;}
      const action=target.closest<HTMLElement>('[data-w-action]')?.dataset.wAction;if(!action)return;
      this.action(action);this.render();
    } catch(error){this.session.issue={category:'validation',code:'input',handles:[],message:error instanceof Error?error.message:String(error)};this.render();}
  }
  private moveTo(point:Point):void {
    const selection=this.session.selection;
    if(selection?.kind==='device')this.session.execute({type:'move-device',device:selection.key,point});
    else if(selection?.kind==='vertex')this.session.execute({type:'move-vertex',vertex:selection.key,point});
    this.session.moving=false;
  }
  private action(action:string):void {
    const s=this.session,graph=s.draft?.graph;
    if(action==='new'){s.blank();this.pendingTools.clear();this.controls.clear();this.view=fitWiring(s.draft!.graph);return;}
    if(action==='discard'){s.reload();this.pendingTools.clear();this.controls.clear();if(s.draft)this.view=fitWiring(s.draft.graph);return;}
    if(action==='restore-text'){s.pending.clear();for(const key of this.pendingTools)this.controls.delete(key);this.pendingTools.clear();s.issue=null;return;}
    if(!graph)return;
    const endpoint=this.read('endpoint'),wire=this.read('wire'),survivingName=this.read('survivor');
    const device=s.selection?.kind==='device'?graph.devices.find(d=>d.key===s.selection!.key):undefined;
    if(action==='apply'){
      if(this.pendingTools.size){s.issue={category:'completion',code:'pending-properties',handles:[],message:'Commit pending net, route, coordinate or observation text first.'};return;}
      if(this.hasPendingInspector()){s.issue={category:'completion',code:'inspector-pending',handles:[],message:'Correct the existing inspector/source draft before replacing its circuit.'};return;}
      const previousDocument=s.state().document;
      // Geometry-only Apply checkpoints user work without invalidating analyses.
      if(s.apply() && s.state().document!==previousDocument)this.applied();
      return;
    }
    if(action==='validate'){if(this.pendingTools.size)s.issue={category:'completion',code:'pending-properties',handles:[],message:'Commit pending property text first.'};else s.validate();return;}
    if(action==='undo'||action==='redo'){s.history(action==='redo');this.controls.delete('bends');return;}
    if(action==='cancel'){s.cancel();return;}
    if(action==='fit'){this.view=fitWiring(graph);return;}
    if(action==='zoom-in'||action==='zoom-out'){const factor=action==='zoom-in'?.8:1.25;
      const width=Math.max(200,Math.min(4000,this.view.width*factor)),height=Math.max(150,Math.min(3000,this.view.height*factor));
      this.view={x:this.view.x+(this.view.width-width)/2,y:this.view.y+(this.view.height-height)/2,width,height};return;}
    if(['left','right','up','down'].includes(action)){const axis=action==='left'||action==='right'?'x':'y';const delta=action==='left'||action==='up'?-80:80;this.view[axis]=Math.max(-1e6,Math.min(1e6,this.view[axis]+delta));return;}
    if(action==='select-device'){s.selection={kind:'device',key:this.read('device')};return;}
    if(action==='select-vertex'){s.selection={kind:'vertex',key:endpoint};return;}
    if(action==='save'&&device){this.saveProperties(device);return;}
    if(action==='rotate'&&device){s.execute({type:'rotate-device',device:device.key,quarterTurns:1});return;}
    if(action==='move'||action==='move-vertex'){if(action==='move-vertex')s.selection={kind:'vertex',key:endpoint};s.moving=true;s.gesture=null;return;}
    if(action==='copy'&&device){const keys=s.execute({type:'copy-device',device:device.key});if(keys)s.selection={kind:'device',key:keys[0]!};return;}
    if(action==='delete-device'&&device){const included=(this.root.querySelector<HTMLInputElement>('#w-delete-probes')?.checked??false)?graph.observations.filter(o=>o.type==='current'&&o.device===device.key).map(o=>o.key):[];
      if(s.execute({type:'delete-device',device:device.key,deleteObservations:included})){for(const key of s.pending.keys())if(key.startsWith(device.key+':'))s.pending.delete(key);s.selection=null;}return;}
    if(action==='initial'){s.execute({type:'set-initial',kind:this.read('initial') as 'storage'|'equilibrium'});return;}
    if(action==='start'){s.begin(endpoint);return;}
    if(action==='connect'){if(!s.gesture)s.begin(endpoint);s.finish(this.read('target'),survivingName);return;}
    if(action==='disconnect'){s.execute({type:'disconnect',vertex:endpoint});return;}
    if(action==='open'){s.execute({type:'mark-open',vertex:endpoint});return;}
    if(action==='reference'){s.execute({type:'set-reference',vertex:endpoint});return;}
    if(action==='rename'){if(s.execute({type:'rename-node',vertex:endpoint,name:this.read(`node-name-${endpoint}`)}))this.pendingTools.delete(`node-name-${endpoint}`);return;}
    if(action==='add-junction'||action==='add-free'){if(s.execute({type:'add-vertex',kind:action==='add-junction'?'junction':'free',point:{x:numericText(this.read('x')),y:numericText(this.read('y'))}})){this.pendingTools.delete('x');this.pendingTools.delete('y');}return;}
    if(action==='position-vertex'){if(s.execute({type:'move-vertex',vertex:endpoint,point:{x:numericText(this.read('x')),y:numericText(this.read('y'))}})){this.pendingTools.delete('x');this.pendingTools.delete('y');}return;}
    if(action==='separate'){s.execute({type:'separate',vertex:endpoint,edges:Array.from(this.root.querySelectorAll<HTMLInputElement>('[data-w-incident]:checked')).map(input=>input.dataset.wIncident!)});return;}
    if(action==='split'){s.execute({type:'split-wire',edge:wire,segment:numericText(this.read('segment')),fraction:numericText(this.read('fraction'))});return;}
    if(action==='attach'&&s.gesture){if(s.execute({type:'attach-to-segment',vertex:s.gesture.start,edge:wire,segment:numericText(this.read('segment')),fraction:numericText(this.read('fraction')),survivingName,bends:s.gesture.bends}))s.gesture=null;return;}
    if(action==='join'){s.execute({type:'join-crossing',first:wire,firstSegment:numericText(this.read('segment')),second:this.read('other-wire'),secondSegment:numericText(this.read('other-segment')),survivingName});return;}
    if(action==='delete-wire'){s.execute({type:'delete-wire',edge:wire});return;}
    if(action==='bends'){const text=this.read(`bends-${wire}`);const bends=text.trim()?text.trim().split('\n').map(line=>{const values=line.trim().split(/\s+/);if(values.length!==2)throw new Error('Each bend needs X Y');return {x:numericText(values[0]!),y:numericText(values[1]!)}}):[];if(s.execute({type:'move-bends',edge:wire,bends}))this.pendingTools.delete(`bends-${wire}`);return;}
    if(action==='add-probe'){const base={id:this.read('probe-id'),...(this.read('probe-label')?{label:this.read('probe-label')}:{})};if(s.execute({type:'add-observation',observation:this.read('probe-type')==='current'?{...base,type:'current',device:this.read('probe-device')}:{...base,type:'voltage',p:this.read('probe-p'),n:this.read('probe-n')}})){this.pendingTools.delete('probe-id');this.pendingTools.delete('probe-label');}return;}
    if(action==='delete-probe'){s.execute({type:'delete-observation',observation:this.read('probe')});}
  }
}
