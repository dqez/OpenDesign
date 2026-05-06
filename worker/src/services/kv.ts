export type IpUsage = { count: number; firstSeen: string; lastSeen: string };

export async function getIpUsage(
  kv: KVNamespace,
  ipHash: string,
): Promise<IpUsage | null> {
  return kv.get<IpUsage>(`ip:${ipHash}`, "json");
}

export async function incrementIpUsage(
  kv: KVNamespace,
  ipHash: string,
): Promise<IpUsage> {
  const now = new Date().toISOString();
  const current = await getIpUsage(kv, ipHash);
  const next = {
    count: (current?.count ?? 0) + 1,
    firstSeen: current?.firstSeen ?? now,
    lastSeen: now,
  };
  await kv.put(`ip:${ipHash}`, JSON.stringify(next), {
    expirationTtl: 60 * 60 * 24 * 90,
  });
  return next;
}
