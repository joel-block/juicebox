const { Client } = require("pg");
const client = new Client("postgres://localhost:5432/juicebox-dev");

/* USER FUNCTIONS */

// returns an array of user objects
async function getAllUsers() {
  try {
    // destructures and returns an array of rows (user objects) from query response
    const { rows } = await client.query(`
      SELECT id, username, name, location, active
      FROM users;
    `);
    return rows;
  } catch (error) {
    throw error;
  }
}

// adds a row to users table and returns user object
async function createUser({ username, password, name, location }) {
  try {
    // destructures and returns user object from query response
    const {
      rows: [user],
    } = await client.query(
      `
      INSERT INTO users(username, password, name, location)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO NOTHING
      RETURNING *;
    `,
      [username, password, name, location]
    );
    return user;
  } catch (error) {
    throw error;
  }
}

// updates a specific row within the users table with new information
async function updateUser(id, fields = {}) {
  //build the setString to be used in the PSQL query
  const setString = Object.keys(fields)
    .map((key, index) => `"${key}"=$${index + 1}`)
    .join(", ");
  //if there's an empty update object, don't query database
  if (setString.length === 0) {
    return;
  }

  try {
    //destructure and return new user object from query response
    const {
      rows: [user],
    } = await client.query(
      `
      UPDATE users
      SET ${setString}
      WHERE id=${id}
      RETURNING *;
    `,
      Object.values(fields)
    );
    return user;
  } catch (error) {
    throw error;
  }
}

// returns a user object that contains relevent information
async function getUserById(userId) {
  try {
    // get relevent row from users table
    const { rows } = await client.query(`
      SELECT * FROM users
      WHERE id=${userId}
    `);

    // if user does not exist, return null, otherwise, return user object without password
    if (rows.length === 0) {
      return null;
    } else {
      const user = rows[0];
      delete user.password;

      // get posts to add to user object
      const posts = await getPostsByUser(userId);
      user.posts = posts;

      //return optimized user object
      return user;
    }
  } catch (error) {
    throw error;
  }
}

async function getUserByUsername(username) {
  try {
    const {
      rows: [user],
    } = await client.query(
      `
      SELECT *
      FROM users
      WHERE username=$1;
    `,
      [username]
    );

    return user;
  } catch (error) {
    throw error;
  }
}

/* POST FUNCTIONS */

// adds data into a row in posts table and returns post object
async function createPost({ authorId, title, content, tags = [] }) {
  try {
    // destructures and returns the post object from the query response
    const {
      rows: [post],
    } = await client.query(
      `
        INSERT INTO posts("authorId", title, content)
        VALUES ($1, $2, $3)
        RETURNING *;
    `,
      [authorId, title, content]
    );

    // add tags to tags table and create a tagList array
    const tagList = await createTags(tags);

    // return the optimized post object with added tags, linking tags and posts tables
    return await addTagsToPost(post.id, tagList);
  } catch (error) {
    throw error;
  }
}

// updates the data in a row in posts table
async function updatePost(id, fields = {}) {
  // pulling the tags off of the update object and deleteing it from the update object
  const { tags } = fields;
  delete fields.tags;

  //create formatted string for PSQL query
  const setString = Object.keys(fields)
    .map((key, index) => `"${key}"=$${index + 1}`)
    .join(", ");

  // if there's an empty update object, don't make PSQL query
  try {
    // destructure and return the new post object from the query response
    if (setString.length > 0) {
      await client.query(
        `
      UPDATE posts
      SET ${setString}
      WHERE id=${id}
      RETURNING *;
    `,
        Object.values(fields)
      );
    }

    // if there weren't any tags, return the post.
    if (tags === undefined) {
      return await getPostById(id);
    }
    // we are creating the tag list to use later
    const tagList = await createTags(tags);
    const tagListIdString = tagList.map((tag) => `${tag.id}`).join(", ");

    // removing extra tags that might be in the post_tags table
    await client.query(
      `
      DELETE FROM post_tags
      WHERE "tagId"
      NOT IN (${tagListIdString})
      AND "postId"=$1;
    `,
      [id]
    );

    // create post_tags as necessary
    await addTagsToPost(id, tagList);

    return await getPostById(id);
  } catch (error) {
    throw error;
  }
}

// returns an array of all rows (as optimized post objects) in posts table
async function getAllPosts() {
  try {
    // grabbing an array of ids from all posts to use below
    const { rows: postIds } = await client.query(`
      SELECT id
      FROM posts;
    `);

    // using Promise.all() to run async functions in parallel
    const posts = await Promise.all(
      // mapping over the array of ids to get the optimized post objects
      postIds.map((post) => getPostById(post.id))
    );

    return posts;
  } catch (error) {
    throw error;
  }
  return rows;
}

