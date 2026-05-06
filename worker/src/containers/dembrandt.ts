import { Container } from "@cloudflare/containers";

export class DembrandtContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
  enableInternet = true;
  entrypoint = ["npm", "run", "start"];

  override onStop(event: { exitCode?: number; reason?: string }) {
    console.log("dembrandt_container_stopped", event);
  }

  override onError(error: unknown) {
    console.error("dembrandt_container_error", error);
    throw error;
  }
}
