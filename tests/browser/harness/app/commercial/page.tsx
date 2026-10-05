"use client";
import {Suspense} from "react";
import {CommercialWorkspace} from "../../../../../app/commercial/commercial-workspace";
export default function Page(){return <Suspense><CommercialWorkspace identity={{email:"staff@local.invalid",displayName:"Staff"}} roles={["SYSTEM_ADMIN"]}/></Suspense>;}
