import { describe, expect, it } from "vitest";
import { renderEmail } from "./mailer";

describe("renderEmail", () => {
  it("renders text and HTML with the link", () => {
    const { text, html } = renderEmail({
      to: "a@example.test",
      subject: "Hello",
      paragraphs: ["First", "Second"],
      link: { label: "Open", url: "https://app.example/x?a=1&b=2" },
    });
    expect(text).toBe("First\n\nSecond\n\nOpen: https://app.example/x?a=1&b=2");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<a href="https://app.example/x?a=1&amp;b=2">Open</a>');
  });

  it("escapes user-controlled content in HTML", () => {
    const { html } = renderEmail({
      to: "a@example.test",
      subject: "<b>s</b>",
      paragraphs: ['<script>alert("x")</script>'],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<title>&lt;b&gt;s&lt;/b&gt;</title>");
  });
});
