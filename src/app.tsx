import { Router, type RouteDefinition } from "@solidjs/router";
import { lazy } from "solid-js";
import { Navbar } from "./components/Navbar";
import { manifest } from "./routes.gen";
import { NavigationCtx, type Navigation } from "./util/navctx";

const routes = [
	{
		path: "/",
		component: lazy(() => import("./app/index")),
	},
	{
		path: "/docs",
		component: lazy(() => import("./app/docs")),
		children: [
			{
				path: "/",
				component: lazy(() =>
					import("./app/docs").then((m) => ({ default: m.Redirect })),
				),
			},
			...Object.entries(manifest).map(([path, component]) => ({
				path,
				// biome-ignore lint/suspicious/noExplicitAny:
				component: lazy(component as any),
			})),
			{
				path: "/*",
				// TODO: 404
				component: () => <h1>404: Not Found</h1>,
			},
		],
	},
	{
		path: "/*",
		// TODO: 404
		component: () => <h1>404: Not Found</h1>,
	},
] satisfies RouteDefinition[];

export const getRoutes = () => {
	// We flatten the routes to get all possible paths for Astro to prerender.
	//
	// The result maps any wildcards to a `404.html` page which Cloudflare Pages will find the closest match for and serve.
	function processRoute(
		parentRoute:
			| RouteDefinition<string | string[]>
			| RouteDefinition<string | string[]>[],
	) {
		let route = parentRoute;
		if ("children" in route && route.children) {
			route = route.children;
		}

		if (Array.isArray(route)) {
			let result: string[] = [];
			for (const child of route) {
				let prefix = Array.isArray(parentRoute) ? [] : parentRoute.path ?? "";
				if (Array.isArray(prefix)) prefix = prefix[0] ?? "";

				result = [
					...result,
					...processRoute(child).map((path) => `${prefix}${path}`),
				];
			}
			return result;
		}

		if (!route.path) return [];
		if (route.path === "/*") return ["/404"];
		return Array.isArray(route.path) ? route.path : [route.path];
	}

	return processRoute(routes);
};

export const App = (props: { path: string; navigation: Navigation }) => (
	<NavigationCtx.Provider value={props.navigation}>
		<Navbar />
		<Router url={props.path}>{routes}</Router>
	</NavigationCtx.Provider>
);
