export function healthPayload() {
  return {
    ok: true,
    service:
      process.env.CONTAINER_SERVICE_NAME ?? "opendesign-dembrandt-container",
  };
}
