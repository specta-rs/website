// deno-fmt-ignore-file
// biome-ignore format: generated types do not need formatting
// prettier-ignore
import type { PathsForPages, GetConfigResponse } from 'waku/router';

// prettier-ignore
import type { getConfig as File_HomeIndex_getConfig } from './pages/(home)/index';
// prettier-ignore
import type { getConfig as File_ApiOgDocsSlug_getConfig } from './pages/_api/og/docs/[...slug]';
// prettier-ignore
import type { getConfig as File_Root_getConfig } from './pages/_root';
// prettier-ignore
import type { getConfig as File_DocsSlugs_getConfig } from './pages/docs/[...slugs]';

// prettier-ignore
type Page =
| ({ path: '/' } & GetConfigResponse<typeof File_HomeIndex_getConfig>)
| { path: '/404'; render: 'static' }
| ({ path: '/_api/og/docs/[...slug]' } & GetConfigResponse<typeof File_ApiOgDocsSlug_getConfig>)
| ({ path: '/_root' } & GetConfigResponse<typeof File_Root_getConfig>)
| ({ path: '/docs/[...slugs]' } & GetConfigResponse<typeof File_DocsSlugs_getConfig>);

// prettier-ignore
declare module 'waku/router' {
  interface RouteConfig {
    paths: PathsForPages<Page>;
  }
  interface CreatePagesConfig {
    pages: Page;
  }
}
