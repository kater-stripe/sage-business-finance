import type Stripe from 'stripe';
import type {SageStore} from './store';
import {requirementKey} from './requirements';

export function paymentVerificationState(sage:SageStore,account:Stripe.V2.Core.Account|null|undefined,now=Date.now()){
 const capability=account?.configuration?.merchant?.capabilities?.card_payments;
 const active=capability?.status==='active';
 const entries=account?.requirements?.entries||[];
 // Receipts mean saved, not verified. Only suppress a request briefly when its
 // exact resource/field was accepted and Stripe has not returned an error.
 const saved=new Set((sage.nativeSubmissions||[]).filter(receipt=>{const age=now-Date.parse(receipt.at);return age>=0&&age<300000;}).flatMap(receipt=>receipt.fields));
 const user=entries.filter(entry=>entry.awaiting_action_from==='user');
 const contactRequired=capability?.status_details?.some(detail=>detail.resolution==='contact_stripe')||false;
 const needsAction=contactRequired||user.some(entry=>entry.errors.length>0||!saved.has(requirementKey(entry)));
 const reviewing=entries.some(entry=>entry.awaiting_action_from==='stripe');
 const waiting=!!account&&!active&&!contactRequired&&(reviewing||!needsAction||user.some(entry=>!entry.errors.length&&saved.has(requirementKey(entry))));
 return {active,waiting,needsAction};
}
