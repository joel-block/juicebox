// middleware function to check if a user is logged in
function requireUser(req, res, next) {
  if (!req.user) {
    next({
      name: "MissingUserError",
      message: "You must be logged in to perform this action",
    });
  }

  next();
}

// middleware function to check if an active user is logged in
function requireActiveUser(req, res, next) {
  if (!req.user.active) {
    next({
      name: "InactiveUserError",
      message: "This user account was deleted.",
    });
  }
  next();
}

module.exports = {
  requireUser,
  requireActiveUser,
};
