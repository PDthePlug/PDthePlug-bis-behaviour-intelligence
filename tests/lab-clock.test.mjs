import assert from "node:assert/strict";
import test from "node:test";
import {labClockInstant} from "../lib/lab-clock.mjs";
const actual=new Date("2026-10-04T10:00:00Z");
const stage={NODE_ENV:"development",NEXT_PUBLIC_SUPABASE_URL:"https://lbmhkddrkhtmkcvfmumd.supabase.co",BIS_STAGING_CERTIFICATION_CLOCK_ISO:"2026-10-11T10:00:00Z"};
const synthetic="fullscope-20261004-01@bis-staging.example.invalid";
test("the controlled clock applies only to dedicated local staging learner accounts",()=>{
  assert.equal(labClockInstant(synthetic,stage,actual).toISOString(),new Date(stage.BIS_STAGING_CERTIFICATION_CLOCK_ISO).toISOString());
  for(const environment of [{...stage,NODE_ENV:"production"},{...stage,NEXT_PUBLIC_SUPABASE_URL:"https://swmhsqivqaqwovojbceo.supabase.co"},{...stage,NEXT_PUBLIC_SUPABASE_URL:"https://another.supabase.co"},{}])assert.equal(labClockInstant(synthetic,environment,actual),actual);
  for(const email of ["learner@school.org",undefined,"fullscope-20261004-admin@bis-staging.example.invalid","fullscope-20261004-01@bis-staging.example.invalid.evil"])assert.equal(labClockInstant(email,stage,actual),actual);
});
