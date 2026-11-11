import {audit,type SageStore} from './store';
import {financingPurposes,newCapitalPreview,previewMinimum,previewStep,previewTerms,previewRepaid} from './capital-preview-model';
export const capitalPreviewActions=new Set(['save-capital-preview','submit-capital-preview','advance-capital-preview','repay-capital-preview','reset-capital-preview']);

/** Deliberately local-only. Never imports Stripe or writes financial journals. */
export function applyCapitalPreviewAction(s:SageStore,action:string,body:Record<string,unknown>){
 if(!s.account||!s.signup||!s.onboarding?.workspaceEnteredAt)throw new Error('Open your Sage workspace before using the financing preview.');
 if(body.confirm!==true)throw new Error('Confirm this action is a financing simulation. No real credit or money movement occurs.');
 s.capitalPreview??=newCapitalPreview(s.id);
 const p=s.capitalPreview;
 if(action==='reset-capital-preview'){
  s.capitalPreview=newCapitalPreview(s.id);audit(s,'Financing preview restarted',p.id,'Simulated only; real financing and funds unchanged');
  return {ok:true,simulated:true};
 }
 if(action==='save-capital-preview'){
  if(!['offered','draft'].includes(p.status))throw new Error('This demo application has already been submitted. Restart the financing preview to change its terms.');
  const amount=body.amount;
  if(typeof amount!=='number'||!Number.isSafeInteger(amount)||amount<previewMinimum||amount>p.maximum||amount%previewStep!==0)throw new Error('Choose an example amount from £1,000 to £20,000 in £500 steps.');
  if(typeof body.purpose!=='string'||!financingPurposes.includes(body.purpose))throw new Error('Choose a business purpose.');
  p.amount=amount;p.purpose=body.purpose;p.status='draft';
  audit(s,'Example financing terms saved',p.id,'Simulated offer selection only');
 }else if(action==='submit-capital-preview'){
  // A repeated acknowledged submission is safe and does not advance funding.
  if(!['offered','draft'].includes(p.status))return {ok:true,simulated:true};
  if(p.status!=='draft')throw new Error('Choose and save your example financing amount first.');
  if(body.detailsConfirmed!==true||body.simulationAcknowledged!==true)throw new Error('Confirm the example details and acknowledge the demo terms before submitting.');
  p.status='submitted';p.submittedAt=new Date().toISOString();p.acknowledgedAt=p.submittedAt;
  audit(s,'Demo financing application submitted',p.id,'Simulated review only; no lender application sent');
 }else if(action==='advance-capital-preview'){
  if(body.target!=='approved'&&body.target!=='funded')throw new Error('Choose the next demo stage.');
  if(p.status===body.target)return {ok:true,simulated:true};
  if(body.target==='approved'&&p.status==='submitted'){p.status='approved';p.approvedAt=new Date().toISOString();}
  else if(body.target==='funded'&&p.status==='approved'){p.status='funded';p.fundedAt=new Date().toISOString();}
  else throw new Error('Complete the preceding demo stage first.');
  audit(s,`Financing preview advanced to ${p.status}`,p.id,'Simulated only; no credit decision or deposit');
 }else if(action==='repay-capital-preview'){
  if(p.status!=='funded')throw new Error('Advance the preview to funding before showing a repayment.');
  const key=String(body.key||'');if(!/^[a-f0-9-]{36}$/i.test(key))throw new Error('A unique demo repayment reference is required.');
  if(p.repayments.some(r=>r.id===`demo_repayment_${key}`))return {ok:true,simulated:true};
  const remaining=previewTerms(p.amount).total-previewRepaid(p);
  if(remaining<=0)throw new Error('The example financing is already fully repaid.');
  if(p.repayments.length>=200)throw new Error('Restart the financing preview to show more example payments.');
  const sales=100000;const amount=Math.min(Math.round(sales*.15),remaining);
  p.repayments.unshift({id:`demo_repayment_${key}`,at:new Date().toISOString(),sales,amount,reference:`Example sales ${p.repayments.length+1}`});
  audit(s,'Example financing repayment added',p.id,'Simulation only; no payment withholding or accounting entry');
 }else throw new Error('Unknown financing preview action.');
 return {ok:true,simulated:true};
}
