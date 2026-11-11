import type Stripe from 'stripe';
import {stripeClient} from './stripe-service';
import {audit,match,saveStore,type SageStore} from './store';
import {serviceStatus} from './service-options';
export type FinancialAccount={id:string;status:string;display_name?:string;type:string;balance?:{available?:Record<string,{value:number}>;inbound_pending?:Record<string,{value:number}>;outbound_pending?:Record<string,{value:number}>}};
export type FinancialAddress={id:string;status:string;type?:string;settlement_currency?:string;bank_account?:{sort_code?:{account_holder_name?:string;account_number?:string;sort_code?:string}}};
export type OutboundPayment={id:string;status:string;amount:{value:number;currency:string};description?:string};
export type CashSnapshot={account:FinancialAccount|null;address:FinancialAddress|null;error?:string};
// Money Manager is preview-only; the installed stable SDK has no typed resources.
// Keep requests scoped to this customer's v2 context, never the platform balance.
export async function moneyRequest<T>(method:'GET'|'POST',path:string,body:Record<string,unknown>|undefined,context:string,key?:string):Promise<T>{return stripeClient().rawRequest(method,path,body,{apiVersion:'2026-09-30.preview',stripeContext:context,...(key?{idempotencyKey:key}:{})}) as unknown as Promise<T>;}
export async function openCash(s:SageStore,account:Stripe.V2.Core.Account|null){
 if(!s.account||!serviceStatus(s,account,'cash').ready)throw new Error('Complete the cash account verification before opening your account.');
 if(!s.cashAccount){const fa=await moneyRequest<FinancialAccount>('POST','/v2/money_management/financial_accounts',{type:'storage',storage:{holds_currencies:['gbp']},display_name:'Sage business cash',metadata:{sage_workspace:s.id}},s.account,`cash-${s.id}`);s.cashAccount=fa.id;audit(s,'Business cash account created',fa.id,fa.status);await saveStore(s);}
 // Creation can return pending. Always read the current account before requesting
 // bank details, including when recovering a previously interrupted workspace.
 const fa=await moneyRequest<FinancialAccount>('GET',`/v2/money_management/financial_accounts/${s.cashAccount}`,undefined,s.account);
 if(fa.status==='pending')return {cashSetup:'opening_account' as const};
 if(fa.status!=='open')throw new Error('Your business cash account is not available. Review its status before requesting bank details.');
 if(!s.cashAddress){
  // Recover an address created before a response/save was interrupted. The new
  // key avoids replaying the old premature request's not-open error.
  let path:string|null=`/v2/money_management/financial_addresses?financial_account=${encodeURIComponent(s.cashAccount)}&limit=50`;
  let address:FinancialAddress|undefined;
  while(path){const page:{data:FinancialAddress[];next_page_url?:string|null}=await moneyRequest<{data:FinancialAddress[];next_page_url?:string|null}>('GET',path,undefined,s.account);address=page.data.find(a=>a.type==='bank_account'&&a.settlement_currency==='gbp'&&['pending','active'].includes(a.status));if(address)break;path=page.next_page_url||null;}
  address=address||await moneyRequest<FinancialAddress>('POST','/v2/money_management/financial_addresses',{financial_account:s.cashAccount,type:'bank_account',bank_account:{currency:'gbp',country:'GB'}},s.account,`cash-address-open-v2-${s.id}`);
  s.cashAddress=address.id;audit(s,'Business cash bank details requested',address.id,address.status);await saveStore(s);
 }
 const address=await moneyRequest<FinancialAddress>('GET',`/v2/money_management/financial_addresses/${s.cashAddress}`,undefined,s.account);
 if(!['active','pending'].includes(address.status))throw new Error('Your UK bank details are unavailable. Review your cash account setup before funding it.');
 return {cashSetup:address.status==='active'?'ready' as const:'bank_details_pending' as const};
}
export async function cashSnapshot(s:SageStore):Promise<CashSnapshot>{
 if(!s.account||!s.cashAccount)return {account:null,address:null};
 const account=await moneyRequest<FinancialAccount>('GET',`/v2/money_management/financial_accounts/${s.cashAccount}`,undefined,s.account);
 const address=s.cashAddress?await moneyRequest<FinancialAddress>('GET',`/v2/money_management/financial_addresses/${s.cashAddress}`,undefined,s.account):null;
 return {account,address};
}
export async function syncMoney(s:SageStore){
 if(!s.account||!s.cashAccount)return;
 for(const recipient of s.recipients||[]){
  const current=await moneyRequest<{configuration?:{recipient?:{capabilities?:{bank_accounts?:{local?:{status:string}}}}}}>('GET',`/v2/core/accounts/${recipient.id}?include[0]=configuration.recipient`,undefined,s.account);
  recipient.status=current.configuration?.recipient?.capabilities?.bank_accounts?.local?.status||'pending';
  if(recipient.payoutMethod){const bank=await moneyRequest<{confirmation_of_payee?:{status:string;result?:{message?:string;match_result?:string}}}>('GET',`/v2/core/vault/gb_bank_accounts/${recipient.payoutMethod}`,undefined,`${s.account}/${recipient.id}`);recipient.copStatus=bank.confirmation_of_payee?.status;recipient.copMessage=bank.confirmation_of_payee?.result?.message||bank.confirmation_of_payee?.result?.match_result;}
 }
 for(const payment of s.supplierPayments||[]){const current=await moneyRequest<OutboundPayment>('GET',`/v2/money_management/outbound_payments/${payment.id}`,undefined,s.account);payment.status=current.status;
  // A requested/processing payment is not yet a posted accounting debit.
  // Failures never become a fabricated successful journal; returns are separate credits.
  const type=payment.kind==='payroll'?'Payroll payment':'Supplier payment';
  if(current.status==='posted'||current.status==='returned'){match(s,current.id,type,-current.amount.value,'gbp',payment.reference,current.status);if(current.status==='returned')match(s,`${current.id}:return`,'Business payment return',current.amount.value,'gbp',payment.reference,'Restored');}}
}
export function operationKey(value:unknown){const key=String(value||'');if(!/^[a-f0-9-]{36}$/.test(key))throw new Error('A unique operation key is required.');return key;}
export function gbpAmount(value:unknown){const amount=Number(value);if(!Number.isSafeInteger(amount)||amount<=0||amount>100000000)throw new Error('Enter a GBP amount between £0.01 and £1,000,000.');return amount;}
