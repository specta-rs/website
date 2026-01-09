export async function getGitHubStars(repo: string): Promise<string> {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok)
      throw new Error(`GitHub API responded with ${response.status}`);

    const data = (await response.json()) as { stargazers_count: number };
    return data.stargazers_count.toLocaleString();
  } catch (error) {
    console.error(`Failed to fetch stars for ${repo}:`, error);
    return "-"; // Return for failure
  }
}
