import { authed, json } from "@/lib/api/v1/http";
import { meResponse } from "@/lib/api/v1/viewer";

export const dynamic = "force-dynamic";

/** The signed-in account, its workspace and display preferences. */
export const GET = authed(async (ctx) => json(meResponse(ctx)));
