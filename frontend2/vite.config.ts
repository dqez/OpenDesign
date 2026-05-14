import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react(), appHtmlConfig(env)],
  };
});

function appHtmlConfig(env: Record<string, string>): Plugin {
  const appName = env.VITE_APP_NAME || "OpenDesign";
  const title =
    env.VITE_APP_TITLE ||
    `${appName} - Website Design Tokens for Modern AI UI Teams`;
  const description =
    env.VITE_APP_DESCRIPTION ||
    `${appName} turns any website URL into reusable design tokens, DESIGN.md files, and visual brand previews for frontend teams and AI agents.`;
  const ogImage = env.VITE_OG_IMAGE || "/og-image.png";

  return {
    name: "app-html-config",
    transformIndexHtml(html) {
      return html
        .replaceAll("__APP_NAME__", appName)
        .replaceAll("__APP_TITLE__", title)
        .replaceAll("__APP_DESCRIPTION__", description)
        .replaceAll("__OG_IMAGE__", ogImage);
    },
  };
}
