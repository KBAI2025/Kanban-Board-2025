const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  columnId: {
    type: String,
    required: true
  },
  boardId: {
    type: String,
    required: true
  },
  position: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Add any additional fields you need
  labels: [{
    type: String,
    default: []
  }],
  dueDate: {
    type: Date,
    default: null
  },
  assignee: {
    type: String,
    default: null
  }
});

// Update the updatedAt timestamp before saving
cardSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Card = mongoose.model('Card', cardSchema);

module.exports = Card;
