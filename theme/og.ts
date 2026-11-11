import { createElement as h, type ReactElement } from "react";

const logoSource = "spectaLogo";

const pillars = [
  {
    label: "Typesafety",
    color: "linear-gradient(135deg, #F74C00 0%, #CE422B 100%)",
  },
  {
    label: "Developer experience",
    color: "linear-gradient(135deg, #F49600 0%, #FFC131 100%)",
  },
  {
    label: "Modern practices",
    color: "linear-gradient(135deg, #FF6B00 0%, #F74C00 100%)",
  },
  {
    label: "Scale",
    color: "linear-gradient(135deg, #CE422B 0%, #A03622 100%)",
  },
];

/**
 * The social card shown for every documentation page. It is rendered at build
 * time by `scripts/og.ts`, so it uses plain React elements rather than JSX
 * (the Rspress config loader does not compile JSX from imported modules).
 */
export function OpenGraph(props: { title: string; description?: string }) {
  return h(
    "div",
    {
      style: {
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        backgroundColor: "#0a0a0a",
        padding: "80px",
        fontFamily: "system-ui",
        backgroundImage:
          "radial-gradient(circle at 20% 30%, rgba(247, 76, 0, 0.25) 0%, transparent 40%), radial-gradient(circle at 80% 20%, rgba(244, 150, 0, 0.2) 0%, transparent 45%), radial-gradient(circle at 60% 80%, rgba(255, 107, 0, 0.18) 0%, transparent 50%), radial-gradient(circle at 10% 90%, rgba(206, 66, 43, 0.15) 0%, transparent 40%)",
      },
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "24px" } },
      h("img", {
        src: logoSource,
        alt: "Specta logo",
        style: { width: "100px", height: "100px", objectFit: "contain" },
      }),
      h(
        "div",
        {
          style: {
            fontSize: "42px",
            fontWeight: "bold",
            color: "white",
            letterSpacing: "-0.02em",
          },
        },
        "specta-rs",
      ),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          maxWidth: "900px",
          marginTop: "-40px",
        },
      },
      h(
        "h1",
        {
          style: {
            fontSize: "72px",
            fontWeight: "bold",
            lineHeight: "1.1",
            color: "white",
            margin: 0,
            letterSpacing: "-0.03em",
          },
        },
        props.title,
      ),
      h(
        "p",
        {
          style: {
            fontSize: "32px",
            lineHeight: "1.4",
            color: "#a1a1aa",
            margin: 0,
            marginTop: "-12px",
          },
        },
        props.description,
      ),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "22px",
          color: "#71717a",
        },
      },
      ...pillars.flatMap(({ label, color }, index) => {
        const item: ReactElement[] = [
          h(
            "div",
            {
              style: { display: "flex", alignItems: "center", gap: "8px" },
            },
            h("div", {
              style: {
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                background: color,
              },
            }),
            h("span", null, label),
          ),
        ];
        if (index < pillars.length - 1) {
          item.push(h("span", { style: { color: "#3f3f46" } }, "•"));
        }
        return item;
      }),
    ),
  );
}

export { logoSource };
