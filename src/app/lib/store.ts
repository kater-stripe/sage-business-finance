import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import {newCapitalPreview,type CapitalPreview} from './capital-preview-model';

export type Audit = { id: string; at: string; action: string; object?: string; status: string; request?: string };
export type Entry = { id: string; object: string; type: string; amount: number; currency: string; reference: string; status: string; reconciliation: string; journal: string; at: string; sourceAmount: number; timeline: { at: string; status: string }[] };
export type FinanceProduct = 'payments'|'cash'|'payouts'|'issuing'|'capital';
export type PaymentOptions = {inPerson:boolean;bnpl:boolean;cash?:boolean;issuing?:boolean;supplierPayments?:boolean;payroll?:boolean};
export type Signup = {name:string;email:string;businessName:string;createdAt:string;paymentOptions?:PaymentOptions};
export type ProductRequest = {status:'requested'|'access_required';detail:string;requestedAt:string};
export type SageInvoice={id:string;customer:string;email?:string;description?:string;amount:number;status:string;session?:string;token?:string;price?:string;customerId?:string;createdAt?:string};
export type SupplierRecipient={id:string;name:string;email:string;payoutMethod?:string;last4?:string;status:string;copStatus?:string;copMessage?:string};
export type DemoEmployeeCard={id:string;holder:string;label:string;monthlyLimit:number;status:'ready'|'frozen';last4:string;createdAt:string};
export type SageStore = { capitalPreview?:CapitalPreview; agreementAcceptances?:{agreement:'account'|'cash';acceptedAt:string;version:string;urls:string[];requestId?:string}[]; cardPreview?:{enabledAt:string;cards:DemoEmployeeCard[]}; cashAccount?:string;cashAddress?:string;recipients?:SupplierRecipient[];supplierPayments?:{id:string;recipient:string;name:string;amount:number;reference:string;status:string;kind:'supplier'|'payroll';key:string}[]; nativeSections?:string[]; nativeSubmissions?:{at:string;fields:string[]}[]; signup?:Signup; onboarding?:{selectedProducts:FinanceProduct[];requests:Partial<Record<FinanceProduct,ProductRequest>>;workspaceEnteredAt?:string}; id: string; account?: string; person?: string; mode: 'api'|'embedded'; consent: boolean; price?: string; sessions: string[]; entries: Entry[]; audit: Audit[]; repairs: { id:string; object:string; reason:string; status:string }[]; pockets: Record<string,number>; probes: Record<string,{status:string; detail:string; checkedAt:string}>; invoices: SageInvoice[]; bills: {id:string; supplier:string; amount:number; status:string}[]; processedEvents: string[]; };
// The deployed image runs as a non-root user with a read-only /app directory.
// Keep existing development workspaces in place; deployments use the writable
// temporary volume unless an explicit (optionally persistent) directory is set.
// Temporary storage is instance-local and is not durable across replacements.
export const storeDirectory = process.env.SAGE_DATA_DIR || path.join(
 process.env.NODE_ENV === 'production' ? tmpdir() : process.cwd(),
 process.env.NODE_ENV === 'production' ? 'sage-business-finance' : '.sage-data',
);
const root = storeDirectory;
export async function listStoreIds():Promise<string[]> {
 try{return (await fs.readdir(root)).filter(file=>/^[a-f0-9-]{36}\.json$/.test(file)).map(file=>file.slice(0,-5));}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}
}
export function fresh(id: string = randomUUID()): SageStore { return { id, mode:'api', consent:false, sessions:[], entries:[], audit:[], repairs:[], pockets:{Operating:0,Tax:0,Payroll:0,Suppliers:0}, probes:{}, invoices:[{id:'INV-2026-1042',customer:'Northstar Design Ltd',amount:240000,status:'Awaiting payment'}], bills:[{id:'BILL-2026-018',supplier:'Oakfield Studio Ltd',amount:65000,status:'Awaiting approval'}], processedEvents:[] }; }
export async function readStore(id:string) { if(!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid demo session'); try{return JSON.parse(await fs.readFile(path.join(root,`${id}.json`),'utf8')) as SageStore;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;return fresh(id);} }
export async function saveStore(s:SageStore) {if(s.account&&s.signup&&!s.capitalPreview)s.capitalPreview=newCapitalPreview(s.id);await fs.mkdir(root,{recursive:true}); const file=path.join(root,`${s.id}.json`); const tmp=`${file}.${randomUUID()}.tmp`; await fs.writeFile(tmp,JSON.stringify(s),{mode:0o600});await fs.rename(tmp,file);}
const locks = new Map<string,Promise<unknown>>();
export async function locked<T>(id:string, fn:()=>Promise<T>):Promise<T>{const prev=locks.get(id)||Promise.resolve();const next=prev.catch(()=>{}).then(fn);locks.set(id,next);try{return await next;}finally{if(locks.get(id)===next)locks.delete(id);}}
export function audit(s:SageStore,action:string,object?:string,status='Confirmed',request?:string){s.audit.unshift({id:randomUUID(),at:new Date().toISOString(),action,object,status,request});s.audit=s.audit.slice(0,150);}
export function match(s:SageStore, object:string,type:string,amount:number,currency:string,reference:string,status:string){
 const existing=s.entries.find(x=>x.object===object);
 if(existing){ if(existing.sourceAmount!==amount || existing.currency!==currency){if(!s.repairs.some(x=>x.object===object&&x.status==='Open'))s.repairs.push({id:randomUUID(),object,reason:'Stripe amount or currency differs from the posted Sage entry. Review and post an adjustment; the original journal is preserved.',status:'Open'});existing.reconciliation='Repair required';} if(existing.status!==status){existing.status=status;existing.timeline.push({at:new Date().toISOString(),status});}return; }
 s.entries.unshift({id:randomUUID(),object,type,amount,currency,reference,status,reconciliation:'Automatically matched',journal:`JNL-${String(s.entries.length+1).padStart(5,'0')}`,at:new Date().toISOString(),sourceAmount:amount,timeline:[{at:new Date().toISOString(),status}]});audit(s,`${type} reconciled to ${reference}`,object);
}
