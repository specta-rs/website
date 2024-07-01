import satori from "satori";
import sharp from "sharp";
// @ts-expect-error: Virtual module provided by Vite plugin
import ralewayFont from "@fontsource/raleway/files/raleway-latin-500-normal.woff?arraybuffer";

export async function GET() {
	const svg = await satori(
		{
			type: "div",
			props: {
				style: {
					height: "100%",
					width: "100%",
					display: "flex",
					textAlign: "center",
					alignItems: "center",
					justifyContent: "center",
					flexDirection: "column",
					flexWrap: "nowrap",
					backgroundColor: "#0e111a",
				},
				children: [
					{
						type: "div",
						props: {
							style: {
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							},
							children: [
								{
									type: "img",
									props: {
										// TODO: It would be nice if these could from straight from the FS but Satori is annoying.
										src: "https://raw.githubusercontent.com/specta-rs/website/main/src/images/logo.png",
										width: "300px",
										height: "200px",
									},
								},
							],
						},
					},
					{
						type: "div",
						props: {
							style: {
								display: "flex",
								fontFamily: "Raleway",
								fontSize: 65,
								fontStyle: "normal",
								color: "white",
							},
							children: [
								{
									type: "b",
									props: {
										children: "specta-rs",
									},
								},
							],
						},
					},
					{
						type: "div",
						props: {
							style: {
								display: "flex",
								flexDirection: "column",
								fontFamily: "Raleway",
								fontSize: 28,
								fontStyle: "normal",
								marginTop: -20,
								color: "white",
							},
							children: [
								{
									type: "p",
									props: {
										children: "Rust crates for building better web apps",
									},
								},
							],
						},
					},
				],
			},
		},
		{
			width: 800,
			height: 400,
			fonts: [
				{
					name: "Roboto",
					data: ralewayFont,
					weight: 500,
					style: "normal",
				},
			],
		},
	);

	const png = await sharp(Buffer.from(svg)).png().toBuffer();

	return new Response(png, {
		headers: {
			"Content-Type": "image/png",
		},
	});
}
