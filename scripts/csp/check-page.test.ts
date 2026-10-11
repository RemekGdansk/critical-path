import { describe, expect, it } from "vitest";

import { checkBuild, checkPage } from "./check-page.ts";

// Every fixture is written by hand from the oracle in
// context/changes/testing-csp-artifact-check/plan.md; none is copied from dist/
// and none reads astro.config.mjs. Row letters (a)–(g) are the failure paths of
// the research table in context/changes/testing-csp-artifact-check/research.md.

/** The meta a page enforces its policy with. */
function cspMeta(policy: string): string {
  return `<meta http-equiv="content-security-policy" content="${policy}">`;
}

/** A page with `policy` in a CSP meta in <head> (none when undefined), after `beforeMeta` and before `afterMeta`. */
function page({
  policy,
  beforeMeta = "",
  afterMeta = "",
  body = "",
}: {
  policy: string | undefined;
  beforeMeta?: string;
  afterMeta?: string;
  body?: string;
}): string {
  const meta = policy === undefined ? "" : cspMeta(policy);
  return `<!doctype html><html lang="en"><head>${beforeMeta}${meta}${afterMeta}</head><body>${body}</body></html>`;
}

// The smallest policy the oracle accepts (rule 4).
const minimal = "default-src 'none'; connect-src 'none'; worker-src 'none'; form-action 'none'";

// Shaped like the current build: the full deny-list, then script-src and style-src with 'self' and hash sources.
const fullPolicy = [
  "default-src 'none'",
  "connect-src 'none'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "manifest-src 'self'",
  "object-src 'none'",
  "worker-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "script-src 'self' 'sha256-U2NyaXB0SGFzaE9uZUZvclRoZUlzbGFuZEJ1bmRsZT0=' 'sha256-QW5vdGhlckhhc2g='",
  "style-src 'self' 'sha256-U3R5bGVIYXNoT25l'",
].join("; ");

const passing = [
  {
    name: "a page shaped like the current build",
    html: page({
      policy: fullPolicy,
      beforeMeta:
        '<meta charset="UTF-8"><meta name="viewport" content="width=device-width"><link rel="icon" type="image/png" href="/favicon.png"><title>Critical Path</title>',
      afterMeta: "<style>main{margin:0}</style><script>window.island = 1;</script>",
      body: '<main><a href="https://reactflow.dev">React Flow</a></main>',
    }),
  },
  {
    name: "HTTP-EQUIV and its value in upper case",
    html: `<!doctype html><html><head><META HTTP-EQUIV="Content-Security-Policy" CONTENT="${minimal}"></head><body></body></html>`,
  },
];

