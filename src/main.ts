import bcrypt from "bcrypt";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import express, { Express, Request, Response } from "express";
import { createServer } from "http";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

dotenv.config({ path: "./.env" });

let server = async () => {
	let app: Express = express();

	app.use(cors({ origin: true, credentials: true }));
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({ extended: true }));
	app.use("/picture", express.static(String(process.env.PFP_PATH)));

	let db = await open({filename: String(process.env.DB_PATH), driver: sqlite3.Database});

	let queryDatabase = async (query: string, params: any[] = []) => await db.all(query, params);

	app.get("/", async (req: Request, res: Response) => {
		let result = await queryDatabase(
			"SELECT u.user_id, u.first_name, u.last_name " +
			"FROM users u"
		);
		res.send(result);
	});

	app.get("/:user_id", async (req: Request, res: Response) => {
		let result = await queryDatabase(
			"SELECT s.* "+
			"FROM users u, sensor_data s "+
			"WHERE u.user_id = ? "+
			"AND u.user_id = s.user_id",
			[req.params.user_id]
		);
		res.send(result);
	});

	app.get("/:user_id/info", async (req: Request, res: Response) => {
		let result = await queryDatabase(
			"SELECT u.* "+
			"FROM users u "+
			"WHERE u.user_id = ?",
			[req.params.user_id]
		);
		res.send(result);
	});

	app.get("/:user_id/live", (req: Request, res: Response) => {
		res.writeHead(200, {
			"Content-Type" : "text/event-stream",
			"Cache-Control": "no-cache",
			"Connection"   : "keep-alive"
		});

		let interval = setInterval(async () => {
			let random: {
				date_time: string,
				step: string,
				temperature: string,
				longitude: string,
				latitude: string,
				bpm: string,
				blood_oxygen: string
			} = {
				date_time: String(Math.floor(Math.random() * (10 + 1))),
				temperature: String(Math.floor(Math.random() * (10 + 1))),
				longitude: String(Math.floor(Math.random() * (10 + 1))),
				latitude: String(Math.floor(Math.random() * (10 + 1))),
				bpm: String(Math.floor(Math.random() * (10 + 1))),
				blood_oxygen: String(Math.floor(Math.random() * (10 + 1)))
				step: String(Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000),
			};

			res.write(`data: ${JSON.stringify(random)}\n\n`);
		}, 1000);

		res.on("close", () => {
			clearInterval(interval);
			res.end();
		});
	});

	let salt = "$2b$10$itrackandiwatchanditra";
	let hashPassword = async (password: string): Promise<string> => await bcrypt.hash(password, salt);

	app.post("/register", async (req: Request, res: Response) => {
		try {
			let password = await hashPassword(req.body.password);
			await db.run(
				"INSERT INTO users (password, first_name, last_name, "+
					"date_of_birth, country, region, "+
					"street, house_number, contact, "+
					"sickness, picture) "+
				"VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
				[password, req.body.first_name, req.body.last_name,
					req.body.date_of_birth, req.body.country, req.body.region,
					req.body.street, req.body.house_number, req.body.contact,
					req.body.sickness, req.body.picture]
			);
			res.send("Success!");
		} catch (error: unknown) {
			if (error instanceof Error)
				res.send(`Failed: ${error.message}.`);
			else
				res.send(`Failed: ${error}.`);
		}
	});

	let port: Number = Number(process.env.PORT) || 8082;
	let http = createServer(app);
	http.listen(port, () => {
		    console.log(`[server]: listening on port http://localhost:${port}.`)
	});
};
server();
