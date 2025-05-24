const { MongoClient } = require('mongodb');

async function testConnection() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'kanban';
  
  console.log('Connecting to MongoDB at:', uri);
  
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  
  try {
    // Connect to the MongoDB server
    await client.connect();
    console.log('✅ Successfully connected to MongoDB');
    
    // Get the database
    const db = client.db(dbName);
    console.log(`📁 Using database: ${dbName}`);
    
    // List all collections in the database
    const collections = await db.listCollections().toArray();
    console.log('\n📂 Collections:');
    if (collections.length > 0) {
      collections.forEach(collection => {
        console.log(`- ${collection.name}`);
      });
    } else {
      console.log('No collections found in the database.');
    }
    
    // Get server status
    const adminDb = db.admin();
    const serverStatus = await adminDb.serverStatus();
    console.log('\n🔄 Server Status:');
    console.log(`- Version: ${serverStatus.version}`);
    console.log(`- Host: ${serverStatus.host}`);
    
    // Check if the database exists
    const dbs = await adminDb.listDatabases();
    const dbExists = dbs.databases.some(db => db.name === dbName);
    console.log(`\n💾 Database '${dbName}' exists:`, dbExists);
    
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n🔌 Make sure MongoDB is running on port 27017');
      console.log('   You can start MongoDB with: brew services start mongodb-community');
    }
  } finally {
    // Close the connection
    if (client) {
      await client.close();
      console.log('\n🔌 Connection closed');
    }
  }
}

// Run the test
testConnection().catch(console.error);
