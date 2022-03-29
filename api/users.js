const express = require("express");
const usersRouter = express.Router();
const { requireUser } = require("./utils");

const {
  getAllUsers,
  getUserByUsername,
  createUser,
  getUserById,
  updateUser,
} = require("../db");
const jwt = require("jsonwebtoken");

usersRouter.use((req, res, next) => {
  console.log("A request is being made to /users");

  next();
});

usersRouter.get("/", async (req, res) => {
  const users = await getAllUsers();

  res.send({
    users,
  });
});

usersRouter.post("/login", async (req, res, next) => {
  const { username, password } = req.body;

  // request must have both
  if (!username || !password) {
    next({
      name: "MissingCredentialsError",
      message: "Please supply both a username and password",
    });
  }

  try {
    const user = await getUserByUsername(username);

    if (user && user.password == password) {
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

usersRouter.post("/register", async (req, res, next) => {
  const { username, password, name, location } = req.body;

  try {
    const _user = await getUserByUsername(username);

    if (_user) {
      next({
        name: "UserExistsError",
        message: "A user by that username already exists",
      });
    }

    const user = await createUser({
      username,
      password,
      name,
      location,
    });

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

usersRouter.patch("/:userId", requireUser, async (req, res, next) => {
  const { username, password, location } = req.body;

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

  if (req.body.hasOwnProperty("active")) {
    const { active } = req.body;
    updateFields.active = active;
  }

  try {
    const user = await getUserById(req.params.userId);

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

usersRouter.delete("/:userId", requireActiveUser, async (req, res, next) => {
  try {
    const user = await getUserById(req.params.userId);

    if (user.id === req.user.id) {
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
