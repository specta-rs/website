/**
 * The hero's second stat is ecosystem adoption. crates.io reports all-time
 * downloads per crate, so sum the crates this site documents. Downloads are
 * not unique users (a crate pulled in as a dependency counts again), which is
 * why the label says "crates.io downloads" rather than "users".
 *
 * The build must survive an unavailable registry, so a failed lookup falls
 * back to the last committed total instead of dropping the stat.
 */

const crates = [
  "specta",
  "specta-typescript",
  "specta-serde",
  "tauri-specta",
  "rspc",
  "gurafi",
  "gurafi-relay",
  "gql",
  "suku",
  "fsk",
];

const fallback = 10_757_635;

export async function getCrateDownloads(): Promise<number> {
  try {
    const downloads = await Promise.all(
      crates.map(async (name) => {
        const response = await fetch(
          `https://crates.io/api/v1/crates/${name}`,
          {
            headers: {
              "User-Agent": "specta-website (https://specta.dev)",
            },
          },
        );

        if (!response.ok)
          throw new Error(`crates.io responded with ${response.status}`);

        const data = (await response.json()) as {
          crate?: { downloads?: number };
        };
        const total = data.crate?.downloads;
        if (typeof total !== "number")
          throw new Error(`No download count for ${name}`);
        return total;
      }),
    );

    return downloads.reduce((sum, total) => sum + total, 0);
  } catch (error) {
    console.error("Failed to fetch crate downloads from crates.io:", error);
    return fallback;
  }
}
