import { Router, type RouteDefinition } from "@solidjs/router";
import { createContext, lazy } from "solid-js";
import { Navbar } from "./components/Navbar";
import type { Navigation } from "./app/docs";
import { manifest } from "./routes.gen";

export const NavigationCtx = createContext<Navigation>();

const routes = [
	{
		path: "/",
		component: lazy(() => import("./app/index")),
	},
	{
		path: "/docs",
		component: lazy(() => import("./app/docs")),
	},
	{
		path: "/docs",
		component: lazy(() => import("./app/docs")),
		children: [
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
	// TODO: 404
] satisfies RouteDefinition[];

export const getRoutes = () => ["/"]; // TODO: routes.map((route) => route.path)

export const App = (props: { path: string; navigation: Navigation }) => (
	<NavigationCtx.Provider value={props.navigation}>
		<Navbar />
		<Router url={import.meta.env.SSR ? props.path : undefined}>{routes}</Router>
	</NavigationCtx.Provider>
);
