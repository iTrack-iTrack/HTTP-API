import express, { Express, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

dotenv.config();

let server = async () => {
	let app: Express = express();
	app.use(cors({ origin: true, credentials: true }));

	let db = await open({filename: String(process.env.DB_PATH), driver: sqlite3.Database});
	let queryDatabase = async (res: Response, query: string, params: any[] = []) => {
		res.send(await db.all(query, params));
	};

	app.get("/:id", (req: Request, res: Response) => {
		queryDatabase(res,
			      "SELECT * FROM sensor_readings WHERE user_id = ?",
			      [req.params.id])
	});

	let port: Number = Number(process.env.PORT) || 8082;
	let http = createServer(app);
	http.listen(port, () => {
		    console.log(`[server]: listening on port http://localhost:${port}.`)
	});
};
server();
