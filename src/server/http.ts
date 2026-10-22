import { API_PREFIX, ERROR_HTTP_STATUS, ROUTES, fail, type Actor, type ApiResult, type ListQuery } from "../contracts/api";
import { authenticate, isActor } from "./auth";
import type { Services } from "./services";

interface HttpDeps {
  authenticate: (token: string) => Promise<ApiResult<Actor>>;
  getServices: () => Services | Promise<Services>;
}

function json(result: ApiResult<unknown>, successStatus = 200, headers: HeadersInit = {}): Response {
  return Response.json(result, {
    status: result.ok ? successStatus : ERROR_HTTP_STATUS[result.error.code],
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

const unavailable = () => fail("POLICY_UNAVAILABLE", "Verified Tide policy enforcement is unavailable");
const listQuery = (params: URLSearchParams): ListQuery => ({
  ...(params.has("limit") ? { limit: Number(params.get("limit")) } : {}),
  ...(params.has("cursor") ? { cursor: params.get("cursor") } : {}),
  ...(params.has("status") ? { status: params.get("status")! } : {}),
});

export function createHttpHandler(deps: Partial<HttpDeps> = {}) {
  const verify = deps.authenticate ?? authenticate;
  // Resolve Prisma only after a valid actor and a supported, available request.
  const resolveServices = deps.getServices ?? (async () => (await import("./services/default")).getServices());

  return async (request: Request): Promise<Response> => {
    const authorization = request.headers.get("authorization");
    const bearer = authorization?.match(/^Bearer ([A-Za-z0-9._~+/-]+=*)$/i);
    if (!bearer) return json(fail("UNAUTHENTICATED", "A Bearer credential is required"));
    try {
      const auth = await verify(bearer[1]);
      if (!auth.ok) return json(auth);
      if (!isActor(auth.data)) return json(fail("UNAUTHENTICATED", "Invalid credential"));
      const actor = auth.data;
      const url = new URL(request.url);
      const pathname = url.pathname.replace(/\/$/, "");
      if (!pathname.startsWith(`${API_PREFIX}/`)) return json(fail("NOT_FOUND", "Route not found"));
      const routePath = pathname.slice(API_PREFIX.length);
      // These operations have no implemented policy or service contract yet.
      if (/^\/council-changes(?:\/|$)/.test(routePath)) return json(unavailable());
      const matches = ROUTES.map((route) => ({
        route,
        match: routePath.match(new RegExp(`^${route.path.replace(/:id/g, "([^/]+)")}$`)),
      })).filter((entry) => entry.match !== null);
      if (matches.length === 0) return json(fail("NOT_FOUND", "Route not found"));
      const selected = matches.find(({ route }) => route.method === request.method);
      if (!selected) {
        const response = json(fail("INVALID_REQUEST", "HTTP method is not allowed"));
        return new Response(response.body, { status: 405, headers: { ...Object.fromEntries(response.headers), Allow: matches.map(({ route }) => route.method).join(", ") } });
      }
      const { route, match } = selected;
      // An APP vote/status cannot authorize cryptographic identity release. Also
      // block submissions until envelope provenance is verifiable: a TIDE_V1 tag,
      // ciphertext hash, or client-provided stub:base64 is not proof of encryption.
      if (route.service.endsWith("IdentityEnvelope") || route.service === "createIdea" || route.service === "createReport" || route.service === "applyCouncilChange") return json(unavailable());
      let input: unknown;
      if (request.method === "POST") {
        try { input = await request.json(); } catch {
          return json(fail("INVALID_REQUEST", "A valid JSON body is required"));
        }
      }
      let id: string;
      try { id = decodeURIComponent(match?.[1] ?? ""); } catch {
        return json(fail("INVALID_REQUEST", "Invalid resource identifier"));
      }
      const service = await resolveServices();
      const query = listQuery(url.searchParams);
      let result: ApiResult<unknown>;
      switch (route.service) {
        case "getMe": result = await service.getMe(actor); break;
        case "getDirectory": result = await service.getDirectory(actor); break;
        case "getCouncil": result = await service.getCouncil(actor); break;
        case "submitCouncilChange": result = await service.submitCouncilChange(actor, input); break;
        case "listCouncilChanges": result = await service.listCouncilChanges(actor, query); break;
        case "getCouncilChange": result = await service.getCouncilChange(actor, id); break;
        case "listIdeas": result = await service.listIdeas(actor, query); break;
        case "getIdea": result = await service.getIdea(actor, id); break;
        case "endorseIdea": result = await service.endorseIdea(actor, id, input); break;
        case "decideIdea": result = await service.decideIdea(actor, id, input); break;
        case "listReports": result = await service.listReports(actor, query); break;
        case "getReport": result = await service.getReport(actor, id); break;
        case "createUnmaskRequest": result = await service.createUnmaskRequest(actor, id, input); break;
        case "listMyVotingRequests": result = await service.listMyVotingRequests(actor, query); break;
        case "getVotingRequest": result = await service.getVotingRequest(actor, id); break;
        case "castVote": result = await service.castVote(actor, id, input); break;
        case "listAudit": result = await service.listAudit(actor, query); break;
        default: return json(unavailable());
      }
      return json(result, route.service === "createUnmaskRequest" || route.service === "submitCouncilChange" ? 201 : 200);
    } catch {
      return json(fail("POLICY_UNAVAILABLE", "Service is temporarily unavailable", { retryable: true }));
    }
  };
}
