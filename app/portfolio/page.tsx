import type {Metadata} from "next";
import {requireUser} from "@/lib/supabase/require-user";
import {CanonicalAdaptiveShell} from "../canonical-adaptive-shell";
import {PortfolioWorkspace} from "./portfolio-workspace";
import "../canonical-shell.css";
import "../evidence-engine.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Evidence Portfolio",description:"Your longitudinal record of original evidence, revisions and assessment."};
export default async function PortfolioPage(){await requireUser("/portfolio");return <CanonicalAdaptiveShell><PortfolioWorkspace/></CanonicalAdaptiveShell>;}
