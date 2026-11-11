'use client';
import {useEffect,useRef,useState} from 'react';
import {customerConnect} from './connect-client';

export function useNativeRiskSignals(account:string|undefined,required:boolean,onRefresh?:()=>Promise<void>){
 const [state,setState]=useState<'checking'|'sent'|'failed'|'skipped'>('checking');
 const refresh=useRef(onRefresh);refresh.current=onRefresh;
 useEffect(()=>{
  if(!account||!required)return;
  setState('checking');
  const connection=customerConnect(account);
  const listener:Parameters<typeof connection.listeners.add>[0]=event=>{
   setState(event.status==='completed'?'sent':event.status==='failed'?'failed':'skipped');
   // A callback reports collection, not capability activation. Always retrieve
   // authoritative requirements before marking this check complete.
   if(event.status==='completed'||event.skippedReason==='requirement_fulfilled')void refresh.current?.();
  };
  connection.listeners.add(listener);if(connection.event)listener(connection.event);
  // Also support Connect.js versions that collect signals but omit the callback.
  const timers=[2500,6000,12000,25000,45000].map(delay=>setTimeout(()=>void refresh.current?.(),delay));
  return()=>{connection.listeners.delete(listener);timers.forEach(clearTimeout);};
 },[account,required]);
 return state;
}
