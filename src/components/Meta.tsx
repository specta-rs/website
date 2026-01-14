// TODO: Having to put this on every page is cringe but it's currently the best solution in Waku
// https://github.com/wakujs/waku/issues/1903

const canonical = "https://specta.dev";

export const openGraphImageSize = [1200, 630];

export function Meta(props: {
  title?: string;
  description?: string;
  openGraphImage?: string;
}) {
  const title = props.title || "specta-rs";
  const description =
    props.description ||
    "An ecosystem of crates focused on typesafety, developer experience, modern practices allowing you to build faster and deploy with confidence.";
  const openGraphImage = props.openGraphImage || "/docs/og.png";

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />

      <meta property="og:locale" content="en_US" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={`${canonical}${openGraphImage}`} />
      <meta
        property="og:image:width"
        content={openGraphImageSize[0].toString()}
      />
      <meta
        property="og:image:height"
        content={openGraphImageSize[1].toString()}
      />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:alt" content="Oscar Beaumont" />
      <meta property="twitter:card" content="summary_large_image" />

      <meta
        property="twitter:image"
        content={`${canonical}${openGraphImage}`}
      />
      <meta
        property="twitter:image:width"
        content={openGraphImageSize[0].toString()}
      />
      <meta
        property="twitter:image:height"
        content={openGraphImageSize[1].toString()}
      />
      <meta property="twitter:image:type" content="image/png" />
      <meta property="twitter:image:alt" content="Oscar Beaumont" />
    </>
  );
}

export function StaticMeta() {
  return (
    <>
      <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
      {/* // TODO: I don't think Waku make this possible */}
      {/* {import.meta.env.PROD && <link rel="canonical" href={`${canonical}${path}`} />} */}
    </>
  );
}
