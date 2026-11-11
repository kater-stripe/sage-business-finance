import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import {isIP} from 'node:net';
import {cashAgreement,nativeAgreement,type NativeAgreement} from '@/app/lib/native-agreements';
import Stripe from 'stripe';
import {paymentToken,validPaymentToken} from '@/app/lib/payment-link';
import { accountState, includes, paymentSnapshot, safeError, stripeClient, syncPayments } from '@/app/lib/stripe-service';
import { audit, fresh, locked, readStore, saveStore, SageStore, type FinanceProduct } from '@/app/lib/store';
import {createFinanceProfile,requestPayments,requestSelectedProduct,financeProducts} from '@/app/lib/onboarding';
import {observedSections,requirementKey} from '@/app/lib/requirements';
import {normalizeOptions,serviceStatus} from '@/app/lib/service-options';
import {cashSnapshot,openCash,syncMoney,moneyRequest,operationKey,gbpAmount,type CashSnapshot,type FinancialAddress,type OutboundPayment} from '@/app/lib/money-management';
import {requestSignupProducts} from '@/app/lib/signup-products';
import {applyCardPreviewAction,cardPreviewActions} from '@/app/lib/card-preview';
import {capitalVersion,financingOffers} from '@/app/lib/capital';
import {applyCapitalPreviewAction,capitalPreviewActions} from '@/app/lib/capital-preview';
export const runtime='nodejs';
export const dynamic='force-dynamic';

