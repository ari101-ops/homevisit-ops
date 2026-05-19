"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// Table IDs
const TBL = { dispatch:"tblXo8sbDFGNIHm7m", visits:"tbldVxHUiEkE1EAsA", bw:"tbllZtKNM9C9Nkgh6", labs:"tblVLuUCcH8laUmWg" };

// API helpers
async function apiGet(table) {
  let all = []; let offset = null;
  do {
    const url = `/api/airtable?table=${table}&pageSize=100${offset?`&offset=${offset}`:''}`;
    const r = await fetch(url); const d = await r.json();
    if (d.records) all = all.concat(d.records);
    offset = d.offset || null;
  } while (offset);
  return all;
}
async function apiCreate(table, fields) {
  const r = await fetch('/api/airtable', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({table,records:[{fields}]}) });
  const d = await r.json(); return d.records?.[0];
}
async function apiUpdate(table, id, fields) {
  const r = await fetch('/api/airtable', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({table,records:[{id,fields}],action:'update'}) });
  return await r.json();
}

// Map Airtable records to app format
function mapStop(r) { const f=r.fields||{}; return {id:r.id,address:f["Address"]||"",visitDate:f["Visit Date"]||"",timeWindow:f["Time Window"]||"",tech:f["Assigned Tech"]||"",status:f["Dispatch Status"]?.name||f["Dispatch Status"]||"Draft",type:f["Visit Type"]?.name||f["Visit Type"]||"",notes:f["Dispatch Notes"]||"",onfleetId:f["Onfleet Task ID"]||"",_raw:f}}
function mapVisit(r) { const f=r.fields||{}; const reasons = f["Visit Reason"]||f["Reason for Visit"]||[]; const mappedReasons = Array.isArray(reasons)?reasons.map(r=>r.name||r):[]; const dv=f["Related Dispatch Visit"]||[]; return {id:r.id,name:f["Patient Name"]||"",dob:f["DOB"]||"",phone:f["Phone Number"]||"",insurance:f["Insurance Provider"]||"",memberId:f["Insurance Member ID"]||"",reasons:mappedReasons,status:f["Visit Ops Status"]?.name||f["Visit Ops Status"]||"New Intake",stopId:dv[0]?.id||"",notes:f["Dispatch Notes"]||"",bwCaseId:(f["Related Case"]||[])[0]?.id||"",_raw:f}}
function mapLab(r) { const f=r.fields||{}; return {id:r.id,patientName:f["Patient Name"]||"",labType:f["Lab Type"]?.name||f["Lab Type"]||"",address:f["Address"]||"",status:f["Office Status"]?.name||f["Office Status"]||"Needs Req Form",printed:!!f["Req Form Printed"],sent:!!f["Sent to Lab"],results:!!f["Results Back"],reviewed:!!f["Results Reviewed"],_raw:f}}
function mapBW(r) { const f=r.fields||{}; return {id:r.id,patient:f["Patient Name"]||"",tests:Array.isArray(f["Tests Requested"])?f["Tests Requested"].map(t=>t.name||t).join(", "):(f["Tests Requested"]||""),tubes:f["Tube Summary"]||"",status:f["Work Flow Status"]?.name||f["Work Flow Status"]||"Intake",techInstructions:f["Tech Instruction Line"]||"",_raw:f}}

