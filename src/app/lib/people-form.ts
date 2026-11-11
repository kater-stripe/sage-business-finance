import {requirementKey,type Requirement} from './requirements';

// Only identity/contact fields can share an input. Documents, attestations and
// ownership percentages must always keep their own explicit controls.
export function personField(description:string){
 return /^(?:identity\.)?(?:person|representative|individual|directors|owners)\.(given_name|surname|email|phone|address\.(line1|line2|city|postal_code|country|state)|date_of_birth\.(day|month|year)|relationship\.title)$/.exec(description)?.[1]??null;
}
export function sharedPersonFields(fields:Requirement[],values:Record<string,string>){
 const people=fields.filter(r=>personField(r.description));
 const targets=new Set(people.map(r=>r.reference?.resource||''));
 // Never merge distinct existing Persons, or an existing Person with an
 // unassigned role. A provider-confirmed identity match remains server-side.
 const canShare=people.length>0&&targets.size===1&&people.every(r=>!r.reference||r.reference.type==='person');
 const grouped=new Map<string,Requirement[]>();
 for(const r of people){const suffix=personField(r.description)!;grouped.set(suffix,[...(grouped.get(suffix)||[]),r]);}
 const compatible=Array.from(grouped.values()).every(rs=>new Set(rs.map(r=>values[requirementKey(r)]).filter(Boolean)).size<=1);
 const roles=Array.from(new Set(people.map(r=>r.description.replace(/^identity\./,'').split('.')[0]).map(role=>({directors:'Director',owners:'Beneficial owner',representative:'Representative',person:'Person',individual:'Individual'})[role]||role)));
 return {canShare:canShare&&compatible,grouped,roles};
}
