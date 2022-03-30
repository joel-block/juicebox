// pulls secret from .env file
require("dotenv").config();

// initializes server
const PORT = 3000;
const express = require("express");
const server = express();

// brings in middleware logger
const morgan = require("morgan");

// logs any requests to the server and converts req.bodies to json
server.use(morgan("dev"));
server.use(express.json());

// establishes /api routes
const apiRouter = require("./api");
server.use("/api", apiRouter);

// logs req.body of any requests to server
server.use((req, res, next) => {
  console.log("<____Body Logger START____>");
  console.log(req.body);
  console.log("<_____Body Logger END_____>");

  next();
});

// connects to database
const { client } = require("./db");
client.connect();

// sets up localhost for server to listen to
server.listen(PORT, () => {
  console.log("The server is up on port", PORT);
});
