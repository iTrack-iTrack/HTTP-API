import bcrypt from "bcrypt";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import express, { Express, Request, Response } from "express";
import { createServer } from "http";
import jwt, { JwtPayload } from "jsonwebtoken";
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
	let queryDatabaseSingle = async (query: string, params: any[] = []) => await db.get(query, params);
	let queryDatabaseMany = async (query: string, params: any[] = []) => await db.all(query, params);

	let jwt_secret = String(process.env.JWT_SECRET);

	app.get("/", async (req: Request, res: Response) => {
		let result = await queryDatabaseMany(
			"SELECT u.user_id, u.first_name, u.last_name " +
			"FROM users u"
		);
		res.send(result);
	});

	let salt = "$2b$10$itrackandiwatchanditra";
	let hashPassword = async (password: string): Promise<string> => await bcrypt.hash(password, salt);

	app.post("/login", async (req: Request, res: Response) => {
		if (!req.body.user_id || !req.body.password) {
			res.send("Failed: Invalid Inputs.");
			return;
		}

		if (req.body.user_id === "admin" && req.body.password === jwt_secret) {
			let data: {time: Date, user_id: string} = {
				time: new Date(),
				user_id: "admin"
			};
			const token = jwt.sign(data, jwt_secret);
			res.send(token);
			return;
		}

		let db_user = await db.get(
			"SELECT u.password "+
			"FROM users u "+
			"WHERE u.user_id = ?;",
			[req.body.user_id]
		);
		bcrypt.compare(req.body.password, db_user["password"], (err, same_password) => {
			if (err) {
				res.send(`Failed: ${err}`);
				return;
			}

			if (!same_password) {
				res.send("The user's ID or Password are not the same.");
				return;
			}

			let data: {time: Date, user_id: string} = {
				time: new Date(),
				user_id: req.body.user_id
			};
			const token = jwt.sign(data, jwt_secret);
			res.send(token);
		});
	});

	app.post("/register", async (req: Request, res: Response) => {
		if (!req.body.password || !req.body.first_name || !req.body.last_name
		|| !req.body.date_of_birth || !req.body.country || !req.body.region
		|| !req.body.street || !req.body.house_number || !req.body.contact
		|| !req.body.sickness || !req.body.sickness) {
			res.send("Failed: Invalid Inputs.");
			return;
		}
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
					req.body.sickness, /*req.body.picture*/ "pfp.jpg"]
			);
			res.send("Success!");
		} catch (error: unknown) {
			if (error instanceof Error)
				res.send(`Failed: ${error.message}.`);
			else
				res.send(`Failed: ${error}.`);
		}
	});

	let authentication = (req: Request, res: Response, next: Function) => {
		if (!req.params.user_id) {
			res.send("Failed: User ID doesn't exist.");
			return;
		}

		let auth = req.headers.authorization;
		if (!auth?.startsWith("Bearer")) {
			res.send("Failed: Not Bearer Token.");
			return;
		}

		let token = auth.split(" ")[1];
		if (!token) {
			res.send("Failed: Parsing Authentication Token.");
			return;
		}

		let payload = jwt.verify(token, jwt_secret) as JwtPayload & { [key: string]: unknown };
		if (!payload || typeof payload.user_id !== "string") {
			res.send("Failed: Unable to Authenticate Token.");
			return;
		}

		let one_hour = 60 * 60 * 1000;
		if ((new Date().getTime() - Date.parse(payload.time)) > one_hour) {
			res.send("Failed: Time has expired.");
			return;
		}

		if (payload.user_id !== "admin" && payload.user_id !== String(req.params.user_id)) {
			res.send("Failed: User does not have access right.");
			return;
		}

		next();
	};

	app.get("/:user_id", authentication, async (req: Request, res: Response) => {
		let result = await queryDatabaseMany(
			"SELECT s.* "+
			"FROM users u, sensor_data s "+
			"WHERE u.user_id = ? "+
			"AND u.user_id = s.user_id",
			[req.params.user_id]
		);
		res.send(result);
	});

	app.get("/:user_id/info", authentication, async (req: Request, res: Response) => {
		let result = await queryDatabaseSingle(
			"SELECT u.* "+
			"FROM users u "+
			"WHERE u.user_id = ?",
			[req.params.user_id]
		);
		res.send(result);
	});

	interface Client {
		user_id: string,
		res: Response
	};
	let channels: Record<string, Client[]> = {};

	app.get("/:user_id/live", authentication, (req: Request, res: Response) => {
		let user_id = req.params.user_id;

		res.writeHead(200, {
			"Content-Type" : "text/event-stream",
			"Cache-Control": "no-cache",
			"Connection"   : "keep-alive"
		});
		res.flushHeaders();
		
		let client: Client = { user_id: String(Date.now()), res };
		channels[user_id] = channels[user_id] || [];
		channels[user_id].push(client);

		req.on("close", () => {
			channels[user_id] = channels[user_id].filter(c => c.user_id !== client.user_id);

			if (channels[user_id].length === 0)
				delete channels[user_id];
		});
	});

	app.post("/:user_id/live", (req: Request, res: Response) => {
		let user_id = req.params.user_id;
		let payload = JSON.stringify(req.body);
		let clients = channels[user_id] || [];

		clients.forEach(c => {
			c.res.write(`data: ${payload}\n\n`);
		});

		res.send();
	});

	let port: Number = Number(process.env.PORT) || 8082;
	let http = createServer(app);
	http.listen(port, () => {
		    console.log(`[server]: listening on port http://localhost:${port}.`)
	});
};
server();
