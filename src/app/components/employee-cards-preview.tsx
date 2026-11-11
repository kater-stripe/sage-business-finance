'use client';
import {useRef,useState} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'motion/react';
import {ArrowRight,FlaskConical,Plus,Snowflake,WalletCards} from 'lucide-react';
import type {DemoEmployeeCard,SageStore} from '../lib/store';

type Act=(action:string,body?:Record<string,unknown>)=>Promise<Record<string,unknown>|null>;
const gbp=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n/100);

function PreviewCard({card,busy,act}:{card:DemoEmployeeCard;busy:boolean;act:Act}){
 const [limit,setLimit]=useState(String(card.monthlyLimit/100));
 return <article className="employee-preview-card">
  <div className={`demo-card-face ${card.status==='frozen'?'is-frozen':''}`}>
   <div className="demo-card-top"><img src="/brand/sage.svg" alt="Sage"/><span>EMPLOYEE CARD<br/>DEMO ONLY</span></div>
   <strong className="demo-card-label">{card.label}</strong>
   <span className="demo-card-digits" aria-label={`Demo card ending ${card.last4}`}>•••• &nbsp;•••• &nbsp;•••• &nbsp;{card.last4}</span>
   <div className="demo-card-bottom"><span>{card.holder}</span><span>{card.status==='frozen'?<><Snowflake size={14}/>Frozen · preview</>:'Ready · preview'}</span></div>
   <small>Not a payment card</small>
  </div>
  <div className="demo-card-controls"><div className="live-panel-heading"><h3>{card.holder}</h3><button className="btn secondary" disabled={busy} onClick={()=>void act('update-demo-card',{card:card.id,status:card.status==='frozen'?'ready':'frozen'})}><Snowflake size={15}/>{card.status==='frozen'?'Unfreeze demo card':'Freeze demo card'}</button></div><p>Monthly limit: <strong>{gbp(card.monthlyLimit)}</strong> · Simulated control</p>
   <form className="demo-limit-form" onSubmit={async e=>{e.preventDefault();await act('update-demo-card',{card:card.id,monthlyLimit:Math.round(Number(limit)*100)});}}><label>Monthly limit (GBP)<input type="number" required min="1" max="100000" step="0.01" value={limit} onChange={e=>setLimit(e.target.value)}/></label><button className="btn secondary" disabled={busy||Math.round(Number(limit)*100)===card.monthlyLimit}>Save limit</button></form>
  </div>
 </article>;
}

export function EmployeeCardsPreview({sage,busy,act}:{sage:SageStore;busy:boolean;act:Act}){
 const cards=sage.cardPreview?.cards||[];const [open,setOpen]=useState(cards.length===0);const [holder,setHolder]=useState(sage.signup?.name||'Jane Doe');const [label,setLabel]=useState('Travel & everyday expenses');const [limit,setLimit]=useState('500');const [confirm,setConfirm]=useState(false);const key=useRef(crypto.randomUUID());const reduce=useReducedMotion();
 return <section className="panel employee-cards-preview section-gap" aria-label="Employee cards preview">
  <div className="panel-title"><div><span className="eyebrow">TEAM SPENDING</span><h2><WalletCards size={22}/>Employee cards</h2><p>Create and manage example cards for your team.</p></div><span className="badge amber"><span/>Simulated preview</span></div>
  <div className="card-preview-disclosure"><FlaskConical size={19}/><p><strong>Preview only — no real cards are issued.</strong> Card details and controls are simulated. They cannot make payments, and no cash balance or financial activity is changed.</p></div>
  <div className="preview-card-toolbar"><strong>{cards.length} demo {cards.length===1?'card':'cards'}</strong><button className="btn primary" disabled={busy} aria-expanded={open} onClick={()=>setOpen(!open)}><Plus size={16}/>{open?'Close card form':'Create demo card'}</button></div>
  <AnimatePresence>{open&&<motion.form className="finance-form demo-card-composer" initial={{height:reduce?'auto':0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:reduce?'auto':0,opacity:0}} onSubmit={async e=>{e.preventDefault();const result=await act('create-demo-card',{holder,label,monthlyLimit:Math.round(Number(limit)*100),confirm,key:key.current});if(result?.ok){key.current=crypto.randomUUID();setConfirm(false);setOpen(false);}}}>
   <div className="finance-fields"><label>Example employee name<input required minLength={2} maxLength={100} value={holder} onChange={e=>setHolder(e.target.value)}/></label><label>Card label<input required maxLength={60} value={label} onChange={e=>setLabel(e.target.value)}/></label><label>Monthly limit (GBP)<input required type="number" min="1" max="100000" step="0.01" value={limit} onChange={e=>setLimit(e.target.value)}/></label></div>
   <div className="finance-form-footer"><label className="finance-consent demo-card-consent"><input type="checkbox" checked={confirm} required onChange={e=>setConfirm(e.target.checked)}/>Use synthetic employee details to create a non-payment demo card.</label><button className="btn primary" disabled={busy||!confirm}>Create demo card<ArrowRight size={16}/></button></div>
  </motion.form>}</AnimatePresence>
  {cards.length>0&&<div className="employee-preview-grid">{cards.map(card=><PreviewCard key={card.id} card={card} busy={busy} act={act}/>)}</div>}
 </section>;
}
