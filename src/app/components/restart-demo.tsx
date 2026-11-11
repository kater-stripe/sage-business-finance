'use client';
import {useEffect,useRef,useState} from 'react';
import {motion,useReducedMotion} from 'motion/react';
import {RotateCcw,X} from 'lucide-react';
export function RestartDemo({busy,act}:{busy:boolean;act:(action:string,body?:Record<string,unknown>)=>Promise<unknown>}){
 const [open,setOpen]=useState(false);const dialog=useRef<HTMLDialogElement>(null);const reduce=useReducedMotion();
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
 return <><button className="btn secondary restart-button" disabled={busy} onClick={()=>setOpen(true)}><RotateCcw size={15}/>Restart demo</button><dialog ref={dialog} className="sage-dialog" aria-labelledby="restart-title" onCancel={()=>setOpen(false)} onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}}><motion.div initial={{opacity:0,y:reduce?0:8}} animate={{opacity:1,y:0}} className="dialog-content"><button className="icon-button dialog-close" aria-label="Close" onClick={()=>setOpen(false)}><X size={19}/></button><div className="product-icon"><RotateCcw size={22}/></div><h2 id="restart-title">Restart the demo?</h2><p>You’ll return to signup and create a new sandbox business. Your current business and its transactions will be retained, but won’t appear in the new workspace.</p><p>No real money moves. Other people’s demos are not affected.</p><div className="button-row"><button className="btn secondary" disabled={busy} onClick={()=>setOpen(false)}>Keep exploring</button><button className="btn primary" disabled={busy} onClick={async()=>{const result=await act('new-customer',{confirm:true});if(result)window.location.assign('/');}}>{busy?'Restarting…':'Restart demo'}</button></div></motion.div></dialog></>;
}
