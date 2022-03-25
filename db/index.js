const { Client } = require("pg");
const client = new Client("postgres://localhost:5432/juicebox-dev");

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

// adds data into a row in posts table and returns post object
// added tags to createPost
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
async function updatePost(id, { title, content, active }) {
  //create formatted string for PSQL query
  const setString = Object.keys({ title, content, active })
    .map((key, index) => `"${key}"=$${index + 1}`)
    .join(", ");
  // if there's an empty update object, don't make PSQL query
  if (setString.length === 0) {
    return;
  }

  try {
    // destructure and return the new post object from the query response
    const {
      rows: [post],
    } = await client.query(
      `
      UPDATE posts
      SET ${setString}
      WHERE id=${id}
      RETURNING *;
    `,
      Object.values({ title, content, active })
    );
    return post;
  } catch (error) {
    throw error;
  }
}
/* *********Rewritten below to optimize post objects********* */
// // returns an array of all rows (as post objects) in posts table
// async function getAllPosts() {
//   const { rows } = await client.query(`
//     SELECT *
//     FROM posts;
//     `);
//   return rows;
// }

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

/* *********Rewritten below to optimize post objects********* */
// // returns an array of post objects by user
// async function getPostsByUser(userId) {
//   try {
//     const { rows } = await client.query(`
//       SELECT * FROM posts
//       WHERE "authorId"=${userId};
//     `);

//     return rows;
//   } catch (error) {
//     throw error;
//   }
// }

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
      const posts = await getPostsByUser(userId);
      user.posts = posts;
      return user;
    }
  } catch (error) {
    throw error;
  }
}

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

    //returns the table entries for all newly created tags
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

// create an individual tag that will eventually be attached to post object
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

// add tags to post that will eventually be attached to post object
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

// get a post object that constains relevent information
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
  } catch (error) {}
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
};
