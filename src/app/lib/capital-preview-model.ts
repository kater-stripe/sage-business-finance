export type CapitalPreviewStatus='offered'|'draft'|'submitted'|'approved'|'funded';
export type CapitalPreview={
 id:string;simulated:true;createdAt:string;maximum:number;amount:number;purpose:string;status:CapitalPreviewStatus;
 submittedAt?:string;approvedAt?:string;fundedAt?:string;acknowledgedAt?:string;
 repayments:{id:string;at:string;amount:number;sales:number;reference:string}[];
};
export const previewMinimum=100000;
export const previewStep=50000;
export function newCapitalPreview(workspace:string):CapitalPreview{return {id:`demo_financing_${workspace}`,simulated:true,createdAt:new Date().toISOString(),maximum:2000000,amount:2000000,purpose:'Working capital',status:'offered',repayments:[]};}
export function previewTerms(amount:number){const fee=Math.round(amount*.10);return {amount,fee,total:amount+fee,withholdRate:.15,illustrativeWeeks:26};}
export function previewRepaid(preview:CapitalPreview){return preview.repayments.reduce((sum,item)=>sum+item.amount,0);}
export const financingPurposes=['Working capital','Business expansion','Equipment','Marketing','Inventory'];
