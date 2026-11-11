import convert from "npm-to-yarn";

const managers = ["pnpm", "yarn", "bun"] as const;

function convertLines(command: string, manager: (typeof managers)[number]) {
  return command
    .split("\n")
    .map((line) => convert(line, manager))
    .join("\n");
}

type Node = {
  type: string;
  lang?: string;
  value?: string;
  children?: Node[];
  [key: string]: unknown;
};

/**
 * Turn `npm` code fences into package-manager tabs, matching the old
 * Fumadocs `remarkNpm` behaviour. Rspress's `PackageManagerTabs` persists the
 * selected manager through its shared `package.manager` tab group.
 */
export function remarkPackageManagerTabs() {
  return (tree: Node) => {
    const walk = (node: Node) => {
      if (!Array.isArray(node.children)) return;

      node.children = node.children.map((child) => {
        if (
          child.type !== "code" ||
          (child.lang !== "npm" && child.lang !== "package-install")
        ) {
          walk(child);
          return child;
        }

        const raw = child.value ?? "";
        const npm =
          child.lang === "package-install" && !/^(npm|npx)\b/.test(raw)
            ? `npm install ${raw}`
            : raw;

        return {
          type: "mdxJsxFlowElement",
          name: "PackageManagerCommands",
          attributes: [
            {
              type: "mdxJsxAttribute",
              name: "commands",
              value: JSON.stringify({
                npm,
                pnpm: convertLines(npm, "pnpm"),
                yarn: convertLines(npm, "yarn"),
                bun: convertLines(npm, "bun"),
              }),
            },
          ],
          children: [],
        };
      });
    };

    walk(tree);
  };
}
