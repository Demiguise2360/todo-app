const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  dueDate:     { type: Date, default: null },
  hasTime:     { type: Boolean, default: false },
  completed:   { type: Boolean, default: false },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Todo', todoSchema);
