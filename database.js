import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const DB_NAME = 'ohjtie.db';

const connectToDB = async () => {
  const db = await open({
    filename: DB_NAME,
    driver: sqlite3.Database,
  });

  if (db) {
    console.log(`Connected to the ${DB_NAME} database.`);
  }

  return db;
};

const createTable = async () => {
  const sql = `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
  )`;

  const db = await connectToDB(); // Ota yhteys tietokantaan

  try {
    await db.run(sql); // Suorita kysely
    console.log('Table created successfully');
  } catch (err) {
    console.error(err.message);
  } finally {
    await db.close(); // Sulje yhteys
  }
};

createTable();

export default connectToDB;