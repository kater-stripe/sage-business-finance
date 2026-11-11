'use client';
import {loadConnectAndInitialize} from '@stripe/connect-js';

type RiskEvent={status:'completed'|'skipped'|'failed';skippedReason?:string;error?:{type:string;message?:string}};
type Listener=(event:RiskEvent)=>void;
type ConnectEntry={instance:ReturnType<typeof loadConnectAndInitialize>;listeners:Set<Listener>;event?:RiskEvent};
const connections=new Map<string,ConnectEntry>();

// One real Connect.js initialization per customer, shared with embedded verification.
// The installed loader forwards extra init options to Connect.js. The documented
// private-preview callback is not yet declared in this version's public types.
export function customerConnect(account:string,purpose:'verification'|'capital'='verification'){
 const connectionKey=purpose==='capital'?`${account}:capital`:account;
 const existing=connections.get(connectionKey);if(existing)return existing;
 const listeners=new Set<Listener>();
 const options:Parameters<typeof loadConnectAndInitialize>[0]&{onRiskSignalsCollection:Listener}={
  publishableKey:process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
  fetchClientSecret:async()=>{
   const res=await fetch(purpose==='capital'?'/api/sage/capital-session':'/api/sage/account-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account})});
   const data=await res.json();if(!res.ok)throw new Error(data.error||'Secure verification could not start.');return data.clientSecret;
  },
  onRiskSignalsCollection:event=>{const entry=connections.get(connectionKey);if(entry)entry.event=event;for(const listener of listeners)listener(event);},
  appearance:{overlays:'dialog',variables:{colorPrimary:'#045c19',colorBackground:'#ffffff',colorText:'#101b16',colorSecondaryText:'#69766f',borderRadius:'16px',formBorderRadius:'10px',buttonBorderRadius:'24px',buttonPrimaryColorBackground:'#00d639',buttonPrimaryColorBorder:'#00d639',buttonPrimaryColorText:'#00320d',buttonSecondaryColorBackground:'#ffffff',buttonSecondaryColorBorder:'#cbd4ce',buttonSecondaryColorText:'#101b16',spacingUnit:'10px'}},
 };
 const entry:ConnectEntry={instance:loadConnectAndInitialize(options),listeners};connections.set(connectionKey,entry);return entry;
}
