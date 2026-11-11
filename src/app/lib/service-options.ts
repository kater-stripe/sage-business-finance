import type Stripe from 'stripe';
import type {FinanceProduct,PaymentOptions,SageStore} from './store';

export function normalizeOptions(options?:Partial<PaymentOptions>|null):Required<PaymentOptions>{
 const issuing=options?.issuing===true,supplierPayments=options?.supplierPayments===true,payroll=options?.payroll===true;
 return {inPerson:options?.inPerson===true,bnpl:options?.bnpl===true,cash:options?.cash===true||issuing||supplierPayments||payroll,issuing,supplierPayments,payroll};
}
export function signupProducts(options?:PaymentOptions):FinanceProduct[]{
 const o=normalizeOptions(options);
 return ['payments',...(o.cash?['cash' as const]:[]),...(o.issuing?['issuing' as const]:[]),...(o.supplierPayments||o.payroll?['payouts' as const]:[])];
}
type CapabilityNode={status?:string;[key:string]:unknown};
export type FinanceAccount=Stripe.V2.Core.Account&{configuration?:NonNullable<Stripe.V2.Core.Account['configuration']>&{money_manager?:{capabilities?:{business_storage?:{inbound?:{gbp?:CapabilityNode};outbound?:{gbp?:CapabilityNode}};outbound_payments?:{bank_accounts?:CapabilityNode};received_credits?:{bank_accounts?:CapabilityNode};outbound_transfers?:{bank_accounts?:CapabilityNode}}};card_creator?:{capabilities?:{commercial?:CapabilityNode}}}};
export function serviceStatus(s:SageStore,account:Stripe.V2.Core.Account|null|undefined,product:'cash'|'issuing'|'payouts'):{label:string;tone:string;ready:boolean}{
 const request=s.onboarding?.requests[product];
 if(!request)return {label:'Not set up',tone:'neutral',ready:false};
 if(request.status==='access_required')return {label:'Setup unavailable',tone:'amber',ready:false};
 const config=(account as FinanceAccount|null|undefined)?.configuration;
 const statuses:string[]=[];
 const collect=(node:unknown)=>{if(!node||typeof node!=='object')return;const value=node as CapabilityNode;if(typeof value.status==='string'){statuses.push(value.status);return;}for(const child of Object.values(value))collect(child);};
 if(product==='cash'){collect(config?.money_manager?.capabilities?.business_storage?.inbound?.gbp);collect(config?.money_manager?.capabilities?.business_storage?.outbound?.gbp);collect(config?.money_manager?.capabilities?.received_credits?.bank_accounts);collect(config?.money_manager?.capabilities?.outbound_transfers?.bank_accounts);}
 if(product==='payouts')collect(config?.money_manager?.capabilities?.outbound_payments?.bank_accounts);
 if(product==='issuing')collect(config?.card_creator?.capabilities?.commercial);
 const storage=config?.money_manager?.capabilities?.business_storage;
 const storageReady=storage?.inbound?.gbp?.status==='active'&&storage?.outbound?.gbp?.status==='active';
 const ownReady=statuses.length>0&&statuses.every(status=>status==='active')&&(product!=='cash'||storageReady);
 // Outgoing payments/cards also depend on eligible business cash. An active
 // outbound bank capability alone does not complete the selected service.
 const ready=ownReady&&(product==='cash'||serviceStatus(s,account,'cash').ready);
 const reviewing=statuses.includes('pending')||account?.requirements?.entries?.some(entry=>entry.awaiting_action_from==='stripe');
 return {label:ready?'Verification complete':reviewing?'Under review':'Setup pending',tone:ready?'green':'amber',ready};
}
