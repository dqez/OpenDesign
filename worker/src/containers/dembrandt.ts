import { Container, type OutboundHandler } from "@cloudflare/containers";

export class DembrandtContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
  enableInternet = true;
  entrypoint = ["npm", "run", "start"];

  static override outboundByHost = {
    "r2.internal": async (request, env) => {
      const url = new URL(request.url);
      const key = decodeURIComponent(url.pathname.replace(/^\//, ""));
      if (!key) return new Response("missing R2 key", { status: 400 });

      if (request.method === "PUT") {
        await env.R2.put(key, request.body, {
          httpMetadata: {
            contentType:
              request.headers.get("content-type") ??
              "application/octet-stream",
          },
        });
        return new Response("ok", { status: 200 });
      }

      return new Response("method not allowed", { status: 405 });
    },
  } satisfies Record<string, OutboundHandler>;

  override onStop(event: { exitCode?: number; reason?: string }) {
    console.log("dembrandt_container_stopped", event);
  }

  override onError(error: unknown) {
    console.error("dembrandt_container_error", error);
    throw error;
  }
}
