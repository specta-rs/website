import { Router, type RouteDefinition } from "@solidjs/router";
import { lazy } from "solid-js";
import { Navbar } from "./components/Navbar";

const routes = [
	{
		path: "/",
		component: lazy(() => import("./app/index")),
	},
	{
		path: "/tauri",
		component: lazy(() => import("./app/tauri")),
	},
] satisfies RouteDefinition[];

export const getRoutes = () => routes.map((route) => route.path);

export const App = (props: { path: string }) => (
	<>
		<Navbar />
		<Router url={props.path}>{routes}</Router>
	</>
);
