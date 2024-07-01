import { Router, type RouteDefinition } from "@solidjs/router";
import { lazy } from "solid-js";
import { Navbar } from "./components/Navbar";
import { NavigationCtx, type Navigation } from "./app/docs";

const routes = [
	{
		path: "/",
		component: lazy(() => import("./app/index")),
	},
	{
		path: "/docs/*",
		component: lazy(() => import("./app/docs")),
	},
] satisfies RouteDefinition[];

export const getRoutes = () => ["/"]; // TODO: routes.map((route) => route.path)

export const App = (props: { path: string; navigation: Navigation }) => (
	<NavigationCtx.Provider value={props.navigation}>
		<Navbar />
		<Router url={props.path}>{routes}</Router>
	</NavigationCtx.Provider>
);
