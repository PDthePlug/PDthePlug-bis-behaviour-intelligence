import {z} from "zod";
import {withSupabaseRequest} from "@/db";
import {identityFrom} from "@/lib/bis-access";
import {requestSupabaseClient} from "@/lib/supabase/server";
const headers={"cache-control":"private, no-store"};
const id=z.string().min(1).max(200);
const payload=z.discriminatedUnion("action",[
 z.object({action:z.literal("session"),cohortId:id,day:z.number().int().min(1).max(10),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),status:z.enum(["PLANNED","HELD","CANCELLED"]),note:z.string().max(2000),expected:z.string().datetime({offset:true}).nullable()}).strict(),
 z.object({action:z.literal("attendance"),sessionId:id,learnerId:id,attendance:z.enum(["PRESENT","ABSENT","EXCUSED","UNKNOWN"]),expected:id.nullable()}).strict()
]);
async function get(request:Request){
 if(!await identityFrom())return Response.json({error:"Sign in is required."},{status:401,headers});
 const cohort=new URL(request.url).searchParams.get("cohortId");if(!cohort)return Response.json({error:"Choose a group."},{status:400,headers});
 const client=requestSupabaseClient();
 const {data:sessions,error}=await client.from("facilitator_sessions").select("*").eq("cohort_id",cohort).order("session_date",{ascending:false});
 if(error)return Response.json({error:"Class sessions could not be loaded."},{status:503,headers});
 const {data:attendance,error:attendanceError}=sessions.length?await client.from("session_attendance").select("*").in("session_id",sessions.map(s=>s.id)).order("recorded_at",{ascending:false}).order("id",{ascending:false}):{data:[],error:null};
 if(attendanceError)return Response.json({error:"Attendance could not be loaded."},{status:503,headers});
 return Response.json({sessions,attendance},{headers});
}
async function post(request:Request){
 if(!await identityFrom())return Response.json({error:"Sign in is required."},{status:401,headers});
 try{
  const p=payload.parse(await request.json());const {error}=p.action==="session"?await requestSupabaseClient().rpc("bis_save_class_session",{p_cohort:p.cohortId,p_day:p.day,p_date:p.date,p_status:p.status,p_note:p.note,p_expected:p.expected}):await requestSupabaseClient().rpc("bis_record_attendance",{p_session:p.sessionId,p_learner:p.learnerId,p_attendance:p.attendance,p_expected:p.expected});
  if(error)throw error;return Response.json({saved:true},{headers});
 }catch{return Response.json({error:"The class update could not be saved. Check your access and refresh before trying again."},{status:409,headers});}
}
export async function GET(request:Request){return withSupabaseRequest(()=>get(request));}
export async function POST(request:Request){return withSupabaseRequest(()=>post(request));}
