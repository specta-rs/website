import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getGitHubStars } from "../src/lib/getGitHubStars.ts";
import { getSponsors } from "../src/lib/sponsors.ts";

// The landing page shows sponsors and star counts. Rspress renders it during
// `rspress build`, so fetch the data once here and check the result into a
// generated JSON module instead of making the page a client-side async
// component. Both helpers fall back to committed data when GitHub is
// unavailable, so a build without a token still succeeds.
const repos = ["specta-rs/specta", "specta-rs/rspc", "specta-rs/tauri-specta"];

const [sponsors, stars] = await Promise.all([
  getSponsors(),
  Promise.all(repos.map(async (repo) => [repo, await getGitHubStars(repo)])),
]);

const output = path.resolve("theme/site-data.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify(
    {
      sponsors,
      stars: Object.fromEntries(stars),
    },
    null,
    2,
  )}\n`,
);
console.log(`Wrote ${path.relative(process.cwd(), output)}`);
