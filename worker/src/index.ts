import { ContainerProxy } from "@cloudflare/containers";
import app from "./app";
import { DembrandtContainer } from "./containers/dembrandt";

export { ContainerProxy, DembrandtContainer };

export default {
  fetch: app.fetch,
};
