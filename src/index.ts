import "dotenv/config";
import express from "express";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import { AddressInfo } from "net";
import fetch from "node-fetch";

const app = express();
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

const server = app.listen(process.env.PORT || 3000, () => {
	console.log(`App listening on port ${(<AddressInfo>server.address()).port}`);
});