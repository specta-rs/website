import Layout from "@kobalte/solidbase/default-theme/components/Layout";
import { ComponentProps } from "solid-js";

export default function (props: ComponentProps<typeof Layout>) {
	// do whatever and render whatever you want as long as `Layout` gets rendered

	return <Layout {...props} />;
}