// returns an array of optimized post objects by user
async function getPostsByUser(userId) {
  try {
    // grabbing an array of ids from the user's posts to use below
    const { rows: postIds } = await client.query(`
      SELECT id
      FROM posts
      WHERE "authorId"=${userId};
    `);

    // using Promise.all() to run async functions in parallel
    const posts = await Promise.all(
      // mapping over the array of ids to get the optimized post objects
      postIds.map((post) => getPostById(post.id))
    );

    return posts;
  } catch (error) {
    throw error;
  }
}

// get a post object by post.id that constains relevent information
async function getPostById(postId) {
  try {
    // first, get post object from specific postId
    const {
      rows: [post],
    } = await client.query(
      `
      SELECT *
      FROM posts
      WHERE id=$1;
    `,
      [postId]
    );

    // next, get tags associated with post
    const { rows: tags } = await client.query(
      `
      SELECT tags.*
      FROM tags
      JOIN post_tags ON tags.id=post_tags."tagId"
      WHERE post_tags."postId"=$1;
    `,
      [postId]
    );

    // next, get author object for post
    const {
      rows: [author],
    } = await client.query(
      `
      SELECT id, username, name, location
      FROM users
      WHERE id=$1;
    `,
      [post.authorId]
    );

    //add tags and author key-value pairs to post object
    post.tags = tags;
    post.author = author;

    //delete authorId key-value pair since new author object replaces information
    delete post.authorId;

    return post;
  } catch (error) {
    throw error;
  }
}

/* TAG FUNCTIONS */

// creates new tags that can be added to tags table and used by users later
async function createTags(tagList) {
  if (tagList.length === 0) {
    return;
  }
  //building INSERT string, ex. $1), ($2), ($3
  const insertValues = tagList.map((_, index) => `$${index + 1}`).join("), (");
  //then use in (${ insertValues }) in the INSERT client.query

  //building VALUES string, ex. $1, $2, $3
  const selectValues = tagList.map((_, index) => `$${index + 1}`).join(", ");
  //then use in (${ selectValues }) in the VALUES section in client.query

  try {
    //add new tags to tags table if they don't already exist in the table
    await client.query(
      `
      INSERT INTO tags(name)
      VALUES (${insertValues})
      ON CONFLICT (name) DO NOTHING;
      `,
      tagList
    );

    //returns the tag objects ({ name: '#example' }) for all newly created tags
    const { rows } = await client.query(
      `
      SELECT * FROM tags
      WHERE name
      IN (${selectValues});
    `,
      tagList
    );

    return rows;
  } catch (error) {
    throw error;
  }
}

// creates an entry in the through-table to link the tags and posts tables
async function createPostTag(postId, tagId) {
  try {
    await client.query(
      `
      INSERT INTO post_tags("postId", "tagId")
      VALUES ($1, $2)
      ON CONFLICT ("postId", "tagId") DO NOTHING;
      `,
      [postId, tagId]
    );
  } catch (error) {
    throw error;
  }
}

// creates entries in post_tags through-table and returns the associated post object
async function addTagsToPost(postId, tagList) {
  try {
    const createPostTagPromises = tagList.map((tag) =>
      createPostTag(postId, tag.id)
    );

    await Promise.all(createPostTagPromises);

    return await getPostById(postId);
  } catch (error) {
    throw error;
  }
}

// return an array of post objects with target tag name
async function getPostsByTagName(tagName) {
  try {
    // uses through-table to get the post ids associated with the tag name in an array
    const { rows: postIds } = await client.query(
      `
      SELECT posts.id
      FROM posts
      JOIN post_tags ON posts.id=post_tags."postId"
      JOIN tags ON tags.id=post_tags."tagId"
      WHERE tags.name=$1;
      `,
      [tagName]
    );

    // return an array after mapping over the post id array filled with post objects
    return await Promise.all(postIds.map((post) => getPostById(post.id)));
  } catch (error) {
    throw error;
  }
}

async function getAllTags() {
  try {
    const { rows } = await client.query(`
      SELECT * FROM tags;
    `);
    return rows;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  client,
  getAllUsers,
  createUser,
  updateUser,
  updatePost,
  createPost,
  getAllPosts,
  getPostsByUser,
  getUserById,
  createTags,
  addTagsToPost,
  getPostsByTagName,
  getAllTags,
  getUserByUsername,
};
