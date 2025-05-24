const { MongoClient } = require('mongodb');

async function addSampleTask() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'kanban';
  
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    // Sample task data
    const sampleTask = {
      title: 'Complete project setup',
      description: 'Set up the project with all necessary dependencies and configurations.',
      column: {
        id: 'in-progress',
        name: 'In Progress'
      },
      boardId: 'default-board',
      labels: ['high-priority', 'backend'],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Insert the sample task
    const result = await db.collection('tasks').insertOne(sampleTask);
    console.log('✅ Sample task added:', result.insertedId);
    
  } catch (error) {
    console.error('❌ Error adding sample task:', error);
  } finally {
    await client.close();
  }
}

addSampleTask();
