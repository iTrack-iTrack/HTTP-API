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
	app.use("/picture", express.static(String(process.env.PFP_PATH)));

	let db = await open({filename: String(process.env.DB_PATH), driver: sqlite3.Database});

	let queryDatabase = async (query: string, params: any[] = []) => await db.all(query, params);

	app.get("/", async (req: Request, res: Response) => {
		let result = await queryDatabase(
			"SELECT u.*"
			"FROM users u"
		);
		res.send(result);
	});

	app.get("/:user_id", async (req: Request, res: Response) => {
		let result = await queryDatabase(
			"SELECT s.*"
			"FROM users u, sensor_data s"
			"WHERE u.user_id = ?"
			"AND u.user_id = s.user_id",
			[req.params.user_id]
		);
		res.send(result);
	});

	app.get("/:user_id/info", (req: Request, res: Response) => {
		let result = await queryDatabase(
			"SELECT u.*"
			"FROM users u"
			"WHERE u.user_id = ?",
			[req.params.user_id]
		);
		res.send(result);
	});

	let port: Number = Number(process.env.PORT) || 8082;
	let http = createServer(app);
	http.listen(port, () => {
		    console.log(`[server]: listening on port http://localhost:${port}.`)
	});
};
server();
