const express = require("express");
const usersRouter = express.Router();
const { requireUser, requireActiveUser } = require("./utils");

const {
  getAllUsers,
  getUserByUsername,
  createUser,
  getUserById,
  updateUser,
} = require("../db");

// need jwt for jwt creation and verification
const jwt = require("jsonwebtoken");

// middleware to log requests to /users
usersRouter.use((req, res, next) => {
  console.log("A request is being made to /users");

  next();
});

// returns all users, regardless of active status
usersRouter.get("/", async (req, res) => {
  const users = await getAllUsers();

  res.send({
    users,
  });
});

// POST route for established database users
usersRouter.post("/login", async (req, res, next) => {
  // pulls username and password from req.body
  const { username, password } = req.body;

  // request must have both
  if (!username || !password) {
    next({
      name: "MissingCredentialsError",
      message: "Please supply both a username and password",
    });
  }

  try {
    // check to make sure user already exists
    const user = await getUserByUsername(username);

    // if user exists and the password is correct
    if (user && user.password == password) {
      // create token using id, username, active status, and secret
      const token = jwt.sign(
        { id: user.id, username: user.username, active: user.active },
        process.env.JWT_SECRET
      );
      // create token & return to user
      res.send({ message: "you're logged in!", token });
    } else {
      next({
        name: "IncorrectCredentialsError",
        message: "Username or password is incorrect",
      });
    }
  } catch (error) {
    console.log(error);
    next(error);
  }
});

// POST route to create user
usersRouter.post("/register", async (req, res, next) => {
  const { username, password, name, location } = req.body;

  try {
    // check to see if username is taken
    const _user = await getUserByUsername(username);

    if (_user) {
      next({
        name: "UserExistsError",
        message: "A user by that username already exists",
      });
    }

    // create user in database
    const user = await createUser({
      username,
      password,
      name,
      location,
    });

    // create token
    const token = jwt.sign(
      {
        id: user.id,
        username,
        active: user.active,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1w",
      }
    );

    res.send({
      message: "Thank you for signing up!",
      token,
    });
  } catch ({ name, message }) {
    next({ name, message });
  }
});

// PATCH route for updating user that requires being logged in
usersRouter.patch("/:userId", requireUser, async (req, res, next) => {
  const { username, password, location } = req.body;

  // if updates were passed in req.body, add to update object
  const updateFields = {};
  if (username) {
    updateFields.username = username;
  }

  if (password) {
    updateFields.password = password;
  }

  if (location) {
    updateFields.location = location;
  }

  // if req.body.active exists
  if (req.body.hasOwnProperty("active")) {
    // change active status based on boolean value
    const { active } = req.body;
    updateFields.active = active;
  }

  try {
    const user = await getUserById(req.params.userId);

    // verify user is updating own user information
    if (user.id === req.user.id) {
      const updatedUser = await updateUser(req.user.id, updateFields);

      res.send({ user: updatedUser });
    } else {
      // if not the user, throw UnauthorizedUserError
      next({
        name: "UnauthorizedUserError",
        message: "You cannot update another user",
      });
    }
  } catch ({ name, message }) {
    next({ name, message });
  }
});

// DELETE route, kind of unneccesary since PATCH can toggle active status
// requires active user so it can seem more permanent than toggling active
usersRouter.delete("/:userId", requireActiveUser, async (req, res, next) => {
  try {
    const user = await getUserById(req.params.userId);

    // verify user is updating their own information
    if (user.id === req.user.id) {
      //set active to false in database
      const updatedUser = await updateUser(user.id, { active: false });

      res.send({ user: updatedUser });
    } else {
      // if not the user, throw UnauthorizedUserError, otherwise throw UserNotFoundError
      next({
        name: "UnauthorizedUserError",
        message: "You cannot delete another user",
      });
    }
  } catch ({ name, message }) {
    next({ name, message });
  }
});

module.exports = usersRouter;
