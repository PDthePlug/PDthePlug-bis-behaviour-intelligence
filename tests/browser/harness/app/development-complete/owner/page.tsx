"use client";
import {useState} from 'react';
import {ProgrammeOutcomesView} from '../../../../../../app/programme-outcomes-view';
import type {SponsorSnapshot} from '../../../../../../app/programme-outcomes-view';
import {completeDevelopmentOutcome} from '../../../development-complete-fixture';
export default function Page(){
 const [section,setSection]=useState('overview');
 const [readOnly,setReadOnly]=useState(false);
 const [saved,setSaved]=useState('');
 const outcome={...completeDevelopmentOutcome,decisionRegister:{canManage:!readOnly,decisions:[]}};
 return <main><p>Fictional programme decision integration fixture.</p><button onClick={()=>{setReadOnly(true);setSection('overview');}}>Use read-only reporting account</button><ProgrammeOutcomesView data={{cohorts:[outcome],signalCoverage:[],privacy:{aggregationOnly:true,minimumReportableCohortSize:5,excluded:['Private reflections']}} satisfies SponsorSnapshot} section={section} reportPurpose="school" onSectionChange={setSection} act={async payload=>{setSaved(JSON.stringify(payload));return true;}}/>{saved?<output aria-label="Recorded intervention">{saved}</output>:null}</main>;
}