// Constants
const VISIT_REASONS = ["Sore Throat","Strep Test","Fever","UTI / Urinary Symptoms","Flu / COVID Symptoms","Ear Pain","Sinus / Congestion","Cough / Bronchitis","Rash / Skin Issue","Wound Care","Eye Infection","Headache / Migraine","Stomach / GI Issue","Vomiting / Nausea","Allergic Reaction","Injection / IV","Blood Pressure Check","Follow Up Visit","Bloodwork","Other"];
const LAB_TYPES = ["RPP","Strep Culture","Urine Culture","Throat Culture","Other"];
const TECHS = ["Moshe","Yossi","David","Sarah"];
const DS = ["Draft","Ready to Dispatch","Sent to Onfleet","Assigned","Active","Completed","Failed"];
const VS = ["New Intake","Ready","In Field","Needs Lab Paperwork","Needs Registration","Waiting for Results","Closed"];
const BWS = ["Intake","Ready for Draw","Drawn","Blood Spun","Sent to Lab","Waiting for Results","Follow Up Due","Follow Up Done","Results Sent to PCP","Completed"];
const LS = ["Needs Req Form","Req Form Printed","Sent to Lab","Results Back","Reviewed","Closed"];
const RC = {"Sore Throat":"#fca5a5","Strep Test":"#f87171","Fever":"#fdba74","UTI / Urinary Symptoms":"#fde68a","Flu / COVID Symptoms":"#fb923c","Ear Pain":"#93c5fd","Sinus / Congestion":"#60a5fa","Cough / Bronchitis":"#67e8f9","Rash / Skin Issue":"#f9a8d4","Wound Care":"#f472b6","Eye Infection":"#c4b5fd","Headache / Migraine":"#a78bfa","Stomach / GI Issue":"#86efac","Vomiting / Nausea":"#4ade80","Allergic Reaction":"#5eead4","Injection / IV":"#2dd4bf","Blood Pressure Check":"#d1d5db","Follow Up Visit":"#9ca3af","Bloodwork":"#3b82f6","Other":"#6b7280"};
const SC = {"Draft":"#94a3b8","Ready to Dispatch":"#eab308","Sent to Onfleet":"#3b82f6","Assigned":"#a855f7","Active":"#f97316","Completed":"#22c55e","Failed":"#ef4444","New Intake":"#94a3b8","Ready":"#3b82f6","In Field":"#f97316","Needs Lab Paperwork":"#ef4444","Needs Registration":"#eab308","Waiting for Results":"#a855f7","Closed":"#6b7280","Intake":"#94a3b8","Ready for Draw":"#3b82f6","Drawn":"#8b5cf6","Blood Spun":"#a855f7","Sent to Lab":"#3b82f6","Follow Up Due":"#f97316","Follow Up Done":"#22c55e","Results Sent to PCP":"#14b8a6","Needs Req Form":"#ef4444","Req Form Printed":"#eab308","Results Back":"#a855f7","Reviewed":"#22c55e"};
const lt = c => ["#fde68a","#fdba74","#86efac","#d1d5db","#fca5a5","#f9a8d4","#67e8f9","#5eead4","#eab308","#4ade80","#94a3b8","#e2e8f0"].includes(c);

