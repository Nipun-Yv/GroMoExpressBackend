import pg from "pg";
import dotenv from "dotenv";

dotenv.config(); // load variables from .env

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});

const connectDB = () => db.connect();

export {connectDB,db};