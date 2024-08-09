import { Feed } from "@numbered/feed";
import "dotenv/config";
import express from "express";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import moment from "moment";
import { AddressInfo } from "net";
import fetch from "node-fetch";
import * as path from "path";

const app = express();
app.use(express.static(path.join(__dirname, "../public")));
const parser = new XMLParser({ ignoreAttributes: false, allowBooleanAttributes: false });
const builder = new XMLBuilder({ format: true, ignoreAttributes: false, suppressBooleanAttributes: false });

app.get("/northwestart", async (_req, res) => {
	try {
		const resp = await fetch("https://wetdry.world/@NorthWestWind.rss");
		if (!resp.ok) throw new Error("Received HTTP Status: " + resp.status);
		const rssObj = parser.parse(await resp.text());
		rssObj.rss.channel.item = rssObj.rss.channel.item.filter((item: any) => {
			if (typeof item.category === "string") return item.category.toLowerCase().includes("art");
			if (Array.isArray(item.category)) return item.category.some((cat: string) => cat.toLowerCase().includes("art"));
			return false;
		});
		const rss = builder.build(rssObj);
		res.setHeader("Content-type", "application/force-download");
		res.setHeader("Content-disposition", "attachment; filename=@NorthWestWind.rss");
		res.send(Buffer.from(rss));
	} catch (err) {
		console.error(err);
		res.sendStatus(500);
	}
});

let twitchApi: { access_token: string, expires_in: number, token_type: string } | undefined;

app.get("/twitchclips", async (req, res) => {
	if (!twitchApi) {
		try {
			const resp = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, { method: "POST" });
			if (!resp.ok) throw new Error("Received HTTP Status: " + resp.status);
			twitchApi = await resp.json();
			if (!twitchApi?.access_token || !twitchApi.expires_in || !twitchApi.token_type) throw new Error("Twitch API object malformed");
			setTimeout(() => twitchApi = undefined, twitchApi.expires_in!);
		} catch (err) {
			console.error(err);
			return res.sendStatus(500);
		}
	}
	let data: { id: string, url: string, title: string, thumbnail_url: string, broadcaster_name: string, creator_name: string, created_at: string }[] | undefined;
	const apiUrl = new URL("https://api.twitch.tv/helix/clips");
	apiUrl.searchParams.append("broadcaster_id", "217678294");
	apiUrl.searchParams.append("started_at", moment().subtract(6, "month").toISOString());
	apiUrl.searchParams.append("ended_at", moment().toISOString());
	apiUrl.searchParams.append("first", "100");
	apiUrl.searchParams.append("is_featured", "true");
	try {
		const resp = await fetch(apiUrl, { headers: { Authorization: `Bearer ${twitchApi.access_token}`, "Client-Id": process.env.TWITCH_CLIENT_ID! } });
		if (!resp.ok) throw new Error("Received HTTP Status: " + resp.status);
		data = (await resp.json()).data.sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
	} catch (err) {
		console.error(err);
		return res.sendStatus(500);
	}

	const twitchUrl = "https://www.twitch.tv/northwestwindnww/videos?featured=true&filter=clips&range=all";
	const baseUrl = req.protocol + "://" + req.get("host");
	const feed = new Feed({
		title: "NorthWestWindNWW Twitch Clips",
		description: "Twitch clips of NorthWestWind.",
		id: twitchUrl,
		link: twitchUrl,
		image: `${baseUrl}/twitch.png`,
		favicon: `${baseUrl}/twitch.png`,
		copyright: "Twitch clips. Idk Twitch licenses.",
		updated: new Date(data![0].created_at),
		author: {
			name: "NorthWestWind",
			link: "https://www.northwestw.in"
		}
	});
	for (const datum of data!) {
		feed.addItem({
			title: datum.title,
			id: datum.id,
			link: datum.url,
			date: new Date(datum.created_at),
			image: datum.thumbnail_url,
			author: [
				{
					name: datum.creator_name
				},
				{
					name: datum.broadcaster_name,
					link: "https://twitch.tv/" + datum.broadcaster_name
				}
			]
		});
	}
	res.setHeader("Content-Disposition", "attachment; filename=\"northwestclips.rss\"");
	res.send(feed.rss2());
});

const server = app.listen(process.env.PORT || 3000, () => {
	console.log(`App listening on port ${(<AddressInfo>server.address()).port}`);
});