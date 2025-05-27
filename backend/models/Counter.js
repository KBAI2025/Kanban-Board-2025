const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 1 }
});

counterSchema.statics.getNextSequence = async function(name) {
  const result = await this.findByIdAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return result.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
