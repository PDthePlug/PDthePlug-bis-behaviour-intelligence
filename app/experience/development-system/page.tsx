import type {Metadata} from 'next';
import {Suspense} from 'react';
import {DevelopmentScenarioExperience} from './scenario-experience';
import '@/app/programme-outcomes-view.css';
export const metadata:Metadata={title:'BIS · Development reporting experience',robots:{index:false,follow:false}};
export default function Page(){return <Suspense fallback={<main><p>Preparing the fictional development programme…</p></main>}><DevelopmentScenarioExperience/></Suspense>;}
