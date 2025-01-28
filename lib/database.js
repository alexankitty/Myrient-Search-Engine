import { Sequelize } from 'sequelize';
import 'dotenv/config';

// Import models
import defineFile from './models/file.js';
import defineQueryCount from './models/queryCount.js';

const sequelize = new Sequelize(process.env.POSTGRES_DB, process.env.POSTGRES_USER, process.env.POSTGRES_PASSWORD, {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  dialect: 'postgres',
  logging: process.env.DEBUG === '1' ? console.log : false
});

// Initialize models
export const File = defineFile(sequelize);
export const QueryCount = defineQueryCount(sequelize);

export async function initDB() {
  try {
    // First try to connect to postgres directly to create database if needed
    const rootSequelize = new Sequelize('postgres', process.env.POSTGRES_USER, process.env.POSTGRES_PASSWORD, {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      dialect: 'postgres',
      logging: false
    });

    try {
      // Try to create database if it doesn't exist
      await rootSequelize.query(`CREATE DATABASE ${process.env.POSTGRES_DB};`);
      console.log('Database did not exist, created.');
    } catch (err) {
      // Ignore error if database already exists
      if (!err.message.includes('already exists')) {
        throw err;
      }
    } finally {
      await rootSequelize.close();
    }

    // Now connect to the actual database
    await sequelize.authenticate();
    console.log('DB connected.');

    // Get current database schema
    const queryInterface = sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();

    if (!tables.includes('Files') || !tables.includes('QueryCounts')) {
      // If tables don't exist, create them
      console.log('DB doesn\'t exist, creating initial database schema...');
      await sequelize.sync();
      console.log('Database schema created.');

      // Initialize QueryCount if it's a new installation
      await QueryCount.create({ count: 0 });
    } else {
      // Auto-migrate existing schema
      console.log('Checking for DB migrations...');
      await sequelize.sync({ alter: true });
      console.log('DB migrations completed.');
    }

    // Only force sync if explicitly requested
    if (process.env.FORCE_FILE_REBUILD === '1') {
      await sequelize.sync({ force: true });
      console.log('DB forcefully synchronized.');
    }
  } catch (error) {
    console.error('Unable to connect to the DB:', error);
    process.exit(1);
  }
}

export default sequelize;