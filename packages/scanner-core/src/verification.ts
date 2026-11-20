import type { FetchText } from "./crawler";
import { extractMetaContent } from "./html-extract";

/** Domain verification (spec §7.1): proves the customer controls the host before full crawls. */
export const VERIFICATION_METHODS = ["dns_txt", "meta_tag", "well_known_file"] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export const VERIFICATION_META_NAME = "a11ycomply-verification";
export const VERIFICATION_WELL_KNOWN_PATH = "/.well-known/a11ycomply.txt";
export const VERIFICATION_TXT_PREFIX = "a11ycomply-verification=";

export type VerificationResult = { verified: boolean; detail: string };

export type VerificationDeps = {
  fetchText: FetchText;
  resolveTxt: (hostname: string) => Promise<string[][]>;
};

/** Exact instructions shown to the user for each method. */
export function verificationInstructions(
  method: VerificationMethod,
  baseUrl: string,
  token: string,
) {
  const host = new URL(baseUrl).hostname;
  switch (method) {
    case "dns_txt":
      return { where: `DNS TXT record on ${host}`, value: `${VERIFICATION_TXT_PREFIX}${token}` };
    case "meta_tag":
      return {
        where: `In the <head> of ${new URL(baseUrl).origin}/`,
        value: `<meta name="${VERIFICATION_META_NAME}" content="${token}">`,
      };
    case "well_known_file":
      return {
        where: `File at ${new URL(baseUrl).origin}${VERIFICATION_WELL_KNOWN_PATH}`,
        value: token,
      };
  }
}

export async function checkVerification(
  method: VerificationMethod,
  baseUrl: string,
  token: string,
  deps: VerificationDeps,
): Promise<VerificationResult> {
  const url = new URL(baseUrl);

  if (method === "dns_txt") {
    let records: string[][];
    try {
      records = await deps.resolveTxt(url.hostname);
    } catch {
      return { verified: false, detail: `No TXT records were found for ${url.hostname}.` };
    }
    const found = records.some(
      (chunks) => chunks.join("").trim() === `${VERIFICATION_TXT_PREFIX}${token}`,
    );
    return found
      ? { verified: true, detail: "The DNS TXT record was found." }
      : {
          verified: false,
          detail: `The TXT record was not found on ${url.hostname}. DNS changes can take time to appear.`,
        };
  }

  if (method === "meta_tag") {
    const response = await deps.fetchText(`${url.origin}/`);
    if (!response || response.status !== 200) {
      return { verified: false, detail: "The home page could not be loaded." };
    }
    const content = extractMetaContent(response.body, VERIFICATION_META_NAME);
    return content === token
      ? { verified: true, detail: "The verification meta tag was found." }
      : { verified: false, detail: "The verification meta tag was not found on the home page." };
  }

  const response = await deps.fetchText(`${url.origin}${VERIFICATION_WELL_KNOWN_PATH}`);
  if (!response || response.status !== 200) {
    return { verified: false, detail: `${VERIFICATION_WELL_KNOWN_PATH} could not be loaded.` };
  }
  return response.body.trim() === token
    ? { verified: true, detail: "The verification file was found." }
    : { verified: false, detail: "The verification file does not contain the expected token." };
}
