"use client";
import {OperationsView,type StaffSnapshot} from '../../../../../app/operations-view';
const snapshot: StaffSnapshot = {
  identity:{id:'fixture-staff',email:'staff@example.test',displayName:'Authorised fixture'},
  roles:['PROGRAMME_OWNER'],
  privacyBoundary:{facilitatorCanSee:[],facilitatorCannotSee:[],sponsorCanSee:[],sponsorCannotSee:[],safeguardingAccess:'Role required'},
  admin:null,facilitator:null,safeguarding:null,
  sponsor:{cohorts:[{cohort:{id:'loaded',name:'Already-authorised group',labCode:'SYS',labVersion:'1',startsOn:null,endsOn:null},participantCount:20,suppressed:false,minimumReportableCohortSize:5,metrics:null,learningSummary:null,deepAnalysis:null}],signalCoverage:[],privacy:{aggregationOnly:true,minimumReportableCohortSize:5,excluded:[]}},
};
export default function Page(){return <OperationsView initialRoles={snapshot.roles} initialSnapshot={snapshot} perspective="outcomes" section="overview" />;}
