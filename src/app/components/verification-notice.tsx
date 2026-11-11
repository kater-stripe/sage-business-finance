import {Clock3} from 'lucide-react';

export function VerificationNotice({needsAction=false,onReview}:{needsAction?:boolean;onReview?:()=>void}){
 return <section className="verification-notice" role="status" aria-live="polite"><div className="verification-notice-icon"><Clock3 size={24}/></div><div><h3>Some checks are running.</h3><p>This status updates automatically and can take a few minutes.</p><p>{needsAction?'Some information still needs your attention. Complete the outstanding requests while the other checks continue.':'You don’t need to do anything or submit your details again. You can keep exploring Sage while we check your information.'}</p>{needsAction&&onReview&&<button className="text-btn" onClick={onReview}>Review outstanding information →</button>}</div></section>;
}
