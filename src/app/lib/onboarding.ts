import type Stripe from 'stripe';
import {includes, stripeClient, safeError} from './stripe-service';
import {audit,saveStore,type SageStore,type FinanceProduct,type ProductRequest} from './store';

export const financeProducts:FinanceProduct[]=['payments','cash','payouts','issuing','capital'];
export async function createFinanceProfile(s:SageStore){
 if(s.account)return s.account;
 const profile=s.signup;
 // New customers use UA-3: Sage owns fees, Payments losses and requirements.
 // With dashboard none, application-owned requirements are derived by Stripe.
 // These traits are immutable once configured; existing accounts are never migrated.
 const account=await stripeClient().v2.core.accounts.create({display_name:profile?.businessName||'Greenway Consulting Ltd',contact_email:profile?.email||'jane.doe@example.com',identity:{country:'gb',entity_type:'company',business_details:{registered_name:profile?.businessName||'Greenway Consulting Ltd',structure:'private_corporation'}},dashboard:'none',configuration:{merchant:{mcc:'7392',capabilities:{card_payments:{requested:true},...(profile?.paymentOptions?.bnpl?{klarna_payments:{requested:true}}:{})}}},defaults:{currency:'gbp',locales:['en-GB'],responsibilities:{fees_collector:'application',losses_collector:'application'},profile:{product_description:'Synthetic sandbox business providing management consulting and business planning services to UK businesses.'}},metadata:{sage_legal_entity:'sage_le_123',sage_workspace:s.id,synthetic:'true'},include:includes},{idempotencyKey:`sage-profile-${s.id}`});
 if(account.livemode)throw new Error('Live-mode account rejected.');
 s.account=account.id;s.consent=true;
 s.onboarding={...s.onboarding,selectedProducts:['payments'],requests:{...s.onboarding?.requests,payments:{status:'requested',requestedAt:new Date().toISOString(),detail:'Customer payments requested. Complete your business verification to start accepting payments.'}}};
 audit(s,'Business profile and payment capabilities created',account.id,'Requested; capability status determines availability',account.lastResponse.requestId);
 // Persist identity before requesting products so retries always reuse this account.
 await saveStore(s);return account.id;
}
export async function requestPayments(s:SageStore){
 if(!s.account)throw new Error('Create your finance profile first.');
 const account=await stripeClient().v2.core.accounts.update(s.account,{dashboard:'none',defaults:{currency:'gbp',profile:{product_description:'Synthetic sandbox business providing management consulting and business planning services to UK businesses.'}},configuration:{merchant:{mcc:'7392',capabilities:{card_payments:{requested:true},...(s.signup?.paymentOptions?.bnpl?{klarna_payments:{requested:true}}:{})}}},include:includes});
 audit(s,'Payments activation requested',s.account,'Awaiting Stripe capability confirmation',account.lastResponse.requestId);return account;
}
export async function requestSelectedProduct(s:SageStore,product:FinanceProduct):Promise<ProductRequest>{
 const requestedAt=new Date().toISOString();
 try{
  if(product==='payments'){
   await requestPayments(s);
   return {status:'requested',requestedAt,detail:'Payments capability requested. Business verification and activation status are retrieved from Stripe below.'};
  }
  if(product==='cash'){
   // UK Money Manager programme is preview-only. A rejection is an access blocker, never invented KYC.
   await stripeClient().rawRequest('POST',`/v2/core/accounts/${s.account}`,{configuration:{money_manager:{capabilities:{business_storage:{inbound:{gbp:{requested:true}},outbound:{gbp:{requested:true}}},received_credits:{bank_accounts:{requested:true}},outbound_transfers:{bank_accounts:{requested:true}}}}},include:['configuration.money_manager','requirements']},{apiVersion:'2026-09-30.preview'});
   return {status:'requested',requestedAt,detail:'GBP Money Manager capabilities requested. Programme eligibility and current requirements must be confirmed by Stripe.'};
  }
  if(product==='issuing'){
   // The UK FA-backed flow requires a matched platform program, which requests
   // card_creator automatically. Never guess a bank-specific capability, choose
   // an opaque default offering, or associate an unverified credit/US program.
   const programs=await stripeClient().rawRequest('GET','/v1/issuing/programs',undefined,{apiVersion:'2026-09-30.preview; issuing_program_beta=v2'}) as Stripe.Response<{data:{id:string}[]}>;
   return {status:'access_required',requestedAt,detail:programs.data?.length?'Issuing programme access checked. A verified UK GBP commercial cash-backed platform programme must be confirmed before associating it with this customer. No card capability or card has been created.':'Issuing programme access checked. No platform programme is available; UK GBP commercial cash-backed programme enrollment is required before requesting card verification. No card has been created.'};
  }
  if(product==='payouts'){
   await stripeClient().rawRequest('POST',`/v2/core/accounts/${s.account}`,{configuration:{money_manager:{capabilities:{business_storage:{inbound:{gbp:{requested:true}},outbound:{gbp:{requested:true}}},outbound_payments:{bank_accounts:{requested:true}}}}},include:['configuration.money_manager','requirements']},{apiVersion:'2026-09-30.preview'});
   return {status:'requested',requestedAt,detail:'UK bank-account outbound payment capability requested on the customer account. Supplier and payroll payments need completed verification, eligible funded customer cash and actual recipients. No recipient or payment has been created.'};
  }
  if(product==='capital'){
   const result=await stripeClient().rawRequest('GET',`/v1/capital/financing_offers?connected_account=${s.account}`,undefined,{apiVersion:'2026-09-30.preview'}) as Stripe.Response<{data:unknown[]}>;
   return {status:'requested',requestedAt,detail:result.data?.length?'Stripe returned financing offers. Programme-supported acceptance is required; no financing has been accepted.':'Eligibility checked with Stripe. No offers returned. Financing selection does not itself create an offer or additional KYC requirements.'};
  }
  throw new Error('Choose a supported product.');
 }catch(error){return {status:'access_required',requestedAt,detail:safeError(error).error};}
}
