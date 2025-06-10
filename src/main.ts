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
	let queryDatabase = async (query: string, params: any[] = []) => await db.all(query, params);

	let jwt_secret = String(process.env.JWT_SECRET);

	app.get("/", async (req: Request, res: Response) => {
		let result = await queryDatabase(
			"SELECT u.user_id, u.first_name, u.last_name " +
			"FROM users u"
		);
		res.send(result);
	});

	let salt = "$2b$10$itrackandiwatchanditra";
	let hashPassword = async (password: string): Promise<string> => await bcrypt.hash(password, salt);

	app.post("/login", async (req: Request, res: Response) => {
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

	let authentication = (req: Request, res: Response, next: Function) => {
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

		if (payload.user_id !== "admin" && payload.user_id !== req.params.user_id) {
			res.send("Failed: User does not have access right.");
			return;
		}

		next();
	};

	app.get("/:user_id", authentication, async (req: Request, res: Response) => {
		let result = await queryDatabase(
			"SELECT s.* "+
			"FROM users u, sensor_data s "+
			"WHERE u.user_id = ? "+
			"AND u.user_id = s.user_id",
			[req.params.user_id]
		);
		res.send(result);
	});

	app.get("/:user_id/info", authentication, async (req: Request, res: Response) => {
		let result = await queryDatabase(
			"SELECT u.* "+
			"FROM users u "+
			"WHERE u.user_id = ?",
			[req.params.user_id]
		);
		res.send(result);
	});

	app.get("/:user_id/live", authentication, (req: Request, res: Response) => {
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
				date_time: String(new Date()),
				step: String(Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000),
				temperature: String(Math.floor(Math.random() * (40 - 35 + 1)) + 35),
				longitude: String(Math.floor(Math.random() * (56 - 53 + 1)) + 53),
				latitude: String(Math.floor(Math.random() * (56 - 53 + 1)) + 53),
				bpm: String(Math.floor(Math.random() * (100 - 50 + 1)) + 50),
				blood_oxygen: String(Math.floor(Math.random() * (100 - 50 + 1)) + 50)
			};

			res.write(`data: ${JSON.stringify(random)}\n\n`);
		}, 1000);

		res.on("close", () => {
			clearInterval(interval);
			res.end();
		});
	});

	let port: Number = Number(process.env.PORT) || 8082;
	let http = createServer(app);
	http.listen(port, () => {
		    console.log(`[server]: listening on port http://localhost:${port}.`)
	});
};
server();
