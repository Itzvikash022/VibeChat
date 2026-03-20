const mongoose = require('mongoose');

/**
 * Updated Message Schema for Phase 3
 * Features: Rich media types, multi-platform deletion logic.
 */
const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Phase 3 Fields
    messageType: {
      type: String,
      enum: ['text', 'image', 'audio', 'media', 'sticker'],
      default: 'text',
    },
    message: { type: String, trim: true }, // Optional for media-only messages
    mediaUrl: { type: String },           // Cloudinary URL for images
    audioUrl: { type: String },           // Cloudinary URL for audio
    
    // Deletion Logic
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Compound indexes for fast history lookup
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
