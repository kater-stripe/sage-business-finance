import type Stripe from 'stripe';
export type Requirement=NonNullable<NonNullable<Stripe.V2.Core.Account['requirements']>['entries']>[number];
const labels:Record<string,string>={given_name:'First name',surname:'Last name',line1:'Street address',line2:'Address line 2',postal_code:'Postcode',city:'Town or city',gb_crn:'Company registration number',phone:'Phone number',email:'Email address',business_url:'Business website',product_description:'Description of services',title:'Job title',day:'Day of birth',month:'Month of birth',year:'Year of birth',directors:'All directors have been provided',owners:'All beneficial owners have been provided',executives:'All executives have been provided'};
export function requirementLabel(key:string){if(key==='risk_signals.session_metadata')return 'Secure session verification';if(key==='external_account')return 'Business bank account';if(/terms_of_service\.(storer|money_manager)\./.test(key))return 'Business cash account agreement';if(key.includes('terms_of_service.account.'))return 'Accept the Stripe Services Agreement';if(key.includes('terms_of_service'))return 'Financial service agreement';if(key.includes('documents'))return 'Verification document';if(key==='identity.business_details.phone')return 'Business phone number';if(key==='configuration.merchant.support.phone')return 'Customer support phone number';return labels[key.split('.').at(-1)!]||key.split('.').slice(-2).join(' ').replaceAll('_',' ');}
export function requirementGroup(key:string){if(key.startsWith('risk_signals.'))return 'Secure verification';if(key.includes('documents'))return 'Verification documents';if(/^(person|representative|owners|directors)\./.test(key))return 'People & ownership';if(key.includes('attestations'))return 'Declarations & terms';if(key==='external_account')return 'Business bank account';return 'Business information';}
export function requirementKey(r:Requirement){return `${r.description}|${r.reference?.resource||''}`;}
export const sectionOrder=['Business information','People & ownership','Business bank account','Declarations & terms','Verification documents','Secure verification'];
export function orderedSections(sections:string[]){return Array.from(new Set(sections)).sort((a,b)=>sectionOrder.indexOf(a)-sectionOrder.indexOf(b));}
export function observedSections(account:Stripe.V2.Core.Account|null,previous:string[]=[]){
 const sections=[...previous,...(account?.requirements?.entries||[]).map(r=>requirementGroup(r.description))];
 // Existing workspaces can already have saved business details before section
 // history was introduced. Read their presence from Stripe, not a local flag.
 const business=account?.identity?.business_details;
 if(business?.address&&business.phone&&account?.defaults?.profile?.business_url)sections.push('Business information');
 return orderedSections(sections);
}
export function accountFieldValue(account:Stripe.V2.Core.Account|null|undefined,key:string):string{
 if(!account||! /^(identity\.business_details\.|defaults\.profile\.|configuration\.merchant\.)/.test(key)||key.includes('documents'))return '';
 // Stripe does not return identification-number values. Keep their in-memory
 // draft on retry instead of attempting to read or persist a redacted number.
 if(key==='identity.business_details.id_numbers.gb_crn')return '';
 let current:unknown=account;for(const segment of key.split('.')){if(!current||typeof current!=='object')return '';current=(current as Record<string,unknown>)[segment];}
 return typeof current==='string'?current:'';
}
