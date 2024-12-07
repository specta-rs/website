import { useContext, type ParentProps } from "solid-js";
import { Navigate, useLocation } from "@solidjs/router";
import clsx from "clsx";
import { NavigationCtx } from "../util/navctx";

function Navigation() {
	const location = useLocation();
	const navigation = useContext(NavigationCtx);
	if (!navigation) throw new Error("Navigation context found");

	return (
		<nav class="text-base lg:text-sm">
			<ul class="space-y-9 h-[2vh]">
				{navigation.map((section) => (
					<li>
						<h2 class="font-display font-medium text-slate-900 dark:text-white">
							{section.title}
						</h2>
						<ul class="mt-2 space-y-2 border-l-2 border-slate-100 lg:mt-4 lg:space-y-4 lg:border-slate-200 dark:border-slate-800">
							{section.links.map((link) => (
								<li class="relative">
									<a
										href={`/docs/${link.href}`}
										class={clsx(
											"block w-full pl-3.5 before:pointer-events-none before:absolute before:-left-1 before:top-1/2 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full",
											`/docs/${link.href}` === location.pathname
												? "font-semibold text-sky-500 before:bg-sky-500"
												: "text-slate-500 before:hidden before:bg-slate-300 hover:text-slate-600 hover:before:block dark:text-slate-400 dark:before:bg-slate-700 dark:hover:text-slate-300",
										)}
									>
										{link.title}
									</a>
								</li>
							))}
						</ul>
					</li>
				))}
			</ul>
		</nav>
	);
}

export default function Page(props: ParentProps) {
	return (
		<div class="flex w-full">
			<div class="bg-[#1e293b]/85 overflow-y-auto overflow-x-hidden h-[calc(100vh-70px)] w-64">
				<div class="p-4">
					<Navigation />
				</div>
			</div>

			<div class="flex-grow p-4 overflow-x-hidden h-[calc(100vh-70px)] flex justify-center">
				<div class="prose prose-invert lg:prose-md prose-white lg:min-w-[65ch]">
					{props.children}
				</div>
			</div>
		</div>
	);
}

export function Redirect() {
	return (
		<>
			<Navigate href="/docs/project/mission" />
			<noscript>
				<meta http-equiv="refresh" content="0.0;url=/docs/project/mission" />
			</noscript>
		</>
	);
}
