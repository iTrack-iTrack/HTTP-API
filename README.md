# HTTP-API

The HTTP-API repository is a project that makes queries to the database, serve data to the front end, or communicate with other possible connects. It is the middle-man of all other services to have them all communicate with one another.

## Setup

The following are required for this project.

- [NodeJS](https://nodejs.org/en)
- [Systemd](https://systemd.io/)

## Usage

In the start of the NodeJS project, the user must execute `npm i` to install all the necessary packages that are required.

Since the project is written in TypeScript, the source file can not be executed immediately, thus it needs to be compiled into JavaScript, which is done so by doing `npm run build`.

Before the code should run, one final item to be populated needs to be done, which is taking the `.env.template` file and running the command `mv .env.template .env` as the `.env` is targetted by the main code to find necessary paths in the system. One that needs to be filled is the `DB_PATH` as it is used to make queries to the SQL database. The `PFP_PATH` is used to download and display user's profile pictures. Lastly, the `JWT_SECRET` is used to create and verify the JWT Token for Authorization.

Finally, the user can write `npm start` to run the entire project, and it will listen and tell the user what to port it is listening to.

In the case that the user wishes to have the HTTP-API always run in the background of the Operating System, a systemd service file exists from the user to use. To use it, use the command `sudo mv API.service /etc/systemd/system/`, then run `sudo systemctl daemon-reload` to update the list of available services, execute `sudo systemctl enable API.service` to have the service run on boot, and finally `sudo systemctl start API.service` to execute the service and make it run in the background.