// UI Components
const B = ({l,c}) => {const bg=c||SC[l]||"#94a3b8";return <span style={{background:bg,color:lt(bg)?"#1e293b":"#fff",padding:"2px 9px",borderRadius:99,fontSize:11,fontWeight:600,whiteSpace:"nowrap",display:"inline-block",margin:"1px 2px"}}>{l}</span>};
const Pills = ({r}) => !r?.length?null:<div style={{display:"flex",flexWrap:"wrap",gap:2}}>{r.map((x,i)=><B key={i} l={x} c={RC[x]}/>)}</div>;
const Cd = ({children,s,onClick}) => <div onClick={onClick} style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:14,marginBottom:8,cursor:onClick?"pointer":"default",...s}}>{children}</div>;
const Inp = ({label,value,onChange,type="text",placeholder,s}) => <div style={{marginBottom:8,...s}}>{label&&<label style={{display:"block",fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3}}>{label}</label>}<input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"7px 10px",border:"1px solid #cbd5e1",borderRadius:6,fontSize:13,outline:"none",boxSizing:"border-box"}} /></div>;
const Sel = ({label,value,onChange,options,ph}) => <div style={{marginBottom:8}}>{label&&<label style={{display:"block",fontSize:11,fontWeight:600,color:"#64748b",marginBottom:3}}>{label}</label>}<select value={value||""} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"7px 10px",border:"1px solid #cbd5e1",borderRadius:6,fontSize:13,background:"#fff"}}><option value="">{ph||"Select..."}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></div>;
const Bt = ({children,onClick,v="primary",s,disabled}) => {const st={primary:{background:"#1e40af",color:"#fff",border:"none"},secondary:{background:"#f1f5f9",color:"#334155",border:"1px solid #e2e8f0"},danger:{background:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca"},success:{background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0"},warning:{background:"#fffbeb",color:"#d97706",border:"1px solid #fde68a"}};return <button onClick={onClick} disabled={disabled} style={{padding:"7px 14px",borderRadius:6,fontSize:12,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,...st[v],...s}}>{children}</button>};
const MS = ({label,selected,onChange,options}) => {const toggle=o=>selected.includes(o)?onChange(selected.filter(s=>s!==o)):onChange([...selected,o]);return <div style={{marginBottom:8}}>{label&&<label style={{display:"block",fontSize:11,fontWeight:600,color:"#64748b",marginBottom:4}}>{label}</label>}<div style={{display:"flex",flexWrap:"wrap",gap:3}}>{options.map(o=><button key={o} onClick={()=>toggle(o)} style={{padding:"2px 9px",borderRadius:99,fontSize:11,fontWeight:500,border:"1.5px solid",cursor:"pointer",background:selected.includes(o)?(RC[o]||"#3b82f6"):"transparent",color:selected.includes(o)?(lt(RC[o])?"#1e293b":"#fff"):"#64748b",borderColor:selected.includes(o)?"transparent":"#e2e8f0"}}>{o}</button>)}</div></div>};
function SB({value,options,onChange}) {const [open,setOpen]=useState(false);const ref=useRef(null);useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false)};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h)},[]);const bg=SC[value]||"#94a3b8";return <div ref={ref} style={{position:"relative",display:"inline-block"}}><button onClick={e=>{e.stopPropagation();setOpen(!open)}} style={{background:bg,color:lt(bg)?"#1e293b":"#fff",padding:"2px 9px",borderRadius:99,fontSize:11,fontWeight:600,border:"none",cursor:"pointer",whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}>{value} <span style={{fontSize:8}}>▼</span></button>{open&&<div style={{position:"absolute",top:"100%",right:0,marginTop:4,background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:50,minWidth:160,padding:4,maxHeight:240,overflowY:"auto"}} onClick={e=>e.stopPropagation()}>{options.map(o=><button key={o} onClick={()=>{onChange(o);setOpen(false)}} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"6px 10px",border:"none",background:value===o?"#f1f5f9":"transparent",borderRadius:4,cursor:"pointer",fontSize:12,color:"#334155",textAlign:"left"}}><span style={{width:8,height:8,borderRadius:99,background:SC[o]||"#94a3b8",flexShrink:0}}/>{o}</button>)}</div>}</div>}
function StatBox({label,value,color,active,onClick}) {return <div onClick={onClick} style={{flex:1,background:active?"#f0f9ff":"#f8fafc",borderRadius:8,padding:"8px 6px",textAlign:"center",border:active?`2px solid ${color}`:"1px solid #e2e8f0",cursor:"pointer",transition:"all 0.15s",minWidth:55}}><div style={{fontSize:20,fontWeight:700,color}}>{value}</div><div style={{fontSize:10,color:"#64748b",fontWeight:600}}>{label}</div></div>}

