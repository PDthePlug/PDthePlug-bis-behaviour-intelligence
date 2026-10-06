"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ModuleLibrary } from "../../../../../app/catalogue/module-library";
import "../../../../../app/catalogue/catalogue.css";
function Library() { const params = useSearchParams(); return <ModuleLibrary mode={params.get("mode") === "lab" ? "lab" : "learning"} />; }
export default function Page() { return <Suspense><Library /></Suspense>; }
