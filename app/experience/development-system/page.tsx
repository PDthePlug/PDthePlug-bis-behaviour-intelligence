import type {Metadata} from 'next';
import {Suspense} from 'react';
import {DevelopmentScenarioExperience} from './scenario-experience';
export const metadata:Metadata={title:'BIS · Development reporting experience',robots:{index:false,follow:false}};
export default function Page(){return <Suspense fallback={<main><p>Preparing the fictional development programme…</p></main>}><DevelopmentScenarioExperience/></Suspense>;}
