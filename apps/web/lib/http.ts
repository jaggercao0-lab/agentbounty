import { NextResponse } from "next/server";
export function apiError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({error:"unauthorized"},{status:401});
  console.error(error);
  return NextResponse.json({error:"internal_error"},{status:500});
}
