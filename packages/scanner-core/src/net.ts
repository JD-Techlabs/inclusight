import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { FetchedText, FetchText } from "./crawler";

/**
 * True for loopback, private, link-local (incl. cloud metadata 169.254.169.254), CGNAT,
 * multicast, reserved and unspecified addresses — targets a scanner must never reach (SSRF).
 */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const [a = 0, b = 0] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return (
      lower === "::" ||
      lower === "::1" ||
      /^f[cd]/.test(lower) || // unique local fc00::/7
      /^fe[89ab]/.test(lower) || // link-local fe80::/10
      /^ff/.test(lower) // multicast
    );
  }
  return true; // not an IP at all: treat as unsafe
}

export type LookupAll = (hostname: string) => Promise<string[]>;

const defaultLookup: LookupAll = async (hostname) =>
  (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);

/** Resolves a hostname and rejects it if any address is private. Results are cached per host. */
export function createHostGuard(options: { allowPrivate: boolean; lookupAll?: LookupAll }) {
  const cache = new Map<string, Promise<boolean>>();
  const lookupAll = options.lookupAll ?? defaultLookup;

  return async function isHostAllowed(hostname: string): Promise<boolean> {
    if (options.allowPrivate) return true;
    const host = hostname.replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost")) return false;
    if (isIP(host)) return !isPrivateAddress(host);
    let result = cache.get(host);
    if (!result) {
      result = lookupAll(host)
        .then((addresses) => addresses.length > 0 && !addresses.some(isPrivateAddress))
        .catch(() => false);
      cache.set(host, result);
    }
    return result;
  };
}

const MAX_REDIRECTS = 5;
const MAX_BYTES = 5 * 1024 * 1024;

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Polite, SSRF-safe text fetcher for the crawler and domain verification: identifiable
 * user-agent, timeout, size cap, and every redirect hop re-checked against the host guard.
 */
export function createSafeFetchText(options: {
  userAgent: string;
  allowPrivate: boolean;
  timeoutMs?: number;
  lookupAll?: LookupAll;
}): FetchText {
  const isHostAllowed = createHostGuard(options);

  return async (startUrl: string): Promise<FetchedText | null> => {
    let url = startUrl;
    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        const parsed = new URL(url);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
        if (!(await isHostAllowed(parsed.hostname))) return null;

        const response = await fetch(url, {
          redirect: "manual",
          headers: {
            "user-agent": options.userAgent,
            accept: "text/html,application/xml,text/plain,*/*;q=0.5",
          },
          signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
        });
        const location = response.headers.get("location");
        if (response.status >= 300 && response.status < 400 && location) {
          await response.body?.cancel();
          url = new URL(location, url).toString();
          continue;
        }
        return {
          status: response.status,
          contentType: response.headers.get("content-type") ?? "",
          body: await readCapped(response, MAX_BYTES),
          finalUrl: url,
        };
      }
      return null; // too many redirects
    } catch {
      return null; // network error, timeout, invalid URL
    }
  };
}
