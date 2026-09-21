import { getAuth } from "@/auth/auth";

// Better Auth's own endpoints: the links in verification emails land here, and social
// login callbacks will (ticket 03). Forms call the server actions in src/auth/actions.ts instead.
export async function GET(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export async function POST(request: Request): Promise<Response> {
  return getAuth().handler(request);
}
