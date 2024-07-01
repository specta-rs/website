import { createContext } from "solid-js";

export type Navigation = {
	title: string;
	links: {
		title: string;
		href: string;
	}[];
}[];

export const NavigationCtx = createContext<Navigation>();
