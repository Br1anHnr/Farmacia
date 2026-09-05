import { createHmac, timingSafeEqual, createHash } from "node:crypto";
export function validSignature(
  raw: Buffer,
  timestamp: string | undefined,
  signature: string | undefined,
  secret: string,
  now = Date.now(),
) {
  if (
    secret.length < 32 ||
    !timestamp ||
    !/^\d{10}$/.test(timestamp) ||
    !signature ||
    !/^sha256=[a-f0-9]{64}$/.test(signature)
  )
    return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(timestamp + ".")
    .update(raw)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
export function stableJson(value: any): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + stableJson(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export function eventDigest(value: any) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}
export function validInternalToken(
  provided: string | undefined,
  secret: string,
) {
  if (secret.length < 32 || !provided) return false;
  const actual = Buffer.from(provided),
    expected = Buffer.from("Bearer " + secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
