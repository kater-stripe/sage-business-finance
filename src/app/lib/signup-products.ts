import {requestSelectedProduct} from './onboarding';
import {signupProducts} from './service-options';
import {audit,saveStore,type SageStore} from './store';

// Persist the account before starting independent product requests. Repeating
// signup reuses the identity and accepted requests, even if another product fails.
export async function requestSignupProducts(s:SageStore){
 if(!s.account)throw new Error('Create your business profile first.');
 const selected=signupProducts(s.signup?.paymentOptions);
 s.onboarding??={selectedProducts:['payments'],requests:{}};
 s.onboarding.selectedProducts=Array.from(new Set([...s.onboarding.selectedProducts,...selected]));
 await saveStore(s);
 for(const product of selected){
  if(product==='payments'||s.onboarding.requests[product]?.status==='requested')continue;
  const result=await requestSelectedProduct(s,product);
  s.onboarding.requests[product]=result;
  s.probes[product]={status:result.status==='requested'?'review':'unavailable',detail:result.detail,checkedAt:result.requestedAt};
  audit(s,`Signup service requested: ${product}`,s.account,result.detail);
  await saveStore(s);
 }
}
