const mongoose = require('mongoose');

const overlaySchema = new mongoose.Schema({
  text:     { type: String, default: '' },
  color:    { type: String, default: '#ffffff' },
  position: {
    x: { type: Number, default: 0.5 },
    y: { type: Number, default: 0.5 },
  },
}, { _id: false });

/**
 * Sticker Schema – Phase 6 (v2)
 * Supports up to 2 independent text overlays, each with color + fractional position.
 */
const stickerSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mediaUrl: { type: String, required: true },
    audioUrl: { type: String, default: null },

    // Legacy single-overlay compat
    text:         { type: String, default: '' },
    textPosition: { x: { type: Number, default: 0.5 }, y: { type: Number, default: 0.5 } },

    // New: two independent overlays
    overlays: { type: [overlaySchema], default: [] },

    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Sticker', stickerSchema);
