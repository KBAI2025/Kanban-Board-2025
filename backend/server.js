require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const boardRoutes = require('./routes/boardRoutes');
const llmRoutes = require('./routes/llmRoutes');
const cardRoutes = require('./routes/cards');
const app = express();

// Enable CORS for all routes
const isDevelopment = process.env.NODE_ENV !== 'production';

// CORS configuration
// Allow all origins in development for easier testing
const allowedOrigins = isDevelopment 
  ? ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:8092', 'http://192.168.2.41:8080', 'http://192.168.2.41:8081', 'http://192.168.2.41:8092']
  : ['http://localhost:8080', 'http://localhost:8081'];

// CORS middleware function
const corsMiddleware = (req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if the origin is in the allowed list or if it's a development environment
  if (isDevelopment || (origin && allowedOrigins.includes(origin))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
};

// Apply CORS middleware
app.use(corsMiddleware);

// Body parser middleware
app.use(express.json());

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is running and CORS is working!' });
});

// API routes
app.use('/api/boards', boardRoutes);
app.use('/api/llm', llmRoutes);
app.use('/api/cards', cardRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kanban';
const PORT = process.env.PORT || 5002;

// Function to connect to MongoDB
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    return false;
  }
};

// Start the server
const startServer = async () => {
  const isConnected = await connectDB();
  
  if (!isConnected) {
    console.error('Failed to connect to MongoDB. Please make sure MongoDB is running.');
    process.exit(1);
  }

  try {
    const server = app.listen(PORT, '0.0.0.0', () => {
      const address = server.address();
      const host = address.address === '::' ? '0.0.0.0' : address.address;
      const port = address.port;
      
      console.log(`\n🚀 Server running on port ${port}`);
      console.log(`🌐 Access the test endpoint at http://localhost:${port}/api/test`);
      console.log(`📊 Access the boards API at http://localhost:${port}/api/boards`);
      console.log(`🌍 Server is accessible from other devices on your network at: http://${require('os').networkInterfaces().en0?.find(i => i.family === 'IPv4')?.address || host}:${port}\n`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please free the port or use a different one.`);
      } else {
        console.error('Server error:', error);
      }
      process.exit(1);
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\nShutting down server...');
      server.close(() => {
        console.log('Server has been terminated.');
        process.exit(0);
      });
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please free the port or use a different one.`);
      } else {
        console.error('Server error:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();
