const express = require("express");
const postsRouter = express.Router();

const { getAllPosts, createPost, updatePost, getPostById } = require("../db");
const { requireActiveUser } = require("./utils");

// middleware to log any requests to /posts
postsRouter.use((req, res, next) => {
  console.log("A request is being made to /posts");

  next();
});

// have access all active posts at localhost3000/api/posts/
postsRouter.get("/", async (req, res, next) => {
  try {
    // get all posts
    const allPosts = await getAllPosts();

    // filter posts to return if:
    // both the post and post author are active OR
    // if there is a req.user set and the user is the post author
    const posts = allPosts.filter((post) => {
      return (
        (post.active && post.author.active) ||
        (req.user && post.author.id === req.user.id)
      );
    });

    res.send({
      posts,
    });
  } catch ({ name, message }) {
    next({ name, message });
  }
});

// POST route for /posts for only active users
postsRouter.post("/", requireActiveUser, async (req, res, next) => {
  // pulls infor from req.body
  const { title, content, tags = "" } = req.body;

  // splits tags string into a formatted array
  const tagArr = tags.trim().split(/\s+/);
  // establishes new post object
  const postData = {};

  // only send the tags if there are some to send
  if (tagArr.length) {
    postData.tags = tagArr;
  }

  try {
    // add authorId, title, content to postData object
    postData.authorId = req.user.id;
    postData.title = title;
    postData.content = content;

    const post = await createPost(postData);
    // this will create the post and the tags for us
    // if the post comes back, res.send({ post });
    // otherwise, next an appropriate error object
    res.send({ post });
  } catch ({ name, message }) {
    next({ name, message });
  }
});

// PATCH route for posts/:postId for active users
postsRouter.patch("/:postId", requireActiveUser, async (req, res, next) => {
  // pull postId from req.params, ie the URL
  const { postId } = req.params;
  // pull info from req.body
  const { title, content, tags } = req.body;

  // establish update object
  const updateFields = {};

  // if each key-value pair exists, format if necessary, and add to object
  if (tags && tags.length > 0) {
    updateFields.tags = tags.trim().split(/\s+/);
  }

  if (title) {
    updateFields.title = title;
  }

  if (content) {
    updateFields.content = content;
  }

  try {
    // get original post using postId from req.params
    const originalPost = await getPostById(postId);

    // verify user and post author are the same before sending update
    if (originalPost.author.id === req.user.id) {
      const updatedPost = await updatePost(postId, updateFields);
      res.send({ post: updatedPost });
    } else {
      next({
        name: "UnauthorizedUserError",
        message: "You cannot update a post that is not yours",
      });
    }
  } catch ({ name, message }) {
    next({ name, message });
  }
});

// DELETE route for active users
postsRouter.delete("/:postId", requireActiveUser, async (req, res, next) => {
  try {
    // retrieve post object using req.params
    const post = await getPostById(req.params.postId);

    // verify post exists and that the user and post author are the same
    if (post && post.author.id === req.user.id) {
      // change post.active to false rather than delete post completely
      const updatedPost = await updatePost(post.id, { active: false });

      res.send({ post: updatedPost });
    } else {
      // if there was a post, throw UnauthorizedUserError, otherwise throw PostNotFoundError
      next(
        post
          ? {
              name: "UnauthorizedUserError",
              message: "You cannot delete a post which is not yours",
            }
          : {
              name: "PostNotFoundError",
              message: "That post does not exist",
            }
      );
    }
  } catch ({ name, message }) {
    next({ name, message });
  }
});

module.exports = postsRouter;
