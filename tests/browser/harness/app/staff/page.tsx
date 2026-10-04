"use client";
import {Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import {OperationsView} from '../../../../../app/operations-view';
import '../../../../../app/workspace/staff-workspace-hardening.css';
function Workspace(){const params=useSearchParams();return <div className="staff-workspace-shell"><main className="staff-workspace-main"><OperationsView initialRoles={['SYSTEM_ADMIN','FACILITATOR']} perspective={params.get('role')==='facilitator'?'facilitator':'admin'}/></main></div>;}
export default function Page(){return <Suspense><Workspace/></Suspense>;}
