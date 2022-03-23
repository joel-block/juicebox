const { Client } = require("pg");
const client = new Client("postgres://localhost:5432/juicebox-dev");

async function getAllUsers() {
  const { rows } = await client.query(
    `SELECT id, username, name, location, active
    FROM users;
    `
  );
  return rows;
}

async function createUser({ username, password, name, location }) {
  try {
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

async function updateUser(id, fields = {}) {
  const setString = Object.keys(fields)
    .map((key, index) => `"${key}"=$${index + 1}`)
    .join(", ");
  if (setString.length === 0) {
    return;
  }

  try {
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

async function createPost({ authorId, title, content }) {
  try {
    const {
      rows: [post],
    } = await client.query(
      `
        INSERT INTO users("authorId", title, content)
        VALUES ($1, $2, $3)
        RETURNING *;
    `,
      [authorId, title, content]
    );
    return post;
  } catch (error) {
    throw error;
  }
}
async function updatePost(id, { title, content, active }) {
  const setString = Object.keys({ title, content, active })
    .map((key, index) => `"${key}"=$${index + 1}`)
    .join(", ");
  if (setString.length === 0) {
    return;
  }

  try {
    const {
      rows: [post],
    } = await client.query(
      `
      UPDATE users
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
async function getAllPost() {
  const { rows } = await client.query(
    `SELECT "authorId", title, content, active
    FROM users;
    `
  );
  return rows;
}
async function getPostsByUser(userId) {
  try {
    const { rows } = client.query(`
      SELECT * FROM posts
      WHERE "authorId"=${userId};
    `);

    return rows;
  } catch (error) {
    throw error;
  }
}
async function getUserById(userId) {
  try {
    const { rows } = client.query(`
    SELECT * FROM users
    WHERE id=${userId}
    `);
    if (rows.length === 0) {
      return null;
    } else {
      const result = rows[0];
      const { id, username, name, location, active } = result;
      const posts = getPostsByUser(id);
      const user = { id, username, name, location, active, posts };
      return user;
    }
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
  getAllPost,
  getPostsByUser,
  getUserById,
};
