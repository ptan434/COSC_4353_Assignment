require("dotenv").config();
const {Pool} = require("pg");

const pool = new Pool({
    host: process.env.db_host,
    user: process.env.db_user,
    password: process.env.db_password,
    port: process.env.db_port,
    database: process.env.db_database
});

module.exports = pool;
