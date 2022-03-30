const express = require("express");
const tagsRouter = express.Router();
const { getAllTags, getPostsByTagName } = require("../db");

// logs all requests to /tags
tagsRouter.use((req, res, next) => {
  console.log("A request is being made to /tags");

  next();
});

// returns all current tags
tagsRouter.get("/", async (req, res, next) => {
  try {
    const tags = await getAllTags();

    res.send({
      tags,
    });
  } catch ({ name, message }) {
    next({ name, message });
  }
});

// returns all posts with specific tag name
tagsRouter.get("/:tagName/posts", async (req, res, next) => {
  // pulls tag name from req.params
  const { tagName } = req.params;
  // # gets changed to %23 when encoded for url
  if (tagName.startsWith("%23")) {
    // sets tag to correct name using #
    tagName = `#${tagName.slice(3)}`;
  }
  try {
    // gets all posts with tag name
    const allPosts = await getPostsByTagName(tagName);

    // filter posts to return if:
    // both the post and post author are active OR
    // if there is a req.user set and the user is the post author
    const posts = allPosts.filter((post) => {
      return (
        (post.active && post.author.active) ||
        (req.user && post.author.id === req.user.id)
      );
    });

    res.send({ posts });
  } catch ({ name, message }) {
    next({ name, message });
  }
});

module.exports = tagsRouter;
