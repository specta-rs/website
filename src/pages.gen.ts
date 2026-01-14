// deno-fmt-ignore-file
// biome-ignore format: generated types do not need formatting
// prettier-ignore
import type { PathsForPages, GetConfigResponse } from 'waku/router';

// prettier-ignore
import type { getConfig as File_HomeIndex_getConfig } from './pages/(home)/index';
// prettier-ignore
import type { getConfig as File_ApiDebugSlugOgPng_getConfig } from './pages/_api/debug/[...slug]/og.png';
// prettier-ignore
import type { getConfig as File_ApiDocsSlugLlmsMdx_getConfig } from './pages/_api/docs/[...slug]/llms.mdx';
// prettier-ignore
import type { getConfig as File_ApiDocsSlugOgPng_getConfig } from './pages/_api/docs/[...slug]/og.png';
// prettier-ignore
import type { getConfig as File_ApiDocsLlmsMdx_getConfig } from './pages/_api/docs/llms.mdx';
// prettier-ignore
import type { getConfig as File_ApiDocsOgPng_getConfig } from './pages/_api/docs/og.png';
// prettier-ignore
import type { getConfig as File_Root_getConfig } from './pages/_root';
// prettier-ignore
import type { getConfig as File_DocsSlugs_getConfig } from './pages/docs/[...slugs]';

// prettier-ignore
type Page =
| ({ path: '/' } & GetConfigResponse<typeof File_HomeIndex_getConfig>)
| { path: '/404'; render: 'static' }
| ({ path: '/_api/debug/[...slug]/og.png' } & GetConfigResponse<typeof File_ApiDebugSlugOgPng_getConfig>)
| ({ path: '/_api/docs/[...slug]/llms.mdx' } & GetConfigResponse<typeof File_ApiDocsSlugLlmsMdx_getConfig>)
| ({ path: '/_api/docs/[...slug]/og.png' } & GetConfigResponse<typeof File_ApiDocsSlugOgPng_getConfig>)
| ({ path: '/_api/docs/llms.mdx' } & GetConfigResponse<typeof File_ApiDocsLlmsMdx_getConfig>)
| ({ path: '/_api/docs/og.png' } & GetConfigResponse<typeof File_ApiDocsOgPng_getConfig>)
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
