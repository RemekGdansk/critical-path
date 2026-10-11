// Decides whether built HTML enforces the no-egress Content Security Policy
// (PRD guardrail: no project data leaves the device). Pure: HTML strings in,
// violations out; no file system, no clock and no reading of astro.config.mjs,
// because a check that compares the config with the HTML passes whenever both
// are loosened together. Each violation names the oracle rule it breaks
// (context/changes/testing-csp-artifact-check/plan.md, "Oracle").
//
// Run by node directly (scripts/check-built-csp.ts), so erasable TypeScript only.
import { parse } from "parse5";
import type { DefaultTreeAdapterTypes } from "parse5";

type Element = DefaultTreeAdapterTypes.Element;
type ParentNode = DefaultTreeAdapterTypes.ParentNode;

export interface BuiltPage {
  path: string;
  html: string;
}

interface Directive {
  name: string;
  tokens: string[];
}

const CSP_HTTP_EQUIV = "content-security-policy";
// Keywords and schemes compared lower-cased; hash sources keep their case-sensitive base64.
const ALLOWED_SOURCES = new Set(["'self'", "'none'", "data:"]);
const HASH_SOURCE = /^'sha(256|384|512)-[A-Za-z0-9+/_=-]+'$/i;
const URL_ATTRIBUTES = new Set(["src", "href", "srcset", "imagesrcset", "data", "action", "formaction", "poster"]);
const SRCSET_ATTRIBUTES = new Set(["srcset", "imagesrcset"]);
// Elements that run script, rebase URLs or load through CSS; before the meta they act outside the policy.
const BEFORE_META_FORBIDDEN = new Set(["script", "base", "style"]);
// An absolute http(s) URL, or a scheme-relative one; URL parsing treats "\" like "/" here.
const THIRD_PARTY_URL = /^(https?:|[\\/]{2})/i;

/** Every element under `root` in document order, including the content of `<template>`. */
function elementsInOrder(root: ParentNode): Element[] {
  const elements: Element[] = [];
  const visit = (node: ParentNode): void => {
    for (const child of node.childNodes) {
      if (!("tagName" in child)) continue;
      elements.push(child);
      visit(child);
      if ("content" in child) visit(child.content);
    }
  };
  visit(root);
  return elements;
}

function attribute(element: Element, name: string): string | undefined {
  return element.attrs.find((attr) => attr.name === name)?.value;
}

function describeElement(element: Element): string {
  const urlAttribute = element.attrs.find((attr) => URL_ATTRIBUTES.has(attr.name));
  return urlAttribute === undefined
    ? `<${element.tagName}>`
    : `<${element.tagName} ${urlAttribute.name}="${urlAttribute.value}">`;
}

function isCspMeta(element: Element): boolean {
  return element.tagName === "meta" && attribute(element, "http-equiv")?.toLowerCase() === CSP_HTTP_EQUIV;
}

/** The policy's directives in order, names lower-cased, repeats kept. */
function parsePolicy(policy: string): Directive[] {
  return policy
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .filter(([name]) => name !== "")
    .map(([name, ...tokens]) => ({ name: name.toLowerCase(), tokens }));
}

function isAllowedSource(token: string): boolean {
  return ALLOWED_SOURCES.has(token.toLowerCase()) || HASH_SOURCE.test(token);
}

/** The URLs an attribute value asks the browser to fetch; `srcset` and `imagesrcset` hold several. */
function urlsOf(attributeName: string, value: string): string[] {
  const urls = SRCSET_ATTRIBUTES.has(attributeName)
    ? value.split(",").map((candidate) => candidate.trim().split(/\s+/)[0] ?? "")
    : [value];
  // URL parsing strips tabs and newlines anywhere and surrounding whitespace.
  return urls.map((url) => url.replace(/[\t\n\r]/g, "").trim());
}

function checkPolicy(policy: string): string[] {
  const violations: string[] = [];
  const directives = parsePolicy(policy);

  const seen = new Set<string>();
  for (const { name } of directives) {
    if (seen.has(name)) violations.push(`rule 3 (no repeated directive): ${name} appears more than once`);
    seen.add(name);
  }

  for (const required of ["default-src", "connect-src"]) {
    // A browser applies the first occurrence of a directive and ignores the rest.
    const directive = directives.find(({ name }) => name === required);
    if (directive === undefined) {
      violations.push(`rule 4 (default-src and connect-src are 'none'): ${required} is missing`);
    } else if (directive.tokens.join(" ").toLowerCase() !== "'none'") {
      violations.push(
        `rule 4 (default-src and connect-src are 'none'): ${required} must be exactly 'none', found "${directive.tokens.join(" ")}"`,
      );
    }
  }

  for (const { name, tokens } of directives) {
    for (const token of tokens.filter((source) => !isAllowedSource(source))) {
      violations.push(`rule 5 (source allowlist): ${name} allows ${token}`);
    }
  }
  return violations;
}

/** Every oracle rule the page breaks, one violation per offending item; empty when the page passes. */
export function checkPage(html: string): string[] {
  const violations: string[] = [];
  const elements = elementsInOrder(parse(html));
  const metas = elements.filter(isCspMeta);

  if (metas.length !== 1) {
    violations.push(`rule 2 (one CSP meta in <head>): expected exactly 1 CSP <meta>, found ${metas.length}`);
  }
  for (const meta of metas) {
    const parent = meta.parentNode;
    if (parent === null || !("tagName" in parent) || parent.tagName !== "head") {
      violations.push("rule 2 (one CSP meta in <head>): the CSP <meta> is not a child of <head>");
    }
    violations.push(...checkPolicy(attribute(meta, "content") ?? ""));
  }

  // A meta CSP governs only what is parsed after it, so nothing before it may run script or load through CSS.
  const firstMeta = metas.at(0);
  if (firstMeta !== undefined) {
    for (const element of elements.slice(0, elements.indexOf(firstMeta))) {
      if (BEFORE_META_FORBIDDEN.has(element.tagName)) {
        violations.push(`rule 6 (nothing loads before the CSP meta): ${describeElement(element)} comes before it`);
      } else if (attribute(element, "style") !== undefined) {
        violations.push(
          `rule 6 (nothing loads before the CSP meta): a style attribute on <${element.tagName}> comes before it`,
        );
      }
    }
  }

  // <a href> is navigation, not a fetch.
  for (const element of elements.filter(({ tagName }) => tagName !== "a")) {
    for (const { name, value } of element.attrs.filter((attr) => URL_ATTRIBUTES.has(attr.name))) {
      for (const url of urlsOf(name, value).filter((candidate) => THIRD_PARTY_URL.test(candidate))) {
        violations.push(`rule 7 (no third-party URL): <${element.tagName} ${name}="${url}">`);
      }
    }
  }
  return violations;
}

/** Every page's violations prefixed with its path, plus one when the build holds no page. */
export function checkBuild(pages: readonly BuiltPage[]): string[] {
  if (pages.length === 0) return ["rule 1 (at least one page): the build holds no HTML page"];
  return pages.flatMap(({ path, html }) => checkPage(html).map((violation) => `${path}: ${violation}`));
}
