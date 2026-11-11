import Stripe from 'stripe';
import { initializeStripe } from '@/utils/initialize-stripe';
import { audit, match, SageStore } from './store';
export const includes: Stripe.V2.Core.AccountRetrieveParams.Include[] = ['identity','defaults','requirements','configuration.merchant','configuration.customer','configuration.recipient'];
export function stripeClient(){const key=process.env.STRIPE_SECRET_KEY;if(!key?.startsWith('sk_test_'))throw new Error('A Stripe sandbox test key is required.');return initializeStripe(key,{apiVersion:'2026-05-27.dahlia',maxNetworkRetries:2});}
export async function accountState(s:SageStore){
 if(!s.account)return null;
 if(s.onboarding?.requests.cash?.status==='requested'||s.onboarding?.requests.payouts?.status==='requested'){
  // Money Manager is only exposed on the preview API. Include its real status
  // after an accepted request; never infer activation from the request receipt.
  // The installed stable SDK lacks this preview-only include enum value.
  const previewIncludes=[...includes,'configuration.money_manager'];
  const query=new URLSearchParams(previewIncludes.map((value,index)=>[`include[${index}]`,value]));
  return stripeClient().rawRequest('GET',`/v2/core/accounts/${s.account}?${query}`,undefined,{apiVersion:'2026-09-30.preview'}) as Promise<Stripe.Response<Stripe.V2.Core.Account>>;
 }
 return stripeClient().v2.core.accounts.retrieve(s.account,{include:includes});
}
export function safeError(e:unknown){const err=e as {message?:string;code?:string;requestId?:string;statusCode?:number};return {error:err.message?.replace(/(?:sk|pk)_(?:test|live)_[A-Za-z0-9_]+/g,'[redacted]').replace(/cs_\w+_secret_\w+/g,'[redacted]')||'The operation could not be completed.',code:err.code,requestId:err.requestId,status:err.statusCode};}
export async function syncPayments(s:SageStore){
 if(!s.account)return;const stripe=stripeClient();const opts={stripeAccount:s.account};
 for(const id of s.sessions){
  const session=await stripe.checkout.sessions.retrieve(id,{expand:['payment_intent.latest_charge.balance_transaction']},opts);
  const invoice=s.invoices.find(i=>i.id===session.metadata?.sage_invoice);const pi=typeof session.payment_intent==='object'?session.payment_intent:null;
  if(invoice && session.payment_status==='paid' && pi?.status==='succeeded'){
   if(session.amount_total!==invoice.amount || session.currency!=='gbp' || session.metadata?.sage_legal_entity!=='sage_le_123') {if(!s.repairs.some(x=>x.object===id))s.repairs.push({id,object:id,reason:'Payment amount, currency or legal entity does not match the Sage invoice.',status:'Open'});continue;}
   invoice.status='Paid';invoice.session=id;
   match(s,pi.id,'Invoice payment',pi.amount_received,'gbp',invoice.id,'Successful');
   const charge=typeof pi.latest_charge==='object'?pi.latest_charge:null;
   const bt=charge&&typeof charge.balance_transaction==='object'?charge.balance_transaction:null;
   if(bt){match(s,bt.id,'Payment fee',-bt.fee,'gbp',invoice.id,bt.status==='available'?'Available':'Pending settlement');}
   if(charge){
    const refunds=await stripe.refunds.list({charge:charge.id,limit:30},opts);
    for(const refund of refunds.data){match(s,refund.id,'Refund',-refund.amount,refund.currency,invoice.id,refund.status||'pending');}
    // A refund is a separate credit journal; it never deletes the original receipt.
    if(charge.amount_refunded===charge.amount)invoice.status='Refunded';else if(charge.amount_refunded>0)invoice.status='Partially refunded';
   }
  }
 }
 const disputes=await stripe.disputes.list({limit:20},opts);
 for(const dispute of disputes.data){const chargeId=typeof dispute.charge==='string'?dispute.charge:dispute.charge.id; const charge=await stripe.charges.retrieve(chargeId,{},opts);const ref=charge.metadata?.sage_invoice||'Needs review';match(s,dispute.id,'Dispute',-dispute.amount,dispute.currency,ref,dispute.status);if(dispute.status==='won')match(s,`${dispute.id}:restoration`,'Dispute restoration',dispute.amount,dispute.currency,ref,'Restored');}
}
export async function paymentSnapshot(s:SageStore){
 if(!s.account)return {balance:null,transactions:[],disputes:[],events:[],banks:[]};const stripe=stripeClient();const opts={stripeAccount:s.account};
 const [balance,transactions,disputes,events,banks]=await Promise.all([stripe.balance.retrieve({},opts),stripe.balanceTransactions.list({limit:40},opts),stripe.disputes.list({limit:20},opts),stripe.events.list({limit:15},opts),stripe.accounts.listExternalAccounts(s.account,{object:'bank_account',limit:10})]);
 return {balance,transactions:transactions.data.map(t=>({id:t.id,type:t.type,amount:t.amount,fee:t.fee,net:t.net,currency:t.currency,status:t.status,created:t.created,available_on:t.available_on,source:typeof t.source==='string'?t.source:t.source?.id})),disputes:disputes.data.map(d=>({id:d.id,amount:d.amount,currency:d.currency,status:d.status,reason:d.reason,evidence_due:d.evidence_details.due_by})),events:events.data.map(e=>({id:e.id,type:e.type,created:e.created,object:'id' in e.data.object ? e.data.object.id : undefined})),banks:banks.data.map(b=>({id:b.id,last4:'last4'in b?b.last4:'',currency:b.currency,status:'status'in b?b.status:'',bank_name:'bank_name'in b?b.bank_name:''}))};
}
export async function recordFailure(s:SageStore, action:string,e:unknown){const error=safeError(e);audit(s,action,undefined,error.error,error.requestId);return error;}