const rejected = [
  {
    name: "(a) connect-src loosened to a third-party origin",
    html: page({ policy: "default-src 'none'; connect-src 'self' https://x.example" }),
    mentions: ["rule 4", "connect-src", "https://x.example"],
  },
  {
    name: "(b/c/g) no CSP meta at all",
    html: page({ policy: undefined }),
    mentions: ["rule 2", "found 0"],
  },
  {
    name: "the CSP meta inside <body>",
    html: page({ policy: undefined, body: cspMeta(minimal) }),
    mentions: ["rule 2", "not a child of <head>"],
  },
  {
    name: "two CSP metas",
    html: page({ policy: minimal, afterMeta: cspMeta(minimal) }),
    mentions: ["rule 2", "found 2"],
  },
  {
    name: "default-src missing",
    html: page({ policy: "connect-src 'none'" }),
    mentions: ["rule 4", "default-src is missing"],
  },
  {
    name: "default-src 'self'",
    html: page({ policy: "default-src 'self'; connect-src 'none'" }),
    mentions: ["rule 4", "default-src", "'self'"],
  },
  {
    name: "connect-src missing",
    html: page({ policy: "default-src 'none'" }),
    mentions: ["rule 4", "connect-src is missing"],
  },
  {
    name: "worker-src 'self' lets a same-origin worker fetch under its own policy",
    html: page({ policy: "default-src 'none'; connect-src 'none'; worker-src 'self'; form-action 'none'" }),
    mentions: ["rule 4", "worker-src", "'self'"],
  },
  {
    name: "worker-src missing, so workers fall back to script-src",
    html: page({ policy: "default-src 'none'; connect-src 'none'; form-action 'none'; script-src 'self'" }),
    mentions: ["rule 4", "worker-src is missing"],
  },
  {
    name: "form-action missing, which does not fall back to default-src",
    html: page({ policy: "default-src 'none'; connect-src 'none'; worker-src 'none'" }),
    mentions: ["rule 4", "form-action is missing"],
  },
  {
    name: "(d) img-src with a third-party origin",
    html: page({ policy: `${minimal}; img-src 'self' https://x.example` }),
    mentions: ["rule 5", "img-src", "https://x.example"],
  },
  {
    name: "(d) font-src *",
    html: page({ policy: `${minimal}; font-src *` }),
    mentions: ["rule 5", "font-src", "*"],
  },
  {
    name: "(d) img-src https:",
    html: page({ policy: `${minimal}; img-src https:` }),
    mentions: ["rule 5", "img-src", "https:"],
  },
  {
    name: "(d) connect-src wss:",
    html: page({ policy: "default-src 'none'; connect-src wss:" }),
    mentions: ["rule 5", "connect-src", "wss:"],
  },
  {
    name: "script-src 'unsafe-inline'",
    html: page({ policy: `${minimal}; script-src 'self' 'unsafe-inline'` }),
    mentions: ["rule 5", "script-src", "'unsafe-inline'"],
  },
  {
    name: "script-src 'unsafe-eval'",
    html: page({ policy: `${minimal}; script-src 'self' 'unsafe-eval'` }),
    mentions: ["rule 5", "script-src", "'unsafe-eval'"],
  },
  {
    name: "script-src 'strict-dynamic'",
    html: page({ policy: `${minimal}; script-src 'self' 'strict-dynamic'` }),
    mentions: ["rule 5", "script-src", "'strict-dynamic'"],
  },
  {
    name: "script-src with a nonce",
    html: page({ policy: `${minimal}; script-src 'self' 'nonce-cmFuZG9t'` }),
    mentions: ["rule 5", "script-src", "'nonce-cmFuZG9t'"],
  },
  {
    name: "script-src 'unsafe-hashes'",
    html: page({ policy: `${minimal}; script-src 'self' 'unsafe-hashes'` }),
    mentions: ["rule 5", "script-src", "'unsafe-hashes'"],
  },
  {
    name: "default-src joined to 'none' by a non-breaking space, which CSP does not split on",
    html: page({ policy: "default-src\u00a0'none'; connect-src 'none'; worker-src 'none'; form-action 'none'" }),
    mentions: ["rule 4", "default-src is missing"],
  },
  {
    name: "report-uri sends violation reports off the device",
    html: page({ policy: `${minimal}; report-uri https://x.example/r` }),
    mentions: ["rule 5", "report-uri", "https://x.example/r"],
  },
  {
    name: "report-to names a reporting group",
    html: page({ policy: `${minimal}; report-to g` }),
    mentions: ["rule 5", "report-to"],
  },
  {
    name: "(f) connect-src repeated, the loosened copy second",
    html: page({ policy: "default-src 'none'; connect-src 'none'; connect-src https://x.example" }),
    mentions: ["rule 3", "connect-src"],
  },
  {
    name: "(f) connect-src repeated, the loosened copy first",
    html: page({ policy: "default-src 'none'; connect-src https://x.example; connect-src 'none'" }),
    mentions: ["rule 3", "connect-src"],
  },
  {
    name: "(e) an external <script src> before the meta",
    html: page({ policy: minimal, beforeMeta: '<script src="https://x.example/a.js"></script>' }),
    mentions: ["rule 6", "<script", "https://x.example/a.js"],
  },
  {
    name: "(e) an inline <script> before the meta",
    html: page({ policy: minimal, beforeMeta: "<script>new Image().src = '/p';</script>" }),
    mentions: ["rule 6", "<script>"],
  },
  {
    name: "(e) <base> before the meta",
    html: page({ policy: minimal, beforeMeta: '<base href="/">' }),
    mentions: ["rule 6", "<base"],
  },
  {
    name: "(e) an inline <style> importing a third-party stylesheet before the meta",
    html: page({ policy: minimal, beforeMeta: '<style>@import url("https://x.example/a.css");</style>' }),
    mentions: ["rule 6", "<style>"],
  },
  {
    name: "(e) a style attribute loading a third-party image before the meta",
    html: `<!doctype html><html style="background:url(https://x.example/p.gif)"><head>${cspMeta(minimal)}</head><body></body></html>`,
    mentions: ["rule 6", "style attribute", "<html>"],
  },
  {
    name: "(e) a <noscript> pixel before the meta, which pushes the meta out of <head> with JS off",
    html: page({ policy: minimal, beforeMeta: '<noscript><img src="https://x.example/p.gif" alt=""></noscript>' }),
    mentions: ["rule 6", "<noscript>"],
  },
  {
    name: "an <img> with a third-party src in <body>",
    html: page({ policy: minimal, body: '<img src="https://x.example/p.gif" alt="">' }),
    mentions: ["rule 7", "<img", "https://x.example/p.gif"],
  },
  {
    name: "a preconnect <link> to a third-party origin after the meta",
    html: page({ policy: minimal, afterMeta: '<link rel="preconnect" href="https://x.example">' }),
    mentions: ["rule 7", "<link", "https://x.example"],
  },
  {
    name: "an <img> with a protocol-relative src",
    html: page({ policy: minimal, body: '<img src="//x.example/p.gif" alt="">' }),
    mentions: ["rule 7", "<img", "//x.example/p.gif"],
  },
  {
    name: "an <img> with a third-party src inside <template>",
    html: page({ policy: minimal, body: '<template><img src="https://x.example/p.gif" alt=""></template>' }),
    mentions: ["rule 7", "<img", "https://x.example/p.gif"],
  },
  {
    name: "an <img> with a backslash scheme-relative src",
    html: page({ policy: minimal, body: '<img src="\\\\x.example/p.gif" alt="">' }),
    mentions: ["rule 7", "<img", "\\\\x.example/p.gif"],
  },
  {
    name: "an <img> whose third-party src hides a tab in its scheme",
    html: page({ policy: minimal, body: '<img src="ht\ttps://x.example/p.gif" alt="">' }),
    mentions: ["rule 7", "<img", "https://x.example/p.gif"],
  },
  {
    name: "a preload <link> whose third-party href starts with a control character",
    html: page({ policy: minimal, afterMeta: '<link rel="preload" as="script" href="\u0001https://x.example/a.js">' }),
    mentions: ["rule 7", "<link", "https://x.example/a.js"],
  },
  {
    name: "an <img> with a third-party candidate in srcset",
    html: page({ policy: minimal, body: '<img src="/a.png" srcset="/a.png 1x, https://x.example/b.png 2x" alt="">' }),
    mentions: ["rule 7", "<img", "https://x.example/b.png"],
  },
  {
    name: "a preload <link> with a third-party candidate in imagesrcset",
    html: page({
      policy: minimal,
      afterMeta: '<link rel="preload" as="image" imagesrcset="/a.png 1x, https://x.example/b.png 2x">',
    }),
    mentions: ["rule 7", "<link imagesrcset", "https://x.example/b.png"],
  },
];

describe("checkPage", () => {
  it.each(passing)("passes $name", ({ html }) => {
    expect(checkPage(html)).toEqual([]);
  });

  it.each(rejected)("rejects $name", ({ html, mentions }) => {
    const violations = checkPage(html);
    // One violation must name both the rule and the offending item, so an unrelated rule firing cannot pass the row.
    const matching = violations.filter((violation) => mentions.every((mention) => violation.includes(mention)));
    expect(matching, `no violation mentions ${mentions.join(", ")} in:\n${violations.join("\n")}`).not.toEqual([]);
  });
});

describe("checkBuild", () => {
  it("rejects a build with no HTML page", () => {
    expect(checkBuild([])).toEqual([expect.stringContaining("rule 1")]);
  });

  it("prefixes each violation with the path of the page that breaks it", () => {
    const violations = checkBuild([
      { path: "dist/index.html", html: page({ policy: minimal }) },
      { path: "dist/404.html", html: page({ policy: undefined }) },
    ]);
    expect(violations).toEqual([expect.stringMatching(/^dist\/404\.html: rule 2/)]);
  });

  it("passes a build whose every page passes", () => {
    expect(checkBuild([{ path: "dist/index.html", html: page({ policy: minimal }) }])).toEqual([]);
  });
});
