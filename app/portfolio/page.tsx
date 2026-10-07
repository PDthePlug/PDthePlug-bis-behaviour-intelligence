import type {Metadata} from "next";
import {requireUser} from "@/lib/supabase/require-user";
import {CanonicalAdaptiveShell} from "../canonical-adaptive-shell";
import {PortfolioWorkspace} from "./portfolio-workspace";
import "../canonical-shell.css";
import "../evidence-engine.css";
import "./portfolio.css";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"My BIS · Growth & Evidence",description:"Your living BIS development picture with the evidence, revisions and feedback behind it."};
export default async function PortfolioPage(){await requireUser("/portfolio");return <CanonicalAdaptiveShell><PortfolioWorkspace/></CanonicalAdaptiveShell>;}
