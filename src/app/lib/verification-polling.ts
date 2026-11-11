export const verificationWindowMs=90000;
type PollingState={onboarding:boolean;needsChecking:boolean;startedAt:number;refreshFailed:boolean};
// This shortens detection latency only, never the verification decision itself.
// Back off on errors and after a bounded burst to avoid perpetual rapid reads.
export function verificationPollDelay(state:PollingState,now=Date.now()){
 const elapsed=now-state.startedAt;
 if(!state.onboarding||!state.needsChecking||state.refreshFailed||!state.startedAt||elapsed<0||elapsed>=verificationWindowMs)return 15000;
 return elapsed<20000?1500:3000;
}
