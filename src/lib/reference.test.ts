import assert from "node:assert/strict";
import test from "node:test";
import { filterSymbols, selectedSymbol, symbolAnchor } from "./reference.ts";
import { searchReference } from "./reference-search.ts";

const symbols = [
  {
    name: "createClient",
    kind: "function",
    description: "Create a typed client",
    signature: "function createClient(options: ClientOptions): Client",
    url: "/docs/reference?package=ts-client&version=1#function-createClient",
  },
  {
    name: "ClientOptions",
    kind: "interface",
    description: "Client configuration",
    url: "/docs/reference?package=ts-client&version=1#interface-ClientOptions",
  },
];

test("symbol filtering matches names, descriptions, signatures and multiple terms", () => {
  assert.equal(filterSymbols(symbols, "CREATE typed")[0].name, "createClient");
  assert.equal(filterSymbols(symbols, "ClientOptions").length, 2);
  assert.equal(filterSymbols(symbols, "missing").length, 0);
  assert.equal(filterSymbols(symbols, "  ").length, 2);
});

test("anchors preserve generated stable symbol URLs", () => {
  assert.equal(symbolAnchor(symbols[0]), "function-createClient");
});

test("an explicitly linked symbol remains visible when a filter hides it", () => {
  assert.equal(
    selectedSymbol(symbols, "configuration", symbolAnchor(symbols[0])),
    symbols[0],
  );
  assert.equal(
    selectedSymbol(symbols, "missing", symbolAnchor(symbols[0])),
    symbols[0],
  );
  assert.equal(selectedSymbol(symbols, "configuration", ""), symbols[1]);
});

const records = symbols.map((symbol) => ({
  name: symbol.name,
  url: symbol.url,
  package: "@rspc/client",
  version: "1",
  language: "typescript",
  text: `${symbol.description} ${symbol.signature || ""}`,
}));

test("global reference search ranks exact symbols and includes provenance", () => {
  const result = searchReference(records, "ClientOptions");
  assert.equal(result[0].content, "ClientOptions");
  assert.equal(result[0].url, symbols[1].url);
  assert.ok(result[0].breadcrumbs[1].includes("@rspc/client · 1"));
  assert.equal(searchReference(records, " ").length, 0);
  assert.equal(searchReference(records, "client", 1).length, 1);
});
