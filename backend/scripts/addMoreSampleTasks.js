const { MongoClient } = require('mongodb');

async function addMoreSampleTasks() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'kanban';
  
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    // Clear existing tasks
    await db.collection('tasks').deleteMany({});
    
    // Sample tasks data
    const sampleTasks = [
      {
        title: 'Complete project setup',
        description: 'Set up the project with all necessary dependencies and configurations.',
        column: { id: 'in-progress', name: 'In Progress' },
        boardId: 'default-board',
        labels: ['high-priority', 'backend'],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
        priority: 'high',
        assignee: 'developer@example.com'
      },
      {
        title: 'Design user interface',
        description: 'Create mockups for the main dashboard and task management views.',
        column: { id: 'todo', name: 'To Do' },
        boardId: 'default-board',
        labels: ['design', 'frontend'],
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Due in 3 days
        priority: 'medium',
        assignee: 'designer@example.com'
      },
      {
        title: 'Write API documentation',
        description: 'Document all API endpoints with examples and usage instructions.',
        column: { id: 'in-progress', name: 'In Progress' },
        boardId: 'default-board',
        labels: ['documentation', 'backend'],
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Due in 5 days
        priority: 'high',
        assignee: 'tech-writer@example.com'
      },
      {
        title: 'Fix login page styling',
        description: 'Adjust the login page layout for better mobile responsiveness.',
        column: { id: 'done', name: 'Done' },
        boardId: 'default-board',
        labels: ['bug', 'frontend'],
        dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Was due yesterday
        priority: 'low',
        assignee: 'frontend@example.com',
        completedAt: new Date()
      },
      {
        title: 'Set up CI/CD pipeline',
        description: 'Configure GitHub Actions for automated testing and deployment.',
        column: { id: 'todo', name: 'To Do' },
        boardId: 'default-board',
        labels: ['devops', 'high-priority'],
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Due in 2 days
        priority: 'high',
        assignee: 'devops@example.com'
      }
    ];
    
    // Insert the sample tasks
    const result = await db.collection('tasks').insertMany(sampleTasks);
    console.log(`✅ Added ${result.insertedCount} sample tasks`);
    
  } catch (error) {
    console.error('❌ Error adding sample tasks:', error);
  } finally {
    await client.close();
  }
}

addMoreSampleTasks();
