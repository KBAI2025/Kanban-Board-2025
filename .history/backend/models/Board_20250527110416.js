const mongoose = require('mongoose');
const Counter = require('./Counter');

// Function to generate the next ticket number
const generateTicketNumber = async function() {
  try {
    const counter = await Counter.findByIdAndUpdate(
      { _id: 'ticketNumber' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    
    // Format the number with leading zeros (e.g., 1 becomes '0001')
    const paddedNumber = String(counter.seq).padStart(4, '0');
    return `PT-${paddedNumber}`;
  } catch (error) {
    console.error('Error generating ticket number:', error);
    // Fallback to a random string if counter fails
    return `PT-${Math.floor(1000 + Math.random() * 9000)}`;
  }
};

const taskSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  ticketNumber: { 
    type: String, 
    required: true, 
    default: async function() {
      return await generateTicketNumber();
    } 
  },
  assignee: { 
    id: { type: String },
    name: { type: String },
    avatar: { type: String }
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium' 
  },
  epicLabel: { type: String, default: '' },
  position: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const columnSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  tasks: [taskSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const boardSchema = new mongoose.Schema({
  name: { type: String, required: true, default: 'My Kanban Board' },
  columns: [columnSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt timestamp before saving
boardSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Board', boardSchema);
