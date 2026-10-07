"use client";
import { usePlatform } from "@/components/platform-context";
import { readClientResponse, clientResponseMessage, clientResponseDenied } from "@/lib/client-response";
import {useCallback,useEffect,useRef,useState} from "react";
export function useEvidenceData<T>(query: string, endpoint = "/api/evidence-engine") {
  const { request } = usePlatform();
 const [data,setData]=useState<T|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState("");
 const sequence=useRef(0),write=useRef(false),queryRef=useRef(query);
 const load=useCallback(async(signal?:AbortSignal)=>{
  const current=++sequence.current;setLoading(true);setError("");
  try {const response=await request(`${endpoint}${query ? `?${query}` : ""}`,{cache:"no-store",signal});const view=new URLSearchParams(query).get("view");const fields=endpoint==="/api/evidence-portfolio"?["labs"]:view==="timeline"||view==="measureHistory"?["records"]:view==="report"?["cohorts"]:view==="admin"?["mappings","rubrics","templates"]:["groups","rubrics","submissions"];const payload=await readClientResponse<T>(response,"Evidence is unavailable. Please try again.",value=>{if(view==="developmentProfile"){const profile=value.profile as Record<string,unknown>|undefined;return Boolean(profile&&typeof profile==="object"&&!Array.isArray(profile)&&typeof profile.heading==="string"&&typeof profile.summary==="string"&&Array.isArray(profile.areas)&&typeof profile.boundary==="string");}if(!fields.every(field=>Array.isArray(value[field])))return false;if(view==="timeline"){const index=value.index as Record<string,unknown>|undefined;return Boolean(index&&Array.isArray(index.years)&&Array.isArray(index.labs)&&typeof index.record_count==="number");}return true;});if(current===sequence.current&&!signal?.aborted)setData(payload);}
  catch(cause){if(current===sequence.current&&!signal?.aborted){setData(null);setError(clientResponseMessage(cause,"Evidence is unavailable. Please try again."));}}
  finally{if(current===sequence.current&&!signal?.aborted)setLoading(false);}
 },[query,endpoint,request]);
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
  try {const response=await request("/api/evidence-engine",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});await readClientResponse(response,"Evidence could not be saved. Please try again.");if(startedQuery===queryRef.current){setMessage("Saved.");await load();}return true;}
  catch(cause){if(startedQuery===queryRef.current){if(clientResponseDenied(cause))setData(null);setError(clientResponseMessage(cause,"Evidence could not be saved. Please try again."));}return false;}
  finally{write.current=false;setSaving(false);}
 }
 return {data,error,loading,saving,message,act,load};
}
export function EvidenceState({loading,error,message,retry}:{loading:boolean;error:string;message:string;retry:()=>void}) {
 return <>{loading?<p role="status">Loading evidence…</p>:null}{error?<div className="error-banner" role="alert"><p>{error}</p><button type="button" onClick={retry}>Refresh evidence</button></div>:null}{message?<p role="status">{message}</p>:null}</>;
}
