// Drawing topology is authored separately from the native fixture. This helper
// expands declared terminal groups; it does not read native p/n assignments.
export function drawing(groups, placements, probes) {
  const vertices=[],edges=[],bindings=[];
  for(const [index,[node,terminals]] of groups.entries()) {
    const hub=`hub${index}`;vertices.push({id:hub,kind:'junction',x:index*150,y:200});bindings.push({node,vertex:hub});
    for(const [component,role] of terminals){
      const id=`pin${vertices.length}`;vertices.push({id,kind:'terminal',component,role});
      edges.push({id:`wire${edges.length}`,a:id,b:hub,bends:[{x:index*150,y:40},{x:index*150+20,y:40}]});
    }
  }
  const anchor=node=>bindings.find(b=>b.node===node).vertex;
  return {drawingVersion:1,placements:placements.map(([component,x,y,turns])=>({component,x,y,turns})),vertices,edges,bindings,
    reference:anchor('0'),observations:probes.map(([observation,p,n])=>({observation,p:anchor(p),n:anchor(n)})),viewport:{x:-100,y:-100,width:900,height:600}};
}
export const dividerDrawing=()=>drawing([
  ['0',[['Vin','n'],['R2','n']]],['in',[['Vin','p'],['R1','p']]],['out',[['R1','n'],['R2','p']]]
],[['Vin',0,100,1],['R1',150,0,0],['R2',300,100,3]],[['out','out','0'],['r1v','in','out']]);
export const rcDrawing=()=>drawing([
  ['0',[['Vin','n'],['C','n']]],['in',[['Vin','p'],['R','p']]],['out',[['R','n'],['C','p']]]
],[['Vin',0,100,1],['R',150,0,0],['C',300,100,1]],[['out','out','0'],['in','in','0']]);
export const rlcDrawing=()=>drawing([
  ['0',[['Vin','n'],['C','n']]],['in',[['Vin','p'],['R','p']]],['mid',[['R','n'],['L','p']]],['out',[['L','n'],['C','p']]]
],[['Vin',0,100,1],['R',150,0,0],['L',300,0,2],['C',450,100,3]],[['out','out','0']]);
export function bridge(value=1000){
  const document={circuit:{schemaVersion:1,nodes:['0','top','left','right'],components:[
    {id:'Vs',type:'V',p:'top',n:'0'},
    {id:'TL',type:'R',p:'top',n:'left',value:1000},{id:'BL',type:'R',p:'left',n:'0',value:1000},
    {id:'TR',type:'R',p:'top',n:'right',value:1000},{id:'BR',type:'R',p:'right',n:'0',value},
    {id:'Cross',type:'R',p:'left',n:'right',value:1000}],observations:[
    {id:'left',type:'voltage',p:'left',n:'0'},{id:'right',type:'voltage',p:'right',n:'0'},
    {id:'cross',type:'current',component:'Cross'}]},experiment:{schemaVersion:1,sources:[{id:'Vs',dc:10}],initial:{kind:'equilibrium'}}};
  return envelope(document,drawing([
    ['0',[['Vs','n'],['BL','n'],['BR','n']]],['top',[['Vs','p'],['TL','p'],['TR','p']]],
    ['left',[['TL','n'],['BL','p'],['Cross','p']]],['right',[['TR','n'],['BR','p'],['Cross','n']]]
  ],[['Vs',0,100,1],['TL',150,0,1],['BL',150,200,1],['TR',350,0,1],['BR',350,200,1],['Cross',250,100,0]],
  [['left','left','0'],['right','right','0']]));
}
export const envelope=(document,drawing)=>({format:'circuits-unfolded-project',projectVersion:1,document,drawing});
