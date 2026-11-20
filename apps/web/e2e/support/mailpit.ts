const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://localhost:8025";

type MessageSummary = { ID: string; Subject: string };

/** Plain-text bodies of every message currently in the inbox for `recipient`. */
export async function emailTextsFor(recipient: string): Promise<string[]> {
  const search = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${recipient}"`)}`,
  );
  const { messages } = (await search.json()) as { messages: MessageSummary[] };
  return Promise.all(
    messages.map(async (summary) => {
      const message = await fetch(`${MAILPIT_URL}/api/v1/message/${summary.ID}`);
      return ((await message.json()) as { Text: string }).Text;
    }),
  );
}

/** Polls the local Mailpit inbox for the newest message to `recipient` and returns a link from it. */
export async function waitForEmailLink(recipient: string, linkPattern: RegExp): Promise<string> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const search = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${recipient}"`)}`,
    );
    if (search.ok) {
      const { messages } = (await search.json()) as { messages: MessageSummary[] };
      for (const summary of messages) {
        const message = await fetch(`${MAILPIT_URL}/api/v1/message/${summary.ID}`);
        const { Text } = (await message.json()) as { Text: string };
        const match = Text.match(linkPattern);
        if (match) return match[0];
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No email with a matching link arrived for the test recipient`);
}
