"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {Menu,X,type LucideIcon} from "lucide-react";
import {BisMark} from "@/components/brand/bis-mark";
export type WorkspaceDestination={id:string;label:string;detail:string;href:string;icon:LucideIcon;active?:boolean};
// Uses the canonical centred-menu design. Native modal semantics make the rest
// of the workspace inert and provide keyboard containment and focus restoration.
export function WorkspaceMenu({groups,label="Staff menu"}:{groups:Array<{label:string;items:WorkspaceDestination[]}>;label?:string}) {
 const [open,setOpen]=useState(false),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  const surface=dialog.current,opener=trigger.current;if(!surface)return;
  const overflow=document.body.style.overflow;document.body.style.overflow="hidden";surface.showModal();
  return()=>{surface.close();document.body.style.overflow=overflow;opener?.focus();};
 },[open]);
 return <>
  <button ref={trigger} type="button" className="canonical-menu-trigger" aria-label={`Open BIS menu · ${label}`} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><Menu aria-hidden="true"/><span>Menu</span></button>
  {open?<dialog ref={dialog} className="canonical-menu open workspace-menu" aria-label={label} onCancel={()=>setOpen(false)} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)setOpen(false);}}}>
   <div className="canonical-menu-head"><div><span><BisMark/></span><div><strong>Behaviour Intelligence Series™</strong><small>{label}</small></div></div><button type="button" autoFocus onClick={()=>setOpen(false)} aria-label="Close BIS menu"><X/></button></div>
   {groups.map(group=><nav key={group.label} className="canonical-menu-items" aria-label={group.label}><p className="workspace-menu-group">{group.label}</p>{group.items.map(item=><Link key={item.id} href={item.href} className={item.active?"active":""} aria-current={item.active?"page":undefined} onClick={()=>setOpen(false)}><item.icon aria-hidden="true"/><span><strong>{item.label}</strong><small>{item.detail}</small></span></Link>)}</nav>)}
  </dialog>:null}
 </>;
}
