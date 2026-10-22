import path from "node:path";

// UI consumers must use this same formula (including the full subpath-qualified name).
export function symbolAnchor(name) {
  return `symbol-${encodeURIComponent(name)}`;
}

export function parseExports(
  ts,
  files,
  entrypoints,
  { id, version, sourceUrl = "" },
) {
  const roots = Object.values(entrypoints).map((file) => path.resolve(file));
  const contents = new Map(
    Object.entries(files).map(([file, text]) => [path.resolve(file), text]),
  );
  const options = {
    noLib: true,
    skipLibCheck: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.Latest,
    jsx: ts.JsxEmit.Preserve,
    allowJs: true,
  };
  const host = ts.createCompilerHost(options);
  host.fileExists = (file) => contents.has(path.resolve(file));
  host.readFile = (file) => contents.get(path.resolve(file));
  host.getSourceFile = (file, languageVersion) => {
    const text = host.readFile(file);
    return text === undefined
      ? undefined
      : ts.createSourceFile(file, text, languageVersion, true);
  };
  host.directoryExists = (dir) =>
    [...contents.keys()].some((file) =>
      file.startsWith(`${path.resolve(dir)}/`),
    );
  const program = ts.createProgram(roots, options, host);
  const checker = program.getTypeChecker();
  const printer = ts.createPrinter({ removeComments: false });
  const print = (node) =>
    printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile());
  const publicDeclarations = new Set();
  for (const file of roots) {
    const source = program.getSourceFile(file);
    const module = source && checker.getSymbolAtLocation(source);
    if (!module) continue;
    for (const symbol of checker.getExportsOfModule(module)) {
      const target =
        symbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(symbol)
          : symbol;
      for (const declaration of target.getDeclarations() || [])
        publicDeclarations.add(declaration);
    }
  }
  function printWithContext(nodes) {
    const included = new Set(nodes);
    const context = [];
    const queue = [...nodes];
    for (let index = 0; index < queue.length; index++) {
      const root = queue[index];
      function visit(node) {
        if (ts.isIdentifier(node)) {
          const symbol = checker.getSymbolAtLocation(node);
          for (const dependency of symbol?.getDeclarations() || []) {
            if (
              included.has(dependency) ||
              publicDeclarations.has(dependency) ||
              dependency.getSourceFile() !== root.getSourceFile()
            )
              continue;
            const statement = ts.isVariableDeclaration(dependency)
              ? dependency.parent?.parent
              : dependency;
            if (!statement?.parent || !ts.isSourceFile(statement.parent))
              continue;
            if (
              !(
                ts.isFunctionDeclaration(statement) ||
                ts.isTypeAliasDeclaration(statement) ||
                ts.isInterfaceDeclaration(statement) ||
                ts.isClassDeclaration(statement) ||
                ts.isEnumDeclaration(statement) ||
                ts.isVariableStatement(statement)
              )
            )
              continue;
            if (
              statement.modifiers?.some(
                (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
              )
            )
              continue;
            included.add(dependency);
            context.push(dependency);
            queue.push(dependency);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(root);
    }
    return (
      nodes.map(print).join("\n") +
      (context.length
        ? `\n\n// Referenced local context (not public exports):\n${context.map(print).join("\n\n")}`
        : "")
    );
  }
  const symbols = [];
  for (const [subpath, file] of Object.entries(entrypoints)) {
    const source = program.getSourceFile(path.resolve(file));
    const module = source && checker.getSymbolAtLocation(source);
    if (!module) continue;
    for (const exported of checker.getExportsOfModule(module)) {
      const target =
        exported.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(exported)
          : exported;
      const declarations =
        target.getDeclarations() || exported.getDeclarations() || [];
      const name = `${subpath === "." ? "" : `${subpath.slice(2)}:`}${exported.name}`;
      const description = ts.displayPartsToString(
        target.getDocumentationComment(checker),
      );
      const tags = target
        .getJsDocTags(checker)
        .map((tag) => `@${tag.name} ${ts.displayPartsToString(tag.text)}`);
      const signature = printWithContext(declarations);
      const declaration = declarations[0];
      let kind = "export";
      if (declaration) {
        if (ts.isFunctionDeclaration(declaration)) kind = "function";
        else if (ts.isInterfaceDeclaration(declaration)) kind = "interface";
        else if (ts.isTypeAliasDeclaration(declaration)) kind = "type";
        else if (ts.isClassDeclaration(declaration)) kind = "class";
        else if (ts.isEnumDeclaration(declaration)) kind = "enum";
        else if (ts.isVariableDeclaration(declaration)) kind = "variable";
        else if (ts.isModuleDeclaration(declaration)) kind = "namespace";
      }
      const add = (
        symbolName,
        symbolKind,
        symbolDescription,
        symbolSignature,
      ) =>
        symbols.push({
          name: symbolName,
          kind: symbolKind,
          description: symbolDescription,
          signature: symbolSignature,
          url: `/docs/reference?package=${encodeURIComponent(id)}&version=${encodeURIComponent(version)}#${symbolAnchor(symbolName)}`,
          ...(sourceUrl ? { sourceUrl } : {}),
        });
      add(
        name,
        kind,
        [description, ...tags].filter(Boolean).join("\n"),
        signature || `export { ${exported.name} };`,
      );
      // Generated bindings export command/event/mock namespaces as object literals.
      // Preserve their real property source instead of inventing declaration types.
      function properties(node, prefix) {
        if (!node || !ts.isObjectLiteralExpression(node)) return;
        for (const property of node.properties) {
          if (!property.name) continue;
          const childName = `${prefix}.${property.name.getText(property.getSourceFile()).replace(/^['"]|['"]$/g, "")}`;
          const childSymbol = checker.getSymbolAtLocation(property.name);
          const leading = property
            .getSourceFile()
            .text.slice(property.pos, property.getStart());
          const rawComment =
            leading
              .match(/\/\*\*([\s\S]*?)\*\//)?.[1]
              ?.replace(/^\s*\* ?/gm, "")
              .trim() || "";
          const childDescription =
            (childSymbol
              ? ts.displayPartsToString(
                  childSymbol.getDocumentationComment(checker),
                )
              : "") || rawComment;
          const propertySource = printWithContext([property]);
          add(
            childName,
            ts.isMethodDeclaration(property) ||
              (property.initializer &&
                (ts.isArrowFunction(property.initializer) ||
                  ts.isFunctionExpression(property.initializer)))
              ? "function"
              : "property",
            childDescription,
            propertySource,
          );
          properties(property.initializer, childName);
        }
      }
      if (declaration && ts.isVariableDeclaration(declaration))
        properties(declaration.initializer, name);
    }
  }
  return symbols.toSorted((a, b) => a.name.localeCompare(b.name, "en"));
}

export function declarationEntrypoints(manifest, files) {
  const result = {};
  function declaration(value) {
    if (typeof value === "string") {
      const file = value.replace(/^\.\//, "");
      const candidates = /\.d\.[cm]?ts$/.test(file)
        ? [file]
        : [
            file.replace(/\.[cm]?js$/, ".d.ts"),
            file.replace(/\.mjs$/, ".d.mts"),
            file.replace(/\.cjs$/, ".d.cts"),
          ];
      return candidates.find((candidate) => candidate in files);
    }
    if (value && typeof value === "object") {
      for (const key of [
        "types",
        "typings",
        "import",
        "require",
        "default",
        ...Object.keys(value),
      ]) {
        const found = declaration(value[key]);
        if (found) return found;
      }
    }
  }
  if (manifest.exports) {
    const exports =
      typeof manifest.exports === "object" &&
      Object.keys(manifest.exports).some((key) => key.startsWith("."))
        ? manifest.exports
        : { ".": manifest.exports };
    for (const [subpath, value] of Object.entries(exports)) {
      if (subpath.includes("*")) {
        const text = JSON.stringify(value);
        for (const file of Object.keys(files)) {
          const match = text.match(/"(?:\.\/)?([^"*]*)\*([^"*]*\.d\.[cm]?ts)"/);
          if (match && file.startsWith(match[1]) && file.endsWith(match[2]))
            result[
              subpath.replace(
                "*",
                file.slice(match[1].length, -match[2].length),
              )
            ] = file;
        }
      } else {
        const found = declaration(value);
        if (found) result[subpath] = found;
      }
    }
    // Some published packages expose their root declarations only via the legacy
    // top-level `types` field, while their export map lists JavaScript conditions.
    if ("." in exports && !result["."]) {
      const found = declaration(manifest.types || manifest.typings);
      if (found) result["."] = found;
    }
  } else {
    const found = declaration(
      manifest.types || manifest.typings || manifest.main || "index.d.ts",
    );
    if (found) result["."] = found;
  }
  return result;
}
