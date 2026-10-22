/**
 * Star counts are baked into the static build, so the fetch has to survive a
 * failing GitHub API: a missing or expired `GITHUB_TOKEN`, or the 60/hour
 * unauthenticated rate limit on a shared build IP. Both fallbacks mirror the
 * same number; ungh.cc reports it exactly, shields.io abbreviates it.
 */
export async function getGitHubStars(repo: string): Promise<string> {
  return (
    (await fromGitHub(repo)) ??
    (await fromUngh(repo)) ??
    (await fromShields(repo)) ??
    "-"
  );
}

async function fromGitHub(repo: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
    });

    if (!response.ok)
      throw new Error(`GitHub API responded with ${response.status}`);

    const data = (await response.json()) as { stargazers_count: number };
    return data.stargazers_count.toLocaleString();
  } catch (error) {
    console.error(`Failed to fetch stars for ${repo} from GitHub:`, error);
    return null;
  }
}

async function fromUngh(repo: string): Promise<string | null> {
  try {
    const response = await fetch(`https://ungh.cc/repos/${repo}`);
    if (!response.ok)
      throw new Error(`ungh.cc responded with ${response.status}`);

    const data = (await response.json()) as { repo?: { stars?: number } };
    const stars = data.repo?.stars;
    return typeof stars === "number" ? stars.toLocaleString() : null;
  } catch (error) {
    console.error(`Failed to fetch stars for ${repo} from ungh.cc:`, error);
    return null;
  }
}

async function fromShields(repo: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://img.shields.io/github/stars/${repo}.json`,
    );
    if (!response.ok)
      throw new Error(`shields.io responded with ${response.status}`);

    const data = (await response.json()) as { value?: string };
    return data.value ?? null;
  } catch (error) {
    console.error(`Failed to fetch stars for ${repo} from shields.io:`, error);
    return null;
  }
}
