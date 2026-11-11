import {stripeClient} from './stripe-service';
import type {FinancingOffer} from './capital-model';

// Capital API reference: docs/content/api-reference/2026-08-26-preview/
// resources-mp/capital-financing-offer.md. Preview endpoints are not in this SDK.
export const capitalVersion='2026-09-30.preview; embedded_connect_beta=v2';
export async function financingOffers(account:string){
 const query=new URLSearchParams({connected_account:account,limit:'100'});
 const result=await stripeClient().rawRequest('GET',`/v1/capital/financing_offers?${query}`,undefined,{apiVersion:capitalVersion}) as {data:FinancingOffer[]};
 // Never show another entity's financing or live-mode objects.
 if(result.data.some(offer=>offer.livemode||offer.account!==account))throw new Error('Financing response did not match this sandbox business.');
 return result.data.map(({id,account,livemode,status,created,expires_after,financing_type,offered_terms,accepted_terms})=>({id,account,livemode,status,created,expires_after,financing_type,offered_terms:offered_terms?{advance_amount:offered_terms.advance_amount,fee_amount:offered_terms.fee_amount,currency:offered_terms.currency,withhold_rate:offered_terms.withhold_rate}:undefined,accepted_terms:accepted_terms?{advance_amount:accepted_terms.advance_amount,fee_amount:accepted_terms.fee_amount,currency:accepted_terms.currency,withhold_rate:accepted_terms.withhold_rate}:undefined})).sort((a,b)=>b.created-a.created);
}