// Forms
function AddStopForm({onSave,onCancel}) {const [f,sF]=useState({address:"",visitDate:new Date().toISOString().split("T")[0],timeWindow:"",tech:"",notes:""});return <Cd s={{border:"2px solid #1e40af",background:"#f8fafc"}}><div style={{fontSize:14,fontWeight:700,color:"#1e40af",marginBottom:10}}>New house stop</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 10px"}}><Inp label="Address" value={f.address} onChange={v=>sF({...f,address:v})} placeholder="123 Main St, Monsey, NY" s={{gridColumn:"1/-1"}}/><Inp label="Date" value={f.visitDate} onChange={v=>sF({...f,visitDate:v})} type="date"/><Inp label="Time" value={f.timeWindow} onChange={v=>sF({...f,timeWindow:v})} placeholder="10am-12pm"/><Sel label="Tech" value={f.tech} onChange={v=>sF({...f,tech:v})} options={TECHS}/><Inp label="Notes" value={f.notes} onChange={v=>sF({...f,notes:v})}/></div><div style={{display:"flex",gap:6,marginTop:4}}><Bt onClick={()=>onSave(f)}>Create</Bt><Bt v="secondary" onClick={onCancel}>Cancel</Bt></div></Cd>}
function AddPatientForm({stopId,onSave,onCancel}) {const [f,sF]=useState({name:"",dob:"",phone:"",insurance:"",memberId:"",reasons:[],notes:"",pcp:""});return <Cd s={{border:"2px solid #1e40af",background:"#f8fafc"}}><div style={{fontSize:14,fontWeight:700,color:"#1e40af",marginBottom:10}}>Add patient</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 10px"}}><Inp label="Name" value={f.name} onChange={v=>sF({...f,name:v})}/><Inp label="DOB" value={f.dob} onChange={v=>sF({...f,dob:v})} type="date"/><Inp label="Phone" value={f.phone} onChange={v=>sF({...f,phone:v})}/><Inp label="Insurance" value={f.insurance} onChange={v=>sF({...f,insurance:v})}/><Inp label="Member ID" value={f.memberId} onChange={v=>sF({...f,memberId:v})}/><Inp label="PCP" value={f.pcp} onChange={v=>sF({...f,pcp:v})}/></div><MS label="Visit reason" selected={f.reasons} onChange={v=>sF({...f,reasons:v})} options={VISIT_REASONS}/>{f.reasons.includes("Bloodwork")&&<Inp label="Tests" value={f.notes} onChange={v=>sF({...f,notes:v})} placeholder="CBC, CMP..."/>}<div style={{display:"flex",gap:6,marginTop:4}}><Bt onClick={()=>onSave({...f,stopId})}>Add</Bt><Bt v="secondary" onClick={onCancel}>Cancel</Bt></div></Cd>}
function OvernightForm({visit,onSave,onCancel}) {const [t,sT]=useState("");return <Cd s={{border:"2px solid #f97316",background:"#fffbeb"}}><div style={{fontSize:13,fontWeight:700,color:"#92400e",marginBottom:8}}>Overnight — {visit.name}</div><Sel label="Lab type" value={t} onChange={sT} options={LAB_TYPES}/><div style={{display:"flex",gap:6}}><Bt v="warning" onClick={()=>{if(t)onSave(t)}}>Flag</Bt><Bt v="secondary" onClick={onCancel}>Cancel</Bt></div></Cd>}
function AddOnForm({onSave,onCancel}) {const [f,sF]=useState({name:"",dob:"",insurance:""});return <Cd s={{border:"2px solid #7c3aed",background:"#f5f3ff"}}><div style={{fontSize:13,fontWeight:700,color:"#5b21b6",marginBottom:8}}>Add-on patient</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 10px"}}><Inp label="Name" value={f.name} onChange={v=>sF({...f,name:v})}/><Inp label="DOB" value={f.dob} onChange={v=>sF({...f,dob:v})} type="date"/><Inp label="Insurance" value={f.insurance} onChange={v=>sF({...f,insurance:v})} s={{gridColumn:"1/-1"}}/></div><div style={{display:"flex",gap:6}}><Bt onClick={()=>onSave(f)}>Alert dispatch</Bt><Bt v="secondary" onClick={onCancel}>Cancel</Bt></div></Cd>}

// MAIN APP
export default function App() {
  const [role,setRole]=useState("dispatch");
  const [stops,setStops]=useState([]);
  const [visits,setVisits]=useState([]);
  const [labs,setLabs]=useState([]);
  const [bw,setBw]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [tab,setTab]=useState("stops");
  const [exp,setExp]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [addPat,setAddPat]=useState(null);
  const [onf,setOnf]=useState(null);
  const [ao,setAo]=useState(null);
  const [notifs,setNotifs]=useState([]);
  const [stopFilter,setStopFilter]=useState(null);
  const [bwFilter,setBwFilter]=useState(null);
  const [saving,setSaving]=useState(false);

  const addNotif = m => {setNotifs(p=>[{id:Date.now(),m},...p]);setTimeout(()=>setNotifs(p=>p.slice(0,-1)),4000)};

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [sRaw,vRaw,lRaw,bRaw] = await Promise.all([
        apiGet(TBL.dispatch), apiGet(TBL.visits), apiGet(TBL.labs), apiGet(TBL.bw)
      ]);
      setStops(sRaw.map(mapStop));
      setVisits(vRaw.map(mapVisit));
      setLabs(lRaw.map(mapLab));
      setBw(bRaw.map(mapBW));
    } catch(e) { setError(e.message) }
    setLoading(false);
  }, []);

  useEffect(() => { loadData() }, [loadData]);

  // Write helpers
  const updateStopStatus = async (id, status) => {
    setStops(p=>p.map(s=>s.id===id?{...s,status}:s));
    await apiUpdate(TBL.dispatch, id, {"Dispatch Status": status});
  };
  const updateVisitStatus = async (id, status) => {
    setVisits(p=>p.map(v=>v.id===id?{...v,status}:v));
    await apiUpdate(TBL.visits, id, {"Visit Ops Status": status});
  };
  const updateLabStatus = async (id, status) => {
    setLabs(p=>p.map(l=>l.id===id?{...l,status}:l));
    await apiUpdate(TBL.labs, id, {"Office Status": status});
  };
  const updateBwStatus = async (id, status) => {
    setBw(p=>p.map(b=>b.id===id?{...b,status}:b));
    await apiUpdate(TBL.bw, id, {"Work Flow Status": status});
  };
  const updateLabCheckbox = async (lab, field) => {
    const keyMap = {"printed":"Req Form Printed","sent":"Sent to Lab","results":"Results Back","reviewed":"Results Reviewed"};
    const u = {...lab,[field]:!lab[field]};
    if(u.reviewed)u.status="Reviewed";else if(u.results)u.status="Results Back";else if(u.sent)u.status="Sent to Lab";else if(u.printed)u.status="Req Form Printed";else u.status="Needs Req Form";
    setLabs(p=>p.map(x=>x.id===lab.id?u:x));
    await apiUpdate(TBL.labs, lab.id, {[keyMap[field]]:u[field],"Office Status":u.status});
  };

  const createStop = async (f) => {
    setSaving(true);
    const rec = await apiCreate(TBL.dispatch, {"Address":f.address,"Visit Date":f.visitDate,"Time Window":f.timeWindow,"Assigned Tech":f.tech,"Dispatch Notes":f.notes,"Dispatch Status":"Draft"});
    if(rec) { setStops(p=>[mapStop(rec),...p]); setExp(rec.id); addNotif("Stop created") }
    setShowAdd(false); setSaving(false);
  };

  const createVisit = async (f) => {
    setSaving(true);
    const fields = {"Patient Name":f.name,"DOB":f.dob,"Phone Number":f.phone,"Insurance Provider":f.insurance,"Insurance Member ID":f.memberId,"Visit Reason":f.reasons,"Dispatch Notes":f.notes,"Visit Ops Status":"New Intake","Related Dispatch Visit":[{id:f.stopId}]};
    const rec = await apiCreate(TBL.visits, fields);
    if(rec) {
      setVisits(p=>[...p,mapVisit(rec)]);
      addNotif("Patient added");
      if(f.reasons.includes("Bloodwork")) {
        const bwRec = await apiCreate(TBL.bw, {"Patient Name":f.name,"Status":"Intake","Linked Case":[{id:rec.id}]});
        if(bwRec) { setBw(p=>[...p,mapBW(bwRec)]); addNotif("BW case created") }
      }
    }
    setAddPat(null); setSaving(false);
  };

  const createLab = async (patientName, labType, visitId) => {
    const fields = {"Patient Name":patientName,"Lab Type":labType,"Office Status":"Needs Req Form","Flagged by Tech":true};
    if(visitId) fields["Related Visit"] = [{id:visitId}];
    const rec = await apiCreate(TBL.labs, fields);
    if(rec) { setLabs(p=>[mapLab(rec),...p]); addNotif("Overnight lab flagged") }
    if(visitId) updateVisitStatus(visitId, "Needs Lab Paperwork");
  };

  // Computed
  const pLabs = labs.filter(l=>!["Reviewed","Closed"].includes(l.status)).length;
  const bwAct = bw.filter(b=>b.status!=="Completed").length;
  const fuDue = bw.filter(b=>b.status==="Follow Up Due").length;
  const actStops = stops.filter(s=>["Active","Sent to Onfleet","Assigned"].includes(s.status)).length;
  const fStops = stopFilter?stops.filter(stopFilter):stops;
  const fBw = bwFilter?bw.filter(bwFilter):bw;
  const techStops = stops.filter(s=>s.tech==="Moshe"&&["Sent to Onfleet","Assigned","Active"].includes(s.status));

  if (loading) return <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",fontFamily:"system-ui"}}><div style={{textAlign:"center"}}><div style={{fontSize:24,fontWeight:700,color:"#1e40af",marginBottom:8}}>HomeVisitOps</div><div style={{color:"#64748b"}}>Loading your data...</div></div></div>;
  if (error) return <div style={{padding:40,fontFamily:"system-ui",textAlign:"center"}}><div style={{fontSize:18,fontWeight:700,color:"#dc2626",marginBottom:8}}>Connection error</div><div style={{color:"#64748b",marginBottom:16}}>{error}</div><Bt onClick={loadData}>Retry</Bt></div>;

  return <div style={{maxWidth:800,margin:"0 auto",padding:"0 8px",fontFamily:"system-ui,-apple-system,sans-serif"}}>
    {/* Notifications */}
    {notifs.length>0&&<div style={{position:"fixed",top:10,right:10,zIndex:999}}>{notifs.map(n=><div key={n.id} style={{background:"#1e40af",color:"#fff",padding:"10px 16px",borderRadius:8,marginBottom:6,fontSize:13,fontWeight:500,boxShadow:"0 4px 12px rgba(0,0,0,0.15)"}}>{n.m}</div>)}</div>}

    {/* Header */}
    <div style={{padding:"14px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:4}}>
      <div style={{fontSize:20,fontWeight:800,color:"#0f172a",letterSpacing:-0.5}}>HomeVisit<span style={{color:"#3b82f6"}}>Ops</span></div>
      <div style={{display:"flex",gap:4,alignItems:"center"}}>
        <Bt v="secondary" onClick={loadData} s={{fontSize:11,padding:"5px 10px"}}>Refresh</Bt>
        <div style={{display:"flex",background:"#f1f5f9",borderRadius:8,padding:2}}>{[{k:"dispatch",l:"Dispatch"},{k:"tech",l:"Tech"},{k:"admin",l:"Admin"}].map(r=><button key={r.k} onClick={()=>{setRole(r.k);setStopFilter(null);setBwFilter(null)}} style={{padding:"6px 14px",borderRadius:6,fontSize:12,fontWeight:600,border:"none",cursor:"pointer",background:role===r.k?"#fff":"transparent",color:role===r.k?"#0f172a":"#64748b",boxShadow:role===r.k?"0 1px 3px rgba(0,0,0,0.08)":"none"}}>{r.l}</button>)}</div>
      </div>
    </div>
    <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>

    {/* DISPATCH + ADMIN VIEW */}
    {(role==="dispatch"||role==="admin")&&<div>
      {role==="admin"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}><Cd><div style={{fontSize:12,color:"#64748b",fontWeight:600}}>Visits</div><div style={{fontSize:28,fontWeight:700}}>{visits.filter(v=>v.status==="Closed").length}/{visits.length}</div><div style={{background:"#e2e8f0",borderRadius:99,height:6,marginTop:6}}><div style={{background:"#22c55e",borderRadius:99,height:6,width:`${visits.length?visits.filter(v=>v.status==="Closed").length/visits.length*100:0}%`}}/></div></Cd><Cd><div style={{fontSize:12,color:"#64748b",fontWeight:600}}>Bloodwork</div><div style={{fontSize:28,fontWeight:700}}>{bw.filter(b=>b.status==="Completed").length}/{bw.length}</div><div style={{background:"#e2e8f0",borderRadius:99,height:6,marginTop:6}}><div style={{background:"#3b82f6",borderRadius:99,height:6,width:`${bw.length?bw.filter(b=>b.status==="Completed").length/bw.length*100:0}%`}}/></div></Cd></div>}

      <div style={{display:"flex",gap:6,marginBottom:12}}>
        <StatBox label="Stops" value={stops.length} color="#3b82f6" active={tab==="stops"&&!stopFilter} onClick={()=>{setTab("stops");setStopFilter(null);setBwFilter(null)}}/>
        <StatBox label="Patients" value={visits.length} color="#8b5cf6" active={false} onClick={()=>{setTab("stops");setStopFilter(null);if(stops[0])setExp(stops[0].id)}}/>
        <StatBox label="Active" value={actStops} color="#f97316" active={!!stopFilter} onClick={()=>{setTab("stops");setStopFilter(()=>s=>["Active","Sent to Onfleet","Assigned"].includes(s.status));setBwFilter(null)}}/>
        <StatBox label="Labs" value={pLabs} color="#ef4444" active={tab==="labs"} onClick={()=>{setTab("labs");setStopFilter(null);setBwFilter(null)}}/>
        <StatBox label="Follow up" value={fuDue} color="#14b8a6" active={!!bwFilter} onClick={()=>{setTab("bw");setBwFilter(()=>b=>b.status==="Follow Up Due");setStopFilter(null)}}/>
      </div>

      {(stopFilter||bwFilter)&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,padding:"5px 10px",background:"#eff6ff",borderRadius:6,border:"1px solid #bfdbfe"}}><span style={{fontSize:12,color:"#1e40af",fontWeight:500}}>Filtered view</span><button onClick={()=>{setStopFilter(null);setBwFilter(null)}} style={{fontSize:11,color:"#3b82f6",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Clear ✕</button></div>}

      <div style={{display:"flex",borderBottom:"2px solid #e2e8f0",marginBottom:12}}>{[{k:"stops",l:"Stops",c:stops.length},{k:"labs",l:"Labs",c:pLabs},{k:"bw",l:"Bloodwork",c:bwAct}].map(t=><button key={t.k} onClick={()=>{setTab(t.k);setStopFilter(null);setBwFilter(null)}} style={{padding:"7px 16px",fontSize:13,fontWeight:600,background:"none",border:"none",cursor:"pointer",color:tab===t.k?"#1e40af":"#64748b",borderBottom:tab===t.k?"2px solid #1e40af":"2px solid transparent",marginBottom:-2}}>{t.l}<span style={{background:tab===t.k?"#dbeafe":"#f1f5f9",padding:"1px 6px",borderRadius:99,fontSize:10,marginLeft:4}}>{t.c}</span></button>)}</div>

      {tab==="stops"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:13,color:"#64748b"}}>{fStops.length} stops</span><Bt onClick={()=>setShowAdd(true)} s={{fontSize:11}}>+ New stop</Bt></div>
        {showAdd&&<AddStopForm onSave={createStop} onCancel={()=>setShowAdd(false)}/>}
        {fStops.map(stop=>{const sp=visits.filter(v=>v.stopId===stop.id);return <div key={stop.id}><Cd onClick={()=>setExp(exp===stop.id?null:stop.id)}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6}}><div><div style={{fontSize:15,fontWeight:600}}>{stop.address||"No address"}</div><div style={{fontSize:12,color:"#64748b",marginTop:2}}>{stop.visitDate} • {stop.timeWindow} • {stop.tech}</div></div><div style={{display:"flex",gap:4,alignItems:"center"}} onClick={e=>e.stopPropagation()}><B l={sp.length+" pt"+(sp.length!==1?"s":"")} c="#e2e8f0"/><SB value={stop.status} options={DS} onChange={v=>updateStopStatus(stop.id,v)}/></div></div>
          {exp===stop.id&&<div style={{marginTop:12,borderTop:"1px solid #f1f5f9",paddingTop:10}} onClick={e=>e.stopPropagation()}>{sp.length===0&&<div style={{color:"#94a3b8",fontSize:12}}>No patients</div>}{sp.map(p=><div key={p.id} style={{padding:"6px 0",borderBottom:"1px solid #f8fafc",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4}}><div><span style={{fontWeight:600,fontSize:13}}>{p.name}</span><span style={{fontSize:11,color:"#94a3b8",marginLeft:6}}>{p.dob} • {p.insurance}</span></div><div style={{display:"flex",gap:3,alignItems:"center"}}><Pills r={p.reasons}/><SB value={p.status} options={VS} onChange={v=>updateVisitStatus(p.id,v)}/></div></div>)}<div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}><Bt onClick={()=>setAddPat(stop.id)} s={{fontSize:11}} disabled={saving}>+ Patient</Bt>{stop.status==="Draft"&&<Bt v="secondary" onClick={()=>updateStopStatus(stop.id,"Ready to Dispatch")} s={{fontSize:11}}>Validate</Bt>}{["Draft","Ready to Dispatch"].includes(stop.status)&&<Bt v="success" onClick={()=>updateStopStatus(stop.id,"Sent to Onfleet")} s={{fontSize:11}}>Send to Onfleet</Bt>}</div></div>}</Cd>
          {addPat===stop.id&&<AddPatientForm stopId={stop.id} onSave={createVisit} onCancel={()=>setAddPat(null)}/>}</div>})}
      </div>}

      {tab==="labs"&&<div>{labs.length===0?<div style={{textAlign:"center",padding:30,color:"#94a3b8"}}>No labs</div>:labs.map(lab=><Cd key={lab.id}><div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}><div><div style={{fontSize:14,fontWeight:600}}>{lab.patientName}</div><div style={{fontSize:12,color:"#64748b"}}>{lab.labType} • {lab.address}</div></div><SB value={lab.status} options={LS} onChange={v=>updateLabStatus(lab.id,v)}/></div><div style={{display:"flex",gap:10,marginTop:10,flexWrap:"wrap"}}>{[["printed","Req printed"],["sent","Sent"],["results","Results"],["reviewed","Reviewed"]].map(([k,l])=><label key={k} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={lab[k]} onChange={()=>updateLabCheckbox(lab,k)} style={{width:15,height:15}}/>{l}</label>)}</div></Cd>)}</div>}

      {tab==="bw"&&<div>{fBw.length===0?<div style={{textAlign:"center",padding:30,color:"#94a3b8"}}>No cases</div>:fBw.map(b=><Cd key={b.id}><div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}><div><div style={{fontSize:14,fontWeight:600}}>{b.patient}</div><div style={{fontSize:12,color:"#64748b"}}>{b.tests} • {b.tubes}</div></div><SB value={b.status} options={BWS} onChange={v=>updateBwStatus(b.id,v)}/></div></Cd>)}</div>}
    </div>}

    {/* TECH VIEW */}
    {role==="tech"&&<div>
      <div style={{fontSize:13,color:"#64748b",marginBottom:12}}>Logged in as <strong>Moshe</strong> • {techStops.length} stops</div>
      {techStops.length===0&&<div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>No stops assigned</div>}
      {techStops.map(stop=>{const sp=visits.filter(v=>v.stopId===stop.id);return <Cd key={stop.id} onClick={()=>setExp(exp===stop.id?null:stop.id)}><div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:6}}><div><div style={{fontSize:15,fontWeight:600}}>{stop.address}</div><div style={{fontSize:12,color:"#64748b"}}>{stop.timeWindow} • {sp.length} pts</div></div><B l={stop.status}/></div>
        {exp===stop.id&&<div style={{marginTop:12,borderTop:"1px solid #f1f5f9",paddingTop:10}} onClick={e=>e.stopPropagation()}>
          {sp.map(p=><div key={p.id} style={{padding:10,marginBottom:8,background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap"}}><div><div style={{fontWeight:600,fontSize:14}}>{p.name}</div><div style={{fontSize:12,color:"#64748b"}}>{p.dob} • {p.insurance}</div></div><Pills r={p.reasons}/></div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {!p.reasons?.includes("Bloodwork")&&<><Bt v="success" s={{fontSize:11}} onClick={()=>updateVisitStatus(p.id,"Closed")}>Rapid</Bt><Bt v="warning" s={{fontSize:11}} onClick={()=>setOnf(p)}>Overnight</Bt><Bt v="secondary" s={{fontSize:11}} onClick={()=>updateVisitStatus(p.id,"Closed")}>Assessment</Bt></>}
              {p.reasons?.includes("Bloodwork")&&<><Bt s={{fontSize:11}} onClick={()=>updateVisitStatus(p.id,"In Field")}>Drawn</Bt><Bt v="danger" s={{fontSize:11}} onClick={()=>updateVisitStatus(p.id,"In Field")}>Failed</Bt></>}
            </div>
          </div>)}
          <Bt v="secondary" onClick={()=>setAo(stop.id)} s={{fontSize:11,marginTop:4}}>+ Add-on</Bt>
          {ao===stop.id&&<AddOnForm onSave={()=>setAo(null)} onCancel={()=>setAo(null)}/>}
        </div>}
        {onf&&onf.stopId===stop.id&&<div onClick={e=>e.stopPropagation()}><OvernightForm visit={onf} onSave={t=>{createLab(onf.name,t,onf.id);setOnf(null)}} onCancel={()=>setOnf(null)}/></div>}
      </Cd>})}
    </div>}
  </div>;
}
