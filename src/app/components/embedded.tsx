'use client';
import {useMemo,useState} from 'react';
import {customerMessage} from '../lib/customer-copy';
import {customerConnect} from './connect-client';
import {ConnectComponentsProvider,ConnectAccountOnboarding,ConnectAccountManagement,ConnectNotificationBanner,ConnectPayments,ConnectPayouts} from '@stripe/react-connect-js';

export function Embedded({account,kind,onRefresh}:{account:string;kind:'onboarding'|'management'|'payments'|'payouts';onRefresh:()=>void}){
 const [error,setError]=useState('');
 const instance=useMemo(()=>customerConnect(account).instance,[account]);
 const onLoadError=({error}:{error:{message?:string}})=>setError(customerMessage(error.message||'Verification could not load. Refresh the page and try again.'));
 return <ConnectComponentsProvider connectInstance={instance}>{error&&<div className="alert error" role="alert">{error}</div>}<ConnectNotificationBanner onLoadError={onLoadError}/>{kind==='onboarding'?<ConnectAccountOnboarding collectionOptions={{fields:'currently_due',futureRequirements:'omit'}} onExit={onRefresh} onLoadError={onLoadError}/>:kind==='management'?<ConnectAccountManagement collectionOptions={{fields:'currently_due',futureRequirements:'omit'}} onLoadError={onLoadError}/>:kind==='payments'?<ConnectPayments onLoadError={onLoadError}/>:<ConnectPayouts onLoadError={onLoadError}/>}<div className="component-footer"><span>Closing this form does not confirm verification.</span><button className="btn secondary" onClick={onRefresh}>Refresh verification status</button></div></ConnectComponentsProvider>;
}