async function workspace(req:NextRequest){
 const jar=await cookies();let id=jar.get('sage_demo')?.value;
 if(!id){
  id=randomUUID();
  // Dory embeds the HTTPS preview cross-site. Lax cookies are not sent from
  // that iframe, which previously lost the Sage signup between requests.
  // Partition the secure cookie by top-level site, retaining HttpOnly and
  // the mutation Origin checks. Plain HTTP localhost keeps a Lax cookie.
  const forwardedProto=req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const secure=forwardedProto?forwardedProto==='https':req.nextUrl.protocol==='https:'||process.env.NODE_ENV==='production';
  jar.set('sage_demo',id,{httpOnly:true,sameSite:secure?'none':'lax',secure,partitioned:secure,path:'/',maxAge:60*60*24*30});
 }
 return id;
}
async function requireAccount(s:SageStore){if(!s.account)throw new Error('Create your Business Finance profile first.');return s.account;}
export async function GET(req:NextRequest,{params}:{params:Promise<{action:string}>}){
 const {action}=await params;const id=await workspace(req);return locked(id,async()=>{const s=await readStore(id);try{
  if(action==='state'){
   const account=await accountState(s);s.nativeSections=observedSections(account,s.nativeSections);let payments:Awaited<ReturnType<typeof paymentSnapshot>>|null=null;let syncError:string|undefined;
   if(s.onboarding?.workspaceEnteredAt&&account?.applied_configurations.includes('merchant')){try{await syncPayments(s);payments=await paymentSnapshot(s);}catch(e){syncError=safeError(e).error;}}
   let cash:CashSnapshot={account:null,address:null};if(s.onboarding?.workspaceEnteredAt&&s.cashAccount){try{await syncMoney(s);cash=await cashSnapshot(s);}catch(e){cash.error=safeError(e).error;}}
   await saveStore(s);return NextResponse.json({sage:s,account,payments,cash,syncError,testMode:true,apiVersion:'2026-05-27.dahlia',webhookConfigured:!!process.env.STRIPE_WEBHOOK_SECRET},{headers:{'Cache-Control':'no-store'}});
  }
  if(action==='capital'){
   const acct=await requireAccount(s);const offers=await financingOffers(acct);
   return NextResponse.json({offers,checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
  }
  if(action==='products'){const acct=await requireAccount(s);const products=await stripeClient().products.list({active:true,expand:['data.default_price']},{stripeAccount:acct});return NextResponse.json({products:products.data});}
  if(action==='checkout'){
   const sessionId=req.nextUrl.searchParams.get('session')||'';const signedAccount=req.nextUrl.searchParams.get('account')||'';const token=req.nextUrl.searchParams.get('token')||'';const signed=validPaymentToken(sessionId,signedAccount,token);if(!signed&&!s.sessions.includes(sessionId))throw new Error('Payment request not found or its secure link is invalid.');const acct=signed?signedAccount:await requireAccount(s);
   const session=await stripeClient().checkout.sessions.retrieve(sessionId,{}, {stripeAccount:acct});const business=await stripeClient().v2.core.accounts.retrieve(acct);return NextResponse.json({account:acct,businessName:business.display_name,clientSecret:session.client_secret,status:session.status,paymentStatus:session.payment_status,amount:session.amount_total,currency:session.currency});
  }
  return NextResponse.json({error:'Unknown operation'},{status:404});
 }catch(e){return NextResponse.json(safeError(e),{status:400});}});
}

export async function POST(req:NextRequest,{params}:{params:Promise<{action:string}>}){
 const {action}=await params;
 // All financial mutations must originate from this Sage UI; no cross-site form posts.
 const origin=req.headers.get('origin');if(origin&&origin!==req.nextUrl.origin&&origin!==`${req.headers.get('x-forwarded-proto')||'https'}://${req.headers.get('x-forwarded-host')||req.headers.get('host')}`)return NextResponse.json({error:'Cross-site request rejected.'},{status:403});
 const id=await workspace(req);return locked(id,async()=>{const s=await readStore(id);let probeProduct='';try{
  const body=await req.json() as Record<string,unknown>;
  if(capitalPreviewActions.has(action)){const result=applyCapitalPreviewAction(s,action,body);await saveStore(s);return NextResponse.json({...result,capitalPreview:s.capitalPreview});}
  if(cardPreviewActions.has(action)){const result=applyCardPreviewAction(s,action,body);await saveStore(s);return NextResponse.json({...result,cardPreview:s.cardPreview});}
  const stripe=stripeClient();if(action==='probe')probeProduct=String(body.product);
  if(action==='mode'){if(body.mode!=='api'&&body.mode!=='embedded')throw new Error('Choose a supported onboarding implementation.');s.mode=body.mode;audit(s,'Presenter selected onboarding',s.account,body.mode);}
  else if(action==='new-customer'){
   if(body.confirm!==true)throw new Error('Confirm you want to restart the demo. Previous business records will be retained.');
   // Rotate the workspace, not just its contents: account creation uses this UUID
   // for idempotency. Reusing it would return the first customer's old account.
   const next=fresh(randomUUID());next.mode=s.mode;await saveStore(next);
   const jar=await cookies();const forwardedProto=req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
   const secure=forwardedProto?forwardedProto==='https':req.nextUrl.protocol==='https:'||process.env.NODE_ENV==='production';
   jar.set('sage_demo',next.id,{httpOnly:true,sameSite:secure?'none':'lax',secure,partitioned:secure,path:'/',maxAge:60*60*24*30});
   return NextResponse.json({ok:true});
  }
  else if(action==='reset-local'){
   const next=fresh(id);next.account=s.account;next.person=s.person;next.mode=s.mode;next.consent=s.consent;next.price=s.price;next.sessions=s.sessions;next.probes=s.probes;next.signup=s.signup;next.onboarding=s.onboarding;next.nativeSections=s.nativeSections;next.nativeSubmissions=s.nativeSubmissions;next.agreementAcceptances=s.agreementAcceptances;audit(next,'Local Sage accounting reset; Stripe objects retained',s.account);await saveStore(next);return NextResponse.json({ok:true});
  }
  else if(action==='signup'){
   const name=String(body.name||'').trim(),email=String(body.email||'').trim().toLowerCase(),businessName=String(body.businessName||'').trim();
   if(name.length<2||name.length>100||businessName.length<2||businessName.length>150||!/^\S+@\S+\.\S+$/.test(email)||email.length>200)throw new Error('Enter a name, valid test email and business legal name.');
   if(!body.confirm)throw new Error('Confirm you are using synthetic information for this sandbox account.');
   if(s.signup&&s.account&&(s.signup.businessName!==businessName||s.signup.email!==email))throw new Error('This legal entity is already connected. Start a new test customer to use a different business.');
   if(s.account&&!s.signup){const connected=await accountState(s);if(connected?.display_name!==businessName||connected?.contact_email?.toLowerCase()!==email)throw new Error('This workspace already has a finance profile. Use its existing business name and email, or choose Start a new test customer in Demo controls.');}
   const options=body.paymentOptions as Record<string,unknown>|undefined;
   const paymentOptions=normalizeOptions(options);
   if(s.account&&s.signup?.paymentOptions&&JSON.stringify(paymentOptions)!==JSON.stringify(normalizeOptions(s.signup.paymentOptions)))throw new Error('This business profile has already been created. Restart the demo to change the initial payment selections.');
   if(body.mode!==undefined&&body.mode!=='api'&&body.mode!=='embedded')throw new Error('Choose a verification method.');
   if(body.mode)s.mode=body.mode as SageStore['mode'];
   s.signup={name,email,businessName,paymentOptions,createdAt:s.signup?.createdAt||new Date().toISOString()};
   audit(s,'Sage sandbox account created',undefined,'Local demo account; no real Sage authentication');
   // Persist the signup for retry before the external request. One idempotent
   // request creates the financial identity and initial payment capabilities.
   await saveStore(s);await createFinanceProfile(s);await requestSignupProducts(s);
  }
  else if(action==='select-products'){
   if(!s.signup)throw new Error('Create your Sage sandbox account first.');
   if(!body.consent)throw new Error('Authorise Sage to share your details for the selected financial services.');
   if(!Array.isArray(body.products)||!body.products.length||body.products.some(p=>!financeProducts.includes(p as FinanceProduct)))throw new Error('Select at least one supported financial product.');
   const selected=Array.from(new Set(body.products)) as FinanceProduct[];
   await createFinanceProfile(s);
   s.onboarding={...s.onboarding,selectedProducts:selected,requests:s.onboarding?.requests||{}};
   await saveStore(s);
   for(const product of selected){
    const previous=s.onboarding.requests[product];
    if(previous?.status==='requested')continue;
    const result=await requestSelectedProduct(s,product);s.onboarding.requests[product]=result;
    if(result.status==='access_required')s.probes[product]={status:'unavailable',detail:result.detail,checkedAt:result.requestedAt};
    audit(s,`Onboarding product selected: ${product}`,s.account,result.status==='requested'?'Requested from Stripe':result.detail);await saveStore(s);
   }
  }
  else if(action==='enter-workspace'){
   if(!s.signup||!s.account)throw new Error('Create your Sage business profile first.');
   s.onboarding??={selectedProducts:['payments'],requests:{}};
   s.onboarding.workspaceEnteredAt=new Date().toISOString();audit(s,'Sage workspace opened',s.account,'Product activation remains determined by Stripe');
  }
  else if(action==='resume-onboarding'){
   if(s.onboarding)delete s.onboarding.workspaceEnteredAt;
  }
  else if(action==='create-profile'){
   if(!body.consent)throw new Error('Confirm consent to reuse the synthetic Sage business details.');
   await createFinanceProfile(s);
  }
  else if(action==='activate-payments'){
   await requestPayments(s);
  }
  else if(action==='activate-product'){
   await requireAccount(s);const product=body.product as FinanceProduct;
   if(!['cash','payouts','issuing'].includes(product))throw new Error('Choose an available business service.');
   s.onboarding??={selectedProducts:['payments'],requests:{}};
   if(!s.onboarding.selectedProducts.includes(product))s.onboarding.selectedProducts.push(product);
   // Money-out and cash-backed cards depend on the same customer's storage
   // account, including when requested later rather than during signup.
   if(product!=='cash'&&s.onboarding.requests.cash?.status!=='requested'){
    if(!s.onboarding.selectedProducts.includes('cash'))s.onboarding.selectedProducts.push('cash');
    s.onboarding.requests.cash=await requestSelectedProduct(s,'cash');await saveStore(s);
   }
   const result=await requestSelectedProduct(s,product);s.onboarding.requests[product]=result;
   s.probes[product]={status:result.status==='requested'?'review':'unavailable',detail:result.detail,checkedAt:result.requestedAt};
   audit(s,`Service activation requested: ${product}`,s.account,result.detail);
   await saveStore(s);return NextResponse.json({ok:result.status==='requested',setupUnavailable:result.status==='access_required'});
  }
  else if(action==='capital-session'){
   const acct=await requireAccount(s);if(body.account!==acct)throw new Error('This business session has changed. Reload the page.');
   // Keep Capital preview access isolated: an unavailable financing programme
   // must never prevent ordinary verification or payments from loading.
   const session=await stripe.rawRequest('POST','/v1/account_sessions',{account:acct,components:{capital_financing_promotion:{enabled:true},capital_financing:{enabled:true}}},{apiVersion:capitalVersion}) as {client_secret:string};
   audit(s,'Secure working capital session opened',acct);await saveStore(s);return NextResponse.json({clientSecret:session.client_secret});
  }
  else if(action==='account-session'){
   const acct=await requireAccount(s);if(body.account&&body.account!==acct)throw new Error('This business session has changed. Reload the page before continuing.');
   // Only application-owned collection supports the platform-authenticated flow.
   // Legacy Stripe-owned accounts keep Stripe authentication; never override it.
   const current=await accountState(s);const applicationCollection=current?.defaults?.responsibilities?.requirements_collector==='application';
   const collectionFeatures={external_account_collection:true,...(applicationCollection?{disable_stripe_user_authentication:true}:{})};
   const session=await stripe.accountSessions.create({account:acct,components:{account_onboarding:{enabled:true,features:collectionFeatures},account_management:{enabled:true,features:collectionFeatures},notification_banner:{enabled:true,features:collectionFeatures},payments:{enabled:true,features:{refund_management:true,dispute_management:true,capture_payments:true}},balances:{enabled:true,features:{...collectionFeatures,instant_payouts:false,standard_payouts:true}},payouts:{enabled:true,features:{...collectionFeatures,instant_payouts:false,standard_payouts:true}}}});
   audit(s,'Secure embedded session opened',acct);await saveStore(s);return NextResponse.json({clientSecret:session.client_secret});
  }
  else if(action==='native-submit'){
   const acct=await requireAccount(s);const account=await accountState(s);const outstanding=account?.requirements?.entries?.filter(e=>e.awaiting_action_from==='user')||[];
   const values=body.values as Record<string,string>;if(!values||typeof values!=='object'||Array.isArray(values))throw new Error('Enter the requested information.');if(body.sameOwner!==undefined&&typeof body.sameOwner!=='boolean')throw new Error('Confirm sole ownership using the checkbox in the Sage form.');
   s.nativeSections=observedSections(account,s.nativeSections);const submittedKeys:string[]=[];
   // A requirement may clear between the displayed form and this request.
   // Acknowledge a duplicate only when this workspace has a real saved receipt
   // for every exact field/resource and Stripe no longer asks for those fields.
   const receiptFields=new Set((s.nativeSubmissions||[]).flatMap(receipt=>receipt.fields));
   const inputKeys=Object.keys(values).filter(key=>typeof values[key]==='string'&&values[key]!=='');
   const currentEntries=account?.requirements?.entries||[];
   if(!body.sameOwner&&inputKeys.length&&inputKeys.every(key=>receiptFields.has(key)&&!currentEntries.some(entry=>requirementKey(entry)===key&&(entry.awaiting_action_from==='user'||entry.errors.length>0))))return NextResponse.json({ok:true,alreadySubmitted:true,submittedFields:inputKeys});
   // Only accept fields that Stripe currently requests. Never accept an arbitrary account update from the client.
   const business:Record<string,unknown>={};const personUpdates=new Map<string,Record<string,unknown>>();const newPeople=new Map<string,Record<string,unknown>>();const soleOwnerDetails:Record<string,unknown>={};const config:Record<string,unknown>={};const agreements=new Set<NativeAgreement>();
   // Validate consent before any writes. One checkbox never accepts a different
   // agreement, and client-provided dates/IPs are never treated as evidence.
   for(const entry of outstanding){const key=entry.description;const val=values[requirementKey(entry)]??values[key];if(val===undefined||val==='')continue;if(key.includes('terms_of_service')||key.includes('tos_acceptance')){const agreement=nativeAgreement(key);if(!agreement)throw new Error('This agreement requires the secure embedded form on the same business profile.');if(val!=='true')throw new Error('Explicit acceptance is required for each agreement.');agreements.add(agreement);}}
   if(agreements.has('cash')){if(account?.identity?.country?.toLowerCase()!=='gb')throw new Error('Native business cash acceptance is available only for UK business accounts. Use the embedded form for this account.');if(body.cashAgreementVersion!==cashAgreement.version)throw new Error('The cash agreement has changed. Refresh the Sage form, review the terms and accept them again.');}
   const acceptanceIp=agreements.size?req.headers.get('x-forwarded-for')?.split(',')[0]?.trim():undefined;const acceptanceAgent=req.headers.get('user-agent');
   if(agreements.size&&(!acceptanceIp||!isIP(acceptanceIp)||!acceptanceAgent))throw new Error('Agreement acceptance needs your browser details and a verified client IP. Reload Sage using its secure preview or deployed URL and try again.');
   // Business/bank/terms sections do not need a separate people API call.
   const needsPeople=Object.keys(values).some(key=>/^(?:identity\.)?(?:person|representative|individual|directors|owners)\./.test(key));
   const people=needsPeople?await stripe.v2.core.accounts.persons.list(acct):{data:[]};
   const roleTargets:Record<string,string>={};for(const p of people.data){if(p.relationship?.representative)roleTargets.representative=p.id;if(p.relationship?.director)roleTargets.directors=p.id;if(p.relationship?.owner)roleTargets.owners=p.id;}
   if(body.sameOwner&&s.person)roleTargets.owners=s.person;
   const set=(obj:Record<string,unknown>,path:string,value:unknown)=>{const parts=path.split('.');let cursor=obj;for(const key of parts.slice(0,-1)){if(['__proto__','constructor','prototype'].includes(key))throw new Error('Invalid field');cursor[key]??={};cursor=cursor[key] as Record<string,unknown>;}cursor[parts.at(-1)!]=value;};
   for(const entry of outstanding){const key=entry.description;const val=values[`${key}|${entry.reference?.resource||''}`]??values[key];if(val===undefined||val==='')continue;if(typeof val!=='string')throw new Error('Each field must contain a text value.');submittedKeys.push(requirementKey(entry));
    if(key.includes('tos_acceptance')||key.includes('terms_of_service'))continue;
    const personKey=key.match(/^(?:identity\.)?(person|representative|individual|directors|owners)\.(.+)$/);const role=personKey?.[1];const ref=entry.reference?.type==='person'?entry.reference.resource:(role?roleTargets[role]:undefined);
    if(personKey){const p=personKey[2];if(!/^(given_name|surname|email|phone|address\.(line1|line2|city|postal_code|country|state)|date_of_birth\.(day|month|year)|relationship\.title)$/.test(p))throw new Error('This personal detail needs secure collection. Use the embedded form for this check.');
     const value=p.startsWith('date_of_birth')?Number(val):val;
     if(ref){const obj=personUpdates.get(ref)||{};set(obj,p,value);personUpdates.set(ref,obj);}
     else if(role==='owners'&&body.sameOwner){set(soleOwnerDetails,p,value);}
     else if(role==='directors'||role==='representative'||role==='owners'){const obj=newPeople.get(role)||{};set(obj,p,value);newPeople.set(role,obj);}
     else throw new Error(role==='owners'?'Add a beneficial owner, or explicitly confirm that the director is the sole beneficial owner, then save again.':'Add or reuse a director or representative before saving these personal details.');
    }else if(/^identity\.business_details\.(registered_name|phone|address\.(line1|line2|city|postal_code|country|state))$/.test(key)){set(business,key,val);}
    else if(key==='identity.business_details.id_numbers.gb_crn'){set(business,'identity.business_details.id_numbers',[{type:'gb_crn',value:val}]);}
    else if(/^identity\.attestations\.persons_provided\.(directors|owners|executives)$/.test(key)){set(business,key,val==='true');}
    else if(key==='external_account'){const bank=JSON.parse(val);if(!/^\d{6}$/.test(bank.sortCode)||!/^\d{8}$/.test(bank.accountNumber))throw new Error('Enter a six-digit UK sort code and eight-digit test account number.');await stripe.accounts.createExternalAccount(acct,{external_account:{object:'bank_account',country:'GB',currency:'gbp',account_holder_name:'Greenway Consulting Ltd',account_holder_type:'company',routing_number:bank.sortCode,account_number:bank.accountNumber}});}
    else if(/^defaults\.profile\.(product_description|business_url|doing_business_as)$/.test(key)){set(business,key,val);}
    else if(/^configuration\.merchant\.(mcc|support\.(phone|email|url))$/.test(key)){set(config,key,val);}
    else throw new Error(`Secure collection or preview access is required for ${key}. Continue in the embedded onboarding experience on this same account.`);
   }
   if(!submittedKeys.length&&!body.sameOwner)throw new Error('No new information was submitted. Enter a requested field, or refresh the verification status if you already submitted this section.');
   const identity=business.identity as {business_details?:{address?:Record<string,unknown>}}|undefined;if(identity?.business_details?.address)identity.business_details.address.country='gb';
   for(const payload of [...personUpdates.values(),...newPeople.values(),soleOwnerDetails]){if(payload.address)(payload.address as Record<string,unknown>).country='gb';}
   if(body.sameOwner&&!s.person&&!newPeople.has('directors')&&!newPeople.has('representative'))throw new Error('Add or reuse a director before confirming sole ownership. Your entries have been kept.');
   // Generic role requirements have reference:null before a Person exists. Save
   // them as actual scoped Persons, rather than requiring a separate reuse click.
   // Only the requested/submitted role is assigned. Owner percentage and the
   // declaration that all owners were provided are never inferred.
   for(const [role,payload]of newPeople){
    const data={...payload,relationship:{...(payload.relationship as Record<string,unknown>||{}),[role==='directors'?'director':role==='owners'?'owner':'representative']:true}};
    let person;
    try{person=await stripe.v2.core.accounts.persons.create(acct,data as Parameters<typeof stripe.v2.core.accounts.persons.create>[1],{idempotencyKey:`sage-native-person-${s.id}-${role}`});}
    catch(error){
     // Stripe, not a matching name or a checkbox default, identifies an existing
     // identical person. Confirm account ownership before adding the requested role.
     const duplicate=error as {code?:string;message?:string};if(duplicate.code!=='duplicate_person_not_allowed')throw error;
     const existing=duplicate.message?.match(/Person is identical to (person_[A-Za-z0-9_]+)/)?.[1];if(!existing)throw new Error('These details already belong to a person on this business. Reuse that person or review the details before saving.');
     await stripe.v2.core.accounts.persons.retrieve(acct,existing);
     person=await stripe.v2.core.accounts.persons.update(acct,existing,data as Parameters<typeof stripe.v2.core.accounts.persons.update>[2]);
    }
    roleTargets[role]=person.id;if(role!=='owners'&&(!s.person||role==='representative'))s.person=person.id;audit(s,'Requested business person saved',person.id,role);await saveStore(s);
   }
   if(body.sameOwner&&s.person){await stripe.v2.core.accounts.persons.update(acct,s.person,{relationship:{owner:true,percent_ownership:Stripe.Decimal.from('100')}});if(Object.keys(soleOwnerDetails).length){const existing=personUpdates.get(s.person)||{};personUpdates.set(s.person,{...existing,...soleOwnerDetails});}}
   // Persist person information before attesting that all people are provided.
   // Sending the account declaration first can reject while those people are
   // still incomplete, even though the user's combined form has all the data.
   for(const [person,payload]of personUpdates)await stripe.v2.core.accounts.persons.update(acct,person,payload as Parameters<typeof stripe.v2.core.accounts.persons.update>[2]);
   if(Object.keys(business).length||Object.keys(config).length)await stripe.v2.core.accounts.update(acct,{...business,...config} as Stripe.V2.Core.AccountUpdateParams);
   if(agreements.size){
    const date=new Date().toISOString();const evidence={date,ip:acceptanceIp!,user_agent:acceptanceAgent!};const terms={...(agreements.has('account')?{account:evidence}:{}),...(agreements.has('cash')?{money_manager:evidence}:{})};
    // money_manager is the actual preview API name; the installed stable SDK
    // still calls this storer. Never send the older SDK field on this preview.
    const accepted=agreements.has('cash')?await stripe.rawRequest('POST',`/v2/core/accounts/${acct}`,{identity:{attestations:{terms_of_service:terms}}},{apiVersion:'2026-09-30.preview'}):await stripe.v2.core.accounts.update(acct,{identity:{attestations:{terms_of_service:{account:evidence}}}});
    s.agreementAcceptances??=[];for(const agreement of agreements){s.agreementAcceptances.push({agreement,acceptedAt:date,version:agreement==='cash'?cashAgreement.version:'stripe-ssa-v1',urls:agreement==='cash'?[cashAgreement.termsUrl,cashAgreement.connectedUrl]:['https://stripe.com/gb/legal/ssa'],requestId:accepted.lastResponse?.requestId});audit(s,agreement==='cash'?'UK business cash agreement accepted':'Stripe Services Agreement accepted',acct,'Explicit consent recorded by Stripe',accepted.lastResponse?.requestId);}
   }
   s.nativeSubmissions=[{at:new Date().toISOString(),fields:submittedKeys},...(s.nativeSubmissions||[])].slice(0,20);
   // Acknowledging the accepted writes does not require another account read.
   // The UI records Submitted and polls authoritative requirements separately.
   audit(s,'Requirement information submitted to Stripe',acct,'Saved to Stripe; completion follows actual refreshed requirements');
   await saveStore(s);return NextResponse.json({ok:true,submittedFields:submittedKeys});
  }
  else if(action==='add-representative'){
   const acct=await requireAccount(s);if(!s.person){const person=await stripe.v2.core.accounts.persons.create(acct,{given_name:s.signup?.name.split(' ')[0]||'Jane',surname:s.signup?.name.split(' ').slice(1).join(' ')||'Doe',email:s.signup?.email||'jane.doe@example.com',relationship:{representative:true,director:true,executive:true,title:'Director'},metadata:{synthetic:'true'}});s.person=person.id;audit(s,'Known Sage director reused',person.id);}
  }
  else if(action==='add-person'){
   const acct=await requireAccount(s);const role=String(body.role);if(!['owner','director','representative','executive'].includes(role))throw new Error('Choose a recognised business relationship.');const given=String(body.given||'').trim(),surname=String(body.surname||'').trim();if(!given||!surname)throw new Error('Enter a synthetic first and last name.');const percent=Number(body.percent);if(role==='owner'&&(!Number.isFinite(percent)||percent<=0||percent>100))throw new Error('Provide an ownership percentage between 0 and 100.');const person=await stripe.v2.core.accounts.persons.create(acct,{given_name:given,surname,relationship:{[role]:true,...(role==='owner'?{percent_ownership:Stripe.Decimal.from(percent)}:{}),title:String(body.title||'')},metadata:{synthetic:'true'}});audit(s,`${role} added for verification`,person.id);if(role==='representative')s.person=person.id;
  }
  else if(action==='create-invoice'){
   const acct=await requireAccount(s);const key=operationKey(body.key);const invoiceId=`INV-${key.slice(0,8).toUpperCase()}`;
   if(s.invoices.some(i=>i.id===invoiceId))return NextResponse.json({ok:true,invoice:invoiceId});
   const customer=String(body.customer||'').trim(),email=String(body.email||'').trim(),description=String(body.description||'').trim();const amount=gbpAmount(body.amount);
   if(customer.length<2||customer.length>150||!/^\S+@\S+\.\S+$/.test(email)||email.length>200||!description||description.length>250)throw new Error('Enter an example company name, valid email, description and invoice amount.');
   const opts={stripeAccount:acct};const client=await stripe.customers.create({name:customer,email,metadata:{sage_legal_entity:'sage_le_123',synthetic:'true'}},{...opts,idempotencyKey:`invoice-customer-${s.id}-${key}`});
   const product=await stripe.products.create({name:description,description:`${invoiceId} for ${customer}`,metadata:{sage_invoice:invoiceId,sage_legal_entity:'sage_le_123'}},{...opts,idempotencyKey:`invoice-product-${s.id}-${key}`});
   const price=await stripe.prices.create({product:product.id,unit_amount:amount,currency:'gbp'},{...opts,idempotencyKey:`invoice-price-${s.id}-${key}`});
   s.invoices.unshift({id:invoiceId,customer,email,description,amount,status:'Awaiting payment',price:price.id,customerId:client.id,createdAt:new Date().toISOString()});audit(s,'Invoice created',invoiceId);await saveStore(s);return NextResponse.json({ok:true,invoice:invoiceId});
  }
  else if(action==='create-request'){
   const acct=await requireAccount(s);const account=await accountState(s);if(account?.configuration?.merchant?.capabilities?.card_payments?.status!=='active')throw new Error('Payments are not active. Complete the outstanding verification requirements first.');
   const invoice=s.invoices.find(i=>i.id===body.invoice)||(!body.invoice?s.invoices[0]:undefined);if(!invoice)throw new Error('Choose an invoice in this workspace.');
   if(invoice.status!=='Awaiting payment')throw new Error('This invoice has already received a payment. Create a new invoice instead.');
   const latest=invoice.session;if(latest){const existing=await stripe.checkout.sessions.retrieve(latest,{}, {stripeAccount:acct});if(existing.status==='open'){invoice.token=paymentToken(existing.id,acct);await saveStore(s);return NextResponse.json({session:existing.id,account:acct,token:invoice.token});}if(existing.payment_status==='paid')throw new Error('This invoice payment has been received. Refresh to reconcile it before creating another request.');}
   // Historical invoices retain their original price. New invoices each own an
   // immutable account-scoped product and price matching their entered amount.
   if(!invoice.price){if(invoice.id==='INV-2026-1042'&&s.price)invoice.price=s.price;else{const product=await stripe.products.create({name:invoice.description||`Services — ${invoice.id}`,description:`Services for ${invoice.customer}`,metadata:{sage_invoice:invoice.id,sage_legal_entity:'sage_le_123'}},{stripeAccount:acct,idempotencyKey:`product-${s.id}-${invoice.id}`});const price=await stripe.prices.create({product:product.id,unit_amount:invoice.amount,currency:'gbp'},{stripeAccount:acct,idempotencyKey:`price-${s.id}-${invoice.id}`});invoice.price=price.id;}await saveStore(s);}
   const session=await stripe.checkout.sessions.create({ui_mode:'elements',mode:'payment',payment_method_types:['card'],line_items:[{price:invoice.price,quantity:1}],...(invoice.customerId?{customer:invoice.customerId}:{customer_email:invoice.email||'accounts@northstar.example.com'}),client_reference_id:invoice.id,metadata:{sage_invoice:invoice.id,sage_legal_entity:'sage_le_123'},payment_intent_data:{metadata:{sage_invoice:invoice.id,sage_legal_entity:'sage_le_123'}},automatic_tax:{enabled:false}},{stripeAccount:acct,idempotencyKey:`checkout-${s.id}-${s.sessions.length}`});s.sessions.push(session.id);invoice.session=session.id;invoice.token=paymentToken(session.id,acct);audit(s,'Invoice payment request created',session.id);await saveStore(s);return NextResponse.json({session:session.id,account:acct,token:invoice.token});
  }
  else if(action==='open-cash'){
   const setup=await openCash(s,await accountState(s));await saveStore(s);return NextResponse.json({ok:true,...setup});
  }
  else if(action==='fund-cash'){
   const acct=await requireAccount(s);const key=operationKey(body.key);const amount=gbpAmount(body.amount);if(body.confirm!==true)throw new Error('Confirm you want to add sandbox test funds.');
   const cash=await cashSnapshot(s);if(cash.account?.status!=='open'||cash.address?.status!=='active')throw new Error('Your cash account and bank details must be active before adding test funds.');
   const credit=await moneyRequest<{id:string}>('POST',`/v2/money_management/test_helpers/financial_addresses/${cash.address.id}/credit`,{amount:{value:amount,currency:'gbp'},network:'fps'},acct,`fund-${s.id}-${key}`);audit(s,'Sandbox cash funding requested',credit.id,'Test credit requested; balance follows actual settlement');
  }
  else if(action==='add-recipient'){
   const acct=await requireAccount(s);const key=operationKey(body.key);if(!serviceStatus(s,await accountState(s),'payouts').ready)throw new Error('Complete supplier payment verification first.');
   const name=String(body.name||'').trim(),email=String(body.email||'').trim(),sortCode=String(body.sortCode||'').replace(/[- ]/g,''),number=String(body.accountNumber||'');
   if(name.length<2||name.length>150||!/^\S+@\S+\.\S+$/.test(email)||!/^\d{6}$/.test(sortCode)||!/^\d{8}$/.test(number)||body.confirm!==true)throw new Error('Enter synthetic UK supplier details and confirm they are test data.');
   const recipient=await moneyRequest<{id:string;configuration?:{recipient?:{capabilities?:{bank_accounts?:{local?:{status:string}}}}}}>('POST','/v2/core/accounts',{display_name:name,contact_email:email,identity:{country:'gb',entity_type:'company',business_details:{registered_name:name}},configuration:{recipient:{capabilities:{bank_accounts:{local:{requested:true}}}}},include:['configuration.recipient','requirements']},acct,`recipient-${s.id}-${key}`);
   s.recipients??=[];let saved=s.recipients.find(r=>r.id===recipient.id);if(!saved){saved={id:recipient.id,name,email,status:recipient.configuration?.recipient?.capabilities?.bank_accounts?.local?.status||'pending'};s.recipients.push(saved);await saveStore(s);}
   const bank=await moneyRequest<{id:string;last4:string;confirmation_of_payee?:{status:string}}>('POST','/v2/core/vault/gb_bank_accounts',{sort_code:sortCode,account_number:number,currency:'gbp',confirmation_of_payee:{initiate:true}},`${acct}/${recipient.id}`,`recipient-bank-${s.id}-${key}`);
   saved.payoutMethod=bank.id;saved.last4=bank.last4;saved.copStatus=bank.confirmation_of_payee?.status;audit(s,'Supplier recipient created',recipient.id,saved.status);
  }
  else if(action==='acknowledge-recipient'){
   const acct=await requireAccount(s);const recipient=s.recipients?.find(r=>r.id===body.recipient);if(!recipient?.payoutMethod||body.confirm!==true)throw new Error('Review and confirm the supplier bank details first.');
   const bank=await moneyRequest<{confirmation_of_payee?:{status:string}}>('POST',`/v2/core/vault/gb_bank_accounts/${recipient.payoutMethod}/acknowledge_confirmation_of_payee`,{},`${acct}/${recipient.id}`);recipient.copStatus=bank.confirmation_of_payee?.status;audit(s,'Supplier bank match result acknowledged',recipient.id);
  }
  else if(action==='pay-supplier'){
   const acct=await requireAccount(s);const key=operationKey(body.key);if(s.supplierPayments?.some(p=>p.key===key))return NextResponse.json({ok:true});
   const amount=gbpAmount(body.amount),reference=String(body.reference||'').trim();const recipient=s.recipients?.find(r=>r.id===body.recipient);if(!recipient?.payoutMethod||!reference||reference.length>100||body.confirm!==true)throw new Error('Choose a supplier, enter a reference and confirm the payment.');
   const account=await accountState(s);if(!serviceStatus(s,account,'payouts').ready)throw new Error('Supplier payments are not active. Review verification first.');const cash=await cashSnapshot(s);if(cash.account?.status!=='open')throw new Error('An open business cash account is required.');if(amount>(cash.account.balance?.available?.gbp?.value||0))throw new Error('Insufficient available business cash. Add funds before making this payment.');
   const payment=await moneyRequest<OutboundPayment>('POST','/v2/money_management/outbound_payments',{from:{financial_account:s.cashAccount,currency:'gbp'},to:{recipient:recipient.id,payout_method:recipient.payoutMethod,currency:'gbp'},amount:{value:amount,currency:'gbp'},description:reference,recipient_notification:{setting:'none'}},acct,`supplier-payment-${s.id}-${key}`);
   s.supplierPayments??=[];s.supplierPayments.unshift({id:payment.id,recipient:recipient.id,name:recipient.name,amount,reference,status:payment.status,kind:body.kind==='payroll'?'payroll':'supplier',key});audit(s,'Business payment requested',payment.id,payment.status);
  }
  else if(action==='refund'){
   const acct=await requireAccount(s);const object=String(body.payment||'');const entry=s.entries.find(e=>e.object===object&&e.type==='Invoice payment');if(!entry)throw new Error('Select a confirmed invoice payment.');const amount=Number(body.amount);if(!Number.isSafeInteger(amount)||amount<=0||amount>entry.amount)throw new Error('Enter a valid refund amount in pence.');const key=String(body.key||'');if(!/^[a-f0-9-]{36}$/.test(key))throw new Error('A unique operation key is required.');const refund=await stripe.refunds.create({payment_intent:object,amount,metadata:{sage_invoice:entry.reference,sage_legal_entity:'sage_le_123'}},{stripeAccount:acct,idempotencyKey:`refund-${key}`});audit(s,'Refund requested',refund.id,refund.status||'pending');await syncPayments(s);
  }
  else if(action==='dispute-evidence'){
   const acct=await requireAccount(s);const disputeId=String(body.dispute);const disputes=await stripe.disputes.list({limit:100},{stripeAccount:acct});if(!disputes.data.some(d=>d.id===disputeId))throw new Error('Dispute not found.');const evidence=String(body.evidence||'').trim();if(evidence.length<20||evidence.length>10000)throw new Error('Provide a factual explanation between 20 and 10,000 characters.');const d=await stripe.disputes.update(disputeId,{evidence:{uncategorized_text:evidence},submit:true},{stripeAccount:acct});audit(s,'Dispute evidence submitted',d.id,d.status);
  }
  else if(action==='pockets'){
   const acct=await requireAccount(s);if(s.probes.cash?.status!=='active')throw new Error('A real active Business Cash Account is required before allocating funds.');throw new Error('Financial Account balance has not yet been confirmed for this programme. No allocations have been changed.');
  }
  else if(action==='repair'){
   const repair=s.repairs.find(r=>r.id===body.id);if(!repair)throw new Error('Repair case not found.');if(!body.confirm)throw new Error('Confirm review of the Stripe source and Sage journal.');repair.status='Reviewed — adjustment required';audit(s,'Repair reviewed; original journal retained',repair.object,repair.status);
  }
  else if(action==='refresh'){await syncPayments(s);audit(s,'Authoritative Stripe state refreshed',s.account);}
  else if(action==='probe'){await requireAccount(s); // Product access is checked against the actual configured API, never inferred from empty UI data.
   const product=String(body.product);let result:unknown;
   if(product==='cash'){result=await stripe.rawRequest('POST',`/v2/core/accounts/${s.account}`,{configuration:{money_manager:{capabilities:{business_storage:{inbound:{gbp:{requested:true}},outbound:{gbp:{requested:true}}}}}},include:['configuration.money_manager','requirements']},{apiVersion:'2026-09-30.preview'});}
   else if(product==='issuing'){throw new Error('UK Issuing programme onboarding is required. Enrol the existing platform through the Add Account to Issuing Program Offering scenario before requesting Card Creator capabilities.');}
   else if(product==='capital'){result=await stripe.rawRequest('GET',`/v1/capital/financing_offers?connected_account=${s.account}`,undefined,{apiVersion:'2026-09-30.preview'});}
   else if(product==='payouts'){result=await stripe.rawRequest('GET','/v2/money_management/outbound_payments?limit=1',undefined,{apiVersion:'2026-09-30.preview',stripeAccount:s.account});}
   else throw new Error('Unknown product');
   s.probes[product]={status:'review',detail:'Stripe accepted the request. Product access is not active until its capabilities and programme eligibility are confirmed.',checkedAt:new Date().toISOString()};audit(s,`Product access checked: ${product}`,s.account,'Stripe request accepted');void result;
  }
  else if(action==='withdraw'){
   const acct=await requireAccount(s);const amount=Number(body.amount);if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('Enter a positive amount in pence.');const banks=await stripe.accounts.listExternalAccounts(acct,{object:'bank_account'});const bank=banks.data.find(b=>b.id===body.bank&&'status'in b&&['verified','validated'].includes(b.status||''));if(!bank)throw new Error('Select a verified business bank account.');const balance=await stripe.balance.retrieve({},{stripeAccount:acct});const available=balance.available.find(b=>b.currency==='gbp')?.amount||0;const buffer=Math.max(0,Number(body.buffer)||0);if(amount>available-buffer)throw new Error('Withdrawal exceeds available Payments funds after your retained buffer.');const key=String(body.key);if(!/^[a-f0-9-]{36}$/.test(key))throw new Error('A unique operation key is required.');const payout=await stripe.payouts.create({amount,currency:'gbp',destination:bank.id,metadata:{sage_legal_entity:'sage_le_123',flow:'own_bank_withdrawal'}},{stripeAccount:acct,idempotencyKey:`withdraw-${key}`});audit(s,'Own-bank withdrawal requested',payout.id,payout.status);
  }
  else return NextResponse.json({error:'Unknown operation'},{status:404});
  await saveStore(s);return NextResponse.json({ok:true});
 }catch(e){const error=safeError(e);if(probeProduct)s.probes[probeProduct]={status:'unavailable',detail:error.error,checkedAt:new Date().toISOString()};audit(s,`${action} not completed`,s.account,error.error,error.requestId);await saveStore(s);return NextResponse.json(error,{status:400});}});
}
