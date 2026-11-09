export interface Sponsor {
  name: string;
  url: string;
  logo: string;
  /**
   * Direct sponsors are called out above the GitHub Sponsors list. Everyone
   * else comes from GitHub and is rendered a size down.
   */
  tier: "direct" | "github";
}

// Organizations that sponsor specta-rs directly. They aren't listed through
// GitHub Sponsors, so they are declared here.
const directSponsors: Sponsor[] = [
  {
    name: "Flight Science",
    url: "https://www.flightscience.ai",
    logo: "https://avatars.githubusercontent.com/u/138841219?v=4",
    tier: "direct",
  },
  {
    name: "CrabNebula",
    url: "https://crabnebula.dev",
    logo: "https://avatars.githubusercontent.com/u/112912296?v=4",
    tier: "direct",
  },
];

// People we thank alongside the GitHub Sponsors who don't show up in that
// list, or support the project another way.
const supporters: Sponsor[] = [
  {
    name: "John Carmack",
    url: "https://github.com/johncarmack1984",
    logo: "https://avatars.githubusercontent.com/u/20649979?s=200&v=4",
    tier: "github",
  },
];

// Shown when the GitHub API is unavailable at build time (no token, rate
// limit, or an API change). Keep this in sync with every sponsor, past and
// present, on https://github.com/sponsors/oscartbeaumont.
const githubSponsorsFallback: Sponsor[] = [
  {
    name: "KATT",
    url: "https://github.com/KATT",
    logo: "https://avatars.githubusercontent.com/u/459267?s=200&v=4",
    tier: "github",
  },
  {
    name: "Cap",
    url: "https://github.com/CapSoftware",
    logo: "https://avatars.githubusercontent.com/u/151241629?s=200&v=4",
    tier: "github",
  },
  {
    name: "Jair Trejo",
    url: "https://github.com/jairtrejo",
    logo: "https://avatars.githubusercontent.com/u/210225?s=200&v=4",
    tier: "github",
  },
  {
    name: "Marcus Buffett",
    url: "https://github.com/marcusbuffett",
    logo: "https://avatars.githubusercontent.com/u/1834328?s=200&v=4",
    tier: "github",
  },
  {
    name: "Nohac",
    url: "https://github.com/Nohac",
    logo: "https://avatars.githubusercontent.com/u/3076780?s=200&v=4",
    tier: "github",
  },
  {
    name: "scottwey",
    url: "https://github.com/scottwey",
    logo: "https://avatars.githubusercontent.com/u/15810260?s=200&v=4",
    tier: "github",
  },
  {
    name: "Lev Khoroshansky",
    url: "https://github.com/TmLev",
    logo: "https://avatars.githubusercontent.com/u/22966523?s=200&v=4",
    tier: "github",
  },
  {
    name: "Michaël",
    url: "https://github.com/michael-dm",
    logo: "https://avatars.githubusercontent.com/u/26444186?s=200&v=4",
    tier: "github",
  },
  {
    name: "Jason Wang",
    url: "https://github.com/jawang94",
    logo: "https://avatars.githubusercontent.com/u/41667764?s=200&v=4",
    tier: "github",
  },
  {
    name: "Merlin",
    url: "https://github.com/merlinaudio",
    logo: "https://avatars.githubusercontent.com/u/85179170?s=200&v=4",
    tier: "github",
  },
  {
    name: "lightfinders",
    url: "https://github.com/lightfinders",
    logo: "https://avatars.githubusercontent.com/u/99044535?s=200&v=4",
    tier: "github",
  },
];

// activeOnly: false includes past sponsors, not just current ones.
const SPONSORS_QUERY = `query ($login: String!) {
  user(login: $login) {
    sponsorshipsAsMaintainer(
      first: 100
      activeOnly: false
      includePrivate: false
    ) {
      nodes {
        sponsorEntity {
          ... on User { login name avatarUrl url }
          ... on Organization { login name avatarUrl url }
        }
      }
    }
  }
}`;

interface SponsorEntity {
  login: string;
  name: string | null;
  avatarUrl: string;
  url: string;
}

async function fetchGitHubSponsors(): Promise<Sponsor[] | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: SPONSORS_QUERY,
        variables: { login: "oscartbeaumont" },
      }),
    });

    if (!response.ok)
      throw new Error(`GitHub API responded with ${response.status}`);

    const json = (await response.json()) as {
      data?: {
        user?: {
          sponsorshipsAsMaintainer?: {
            nodes?: { sponsorEntity: SponsorEntity | null }[];
          };
        };
      };
    };

    const nodes = json.data?.user?.sponsorshipsAsMaintainer?.nodes ?? [];

    return nodes.flatMap(({ sponsorEntity }) =>
      sponsorEntity
        ? [
            {
              name: sponsorEntity.name ?? sponsorEntity.login,
              url: sponsorEntity.url,
              logo: sponsorEntity.avatarUrl,
              tier: "github" as const,
            },
          ]
        : [],
    );
  } catch (error) {
    console.error("Failed to fetch GitHub sponsors:", error);
    return null;
  }
}

export async function getSponsors(): Promise<Sponsor[]> {
  const github = (await fetchGitHubSponsors()) ?? githubSponsorsFallback;
  const seen = new Set(directSponsors.map((sponsor) => sponsor.name));

  const shown = [...supporters, ...github].filter((sponsor) => {
    if (seen.has(sponsor.name)) return false;
    seen.add(sponsor.name);
    return true;
  });

  return [...directSponsors, ...shown];
}
