// Closed harness default. Practical workflow tests install explicit fixtures;
// unrelated portfolio journeys have no eligible practical assessment tasks.
export async function GET(){return Response.json({tasks:[],plans:[]});}
