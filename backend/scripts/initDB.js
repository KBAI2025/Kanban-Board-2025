const { MongoClient } = require('mongodb');

async function initDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'kanban';
  
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    // Create collections if they don't exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (!collectionNames.includes('boards')) {
      console.log('Creating boards collection...');
      await db.createCollection('boards');
    }
    
    if (!collectionNames.includes('tasks')) {
      console.log('Creating tasks collection...');
      await db.createCollection('tasks');
    }
    
    // Create indexes
    console.log('Creating indexes...');
    await db.collection('tasks').createIndex({ 
      title: 'text',
      description: 'text',
      'column.name': 'text',
      'labels': 'text'
    }, { 
      name: 'task_search_index',
      weights: {
        title: 3,
        'column.name': 2,
        labels: 2,
        description: 1
      }
    });
    
    console.log('✅ Database initialization complete!');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  } finally {
    await client.close();
  }
}

initDB();
