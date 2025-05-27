const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  ticketNumber: { type: String, required: true, default: 'TKT-' + Math.random().toString(36).substr(2, 6).toUpperCase() },
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
