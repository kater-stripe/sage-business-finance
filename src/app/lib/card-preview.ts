import {audit,type SageStore} from './store';

export const cardPreviewActions = new Set(['enable-card-preview','create-demo-card','update-demo-card']);

/** Local presentation state only. Never call Issuing, touch cash or post journals. */
export function applyCardPreviewAction(s:SageStore, action:string, body:Record<string,unknown>){
 if(!s.account||!s.onboarding?.workspaceEnteredAt)throw new Error('Open your business workspace before using the card preview.');
 if(action==='enable-card-preview'){
  if(body.confirm!==true)throw new Error('Confirm this is a simulated employee-card preview.');
  s.cardPreview??={enabledAt:new Date().toISOString(),cards:[]};
  audit(s,'Employee-card preview enabled',undefined,'Simulated only — no card issued');
  return {ok:true,simulated:true};
 }
 if(!s.cardPreview)throw new Error('Enable the employee-card preview first.');
 if(action==='create-demo-card'){
  const key=String(body.key||'');if(!/^[a-f0-9-]{36}$/.test(key))throw new Error('A unique preview operation key is required.');
  const id=`demo_card_${key}`;
  if(s.cardPreview.cards.some(c=>c.id===id))return {ok:true,simulated:true,card:id};
  const holder=String(body.holder||'').trim(),label=String(body.label||'').trim(),limit=Number(body.monthlyLimit);
  if(holder.length<2||holder.length>100||!label||label.length>60||!Number.isSafeInteger(limit)||limit<100||limit>10000000)throw new Error('Enter an example employee name, card label and monthly limit between £1 and £100,000.');
  if(body.confirm!==true)throw new Error('Confirm you are creating a non-payment demo card with synthetic details.');
  if(s.cardPreview.cards.length>=20)throw new Error('This preview supports up to 20 demo cards.');
  s.cardPreview.cards.unshift({id,holder,label,monthlyLimit:limit,status:'ready',last4:String(s.cardPreview.cards.length+1).padStart(4,'0'),createdAt:new Date().toISOString()});
  audit(s,'Demo employee card created',id,'Simulated only — no card issued');
  return {ok:true,simulated:true,card:id};
 }
 if(action==='update-demo-card'){
  const card=s.cardPreview.cards.find(c=>c.id===body.card);if(!card)throw new Error('Choose a demo card in this workspace.');
  if(body.status!==undefined&&body.status!=='ready'&&body.status!=='frozen')throw new Error('Choose a supported preview card status.');
  const limit=body.monthlyLimit===undefined?undefined:Number(body.monthlyLimit);
  if(limit!==undefined&&(!Number.isSafeInteger(limit)||limit<100||limit>10000000))throw new Error('Enter a monthly limit between £1 and £100,000.');
  if(body.status==='ready'||body.status==='frozen')card.status=body.status;
  if(limit!==undefined)card.monthlyLimit=limit;
  audit(s,'Demo employee card updated',card.id,'Simulated controls only');
  return {ok:true,simulated:true};
 }
 throw new Error('Unknown card preview action.');
}
