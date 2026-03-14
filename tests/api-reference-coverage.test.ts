import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApiReferenceKey, getDocumentedApiReferenceKeys, type HttpMethod } from "@/lib/api-reference";

const projectRoot = process.cwd();
const apiRoot = path.join(projectRoot, "app", "api");
const routeMethodPattern = /^export\s+async\s+function\s+(GET|POST|PATCH|DELETE)\b/gm;

function collectRouteFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const nestedFiles = entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectRouteFiles(fullPath);
    }

    if (entry.isFile() && entry.name === "route.ts") {
      return [fullPath];
    }

    return [];
  });

  return nestedFiles;
}

function toDocumentedPath(routeFilePath: string) {
  const relativePath = path.relative(apiRoot, routeFilePath).replace(/\\/g, "/");
  const routeSegments = relativePath
    .split("/")
    .slice(0, -1)
    .map((segment) => {
      const dynamicMatch = segment.match(/^\[(.+)\]$/);
      if (dynamicMatch) {
        return `:${dynamicMatch[1]}`;
      }
      return segment;
    });

  return `/api/${routeSegments.join("/")}`;
}

function extractMethods(routeFilePath: string): HttpMethod[] {
  const source = readFileSync(routeFilePath, "utf8");
  const methods = new Set<HttpMethod>();
  let match = routeMethodPattern.exec(source);

  while (match) {
    methods.add(match[1] as HttpMethod);
    match = routeMethodPattern.exec(source);
  }

  return [...methods];
}

describe("api reference coverage", () => {
  it("documents every live route method-path pair", () => {
    const routeFiles = collectRouteFiles(apiRoot);
    const discoveredKeys = new Set<string>();

    for (const routeFile of routeFiles) {
      const routePath = toDocumentedPath(routeFile);
      const methods = extractMethods(routeFile);
      for (const method of methods) {
        discoveredKeys.add(createApiReferenceKey(method, routePath));
      }
    }

    const documentedKeys = getDocumentedApiReferenceKeys();

    const missingInDocs = [...discoveredKeys].filter((key) => !documentedKeys.has(key)).sort();
    const staleInDocs = [...documentedKeys].filter((key) => !discoveredKeys.has(key)).sort();

    expect(missingInDocs).toEqual([]);
    expect(staleInDocs).toEqual([]);
  });
});

