const express = require("express");
// acts as main hub for other routes that branch from /api
const apiRouter = express.Router();

// allows for creation of json web tokens for user authorisation
const jwt = require("jsonwebtoken");
// pulls secret from .env to be used for token creation
const { JWT_SECRET } = process.env;

const { getUserById } = require("../db");

// set `req.user` if possible
apiRouter.use(async (req, res, next) => {
  const prefix = "Bearer ";
  const auth = req.header("Authorization");

  if (!auth) {
    // nothing to see here
    next();
    // if Authorization header starts with 'Bearer '
  } else if (auth.startsWith(prefix)) {
    // cut off 'Bearer ' and return token string
    const token = auth.slice(prefix.length);

    try {
      // pull id from the initial token information
      const { id } = jwt.verify(token, JWT_SECRET);

      // if there is an id, set req.user to user object using user.id
      if (id) {
        req.user = await getUserById(id);
        next();
      }
    } catch ({ name, message }) {
      next({ name, message });
    }
  } else {
    next({
      name: "AuthorizationHeaderError",
      message: `Authorization token must start with ${prefix}`,
    });
  }
});

apiRouter.use((req, res, next) => {
  // log if there is a req.user
  if (req.user) {
    console.log("User is set:", req.user);
  }

  next();
});

// pulls routes from export.modules and adds them to apiRouter
const usersRouter = require("./users");
apiRouter.use("/users", usersRouter);

const postsRouter = require("./posts");
apiRouter.use("/posts", postsRouter);

const tagsRouter = require("./tags");
apiRouter.use("/tags", tagsRouter);

// error handling
apiRouter.use((error, req, res, next) => {
  res.send({
    name: error.name,
    message: error.message,
  });
});

module.exports = apiRouter;
