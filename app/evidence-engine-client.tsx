"use client";
import {useCallback,useEffect,useRef,useState} from "react";
export function useEvidenceData<T>(query: string, endpoint = "/api/evidence-engine") {
 const [data,setData]=useState<T|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 const sequence=useRef(0),write=useRef(false),queryRef=useRef(query);
 const load=useCallback(async(signal?:AbortSignal)=>{
  const current=++sequence.current;setLoading(true);setError("");
  try {const response=await fetch(`${endpoint}${query ? `?${query}` : ""}`,{cache:"no-store",signal});const payload=await response.json().catch(()=>({error:"Evidence is unavailable. Please try again."}));if(!response.ok)throw new Error(payload.error??"Evidence is unavailable.");if(current===sequence.current&&!signal?.aborted)setData(payload);}
  catch(cause){if(current===sequence.current&&!signal?.aborted){setData(null);setError(cause instanceof Error?cause.message:"Evidence is unavailable.");}}
  finally{if(current===sequence.current&&!signal?.aborted)setLoading(false);}
 },[query,endpoint]);
 useEffect(()=>{
  queryRef.current=query;
  const controller=new AbortController(),invalidate=()=>{++sequence.current;};
  const timer=window.setTimeout(()=>{setData(null);setMessage("");void load(controller.signal);},0);
  const focus=()=>{if(!write.current)void load(controller.signal);};
  window.addEventListener("focus",focus);
  return()=>{clearTimeout(timer);controller.abort();invalidate();window.removeEventListener("focus",focus);};
 },[load,query]);
 async function act(body:Record<string,unknown>) {
  if(write.current)return false;write.current=true;++sequence.current;setSaving(true);setError("");setMessage("");const startedQuery=queryRef.current;
  try {const response=await fetch("/api/evidence-engine",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const payload=await response.json().catch(()=>({error:"Evidence is unavailable. Please try again."}));if(!response.ok)throw new Error(payload.error??"Evidence could not be saved.");if(startedQuery===queryRef.current){setMessage("Saved.");await load();}return true;}
  catch(cause){if(startedQuery===queryRef.current)setError(cause instanceof Error?cause.message:"Evidence could not be saved.");return false;}
  finally{write.current=false;setSaving(false);}
 }
 return {data,error,loading,saving,message,act,load};
}
export function EvidenceState({loading,error,message,retry}:{loading:boolean;error:string;message:string;retry:()=>void}) {
 return <>{loading?<p role="status">Loading evidence…</p>:null}{error?<div className="error-banner" role="alert"><p>{error}</p><button type="button" onClick={retry}>Refresh evidence</button></div>:null}{message?<p role="status">{message}</p>:null}</>;
}
