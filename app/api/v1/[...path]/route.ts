import { createHttpHandler } from "../../../../src/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handle = createHttpHandler();
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const HEAD = handle;
export const OPTIONS = handle;
