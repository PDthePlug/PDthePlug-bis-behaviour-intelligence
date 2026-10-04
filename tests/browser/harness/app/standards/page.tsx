"use client";
import {useLayoutEffect,useRef} from 'react';
import {enhanceHandbookDocument} from '../../../../../app/learning/handbook-document-enhancements';
import {readDocxTable} from '../../../../../lib/docx-table.mjs';
const table='<table><tbody><tr><th>Situation</th><th>Your evidence notes</th></tr><tr><td>At work</td><td>_____</td></tr><tr><td>Worked example</td><td>Preserve this authored answer</td></tr></tbody></table>';
const merged=readDocxTable('<w:tbl><w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>Combined meaning</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>').html;
export default function Page(){
 const root=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  if(!root.current)return;enhanceHandbookDocument(root.current,'LDR','standards');enhanceHandbookDocument(root.current,'LDR','standards');
  for(const field of root.current.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('[data-field-id]')){
   field.value=sessionStorage.getItem(field.dataset.fieldId!)||'';
   field.oninput=()=>sessionStorage.setItem(field.dataset.fieldId!,field.value);
  }
 },[]);
 return <main className="prototype-reader"><h1>Learning table acceptance</h1><div className="prototype-document" ref={root} dangerouslySetInnerHTML={{__html:table+table+merged}}/></main>;
}
