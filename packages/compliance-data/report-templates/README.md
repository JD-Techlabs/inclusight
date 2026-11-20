# Report templates

One folder per report type (listed in `reports.yaml`). Templates use
[LiquidJS](https://liquidjs.com) and are rendered to HTML, then to a tagged PDF (PDF/UA-1).
Wording and layout can be changed here without code changes.

- `template.html` — the report. Most reports extend `_layout.html` (title block, "About this
  report" notes) with `{% layout "_layout.html" %}` and fill `{% block content %}`.
- `schema.json` — the data the template receives. Generated from the report builders
  (`pnpm --filter @app/reports schemas:write`); a test fails if it is out of date. Only use
  fields listed there.
- `_partials/` — shared fragments, included with `{% render "_partials/…", name: value %}`.

Every value is HTML-escaped automatically. The statement's `statement.md` uses the `md` filter
to escape Markdown.

## Keep the PDFs accessible (tested with veraPDF on every change)

- Use real headings in order (`h1` once, then `h2`, `h3`), lists and tables.
- Tables need a `<caption>`, header cells `<th scope="col">` / `<th scope="row">`.
- Keep list items (`<li>`) as plain text: Chromium tags inline elements such as `<strong>`
  inside a list item in a way PDF/UA does not allow.
- No scripts, images or external files (fonts, stylesheets): rendering runs offline with
  JavaScript disabled.
- Never convey meaning by colour alone; status values are always written out.
- Keep the "About this report" notes: automated checks find only part of all issues, and the
  report assists compliance but does not certify it.
