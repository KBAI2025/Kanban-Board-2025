const { MongoClient } = require('mongodb');

// Connection URI
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'kanban';

let client;
let db;

/**
 * Connect to MongoDB
 * @returns {Promise<{db: Db, client: MongoClient}>}
 */
async function connectToDatabase() {
  if (!client) {
    client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();
    db = client.db(dbName);
  }
  return { db, client };
}

module.exports = {
  connectToDatabase,
};
