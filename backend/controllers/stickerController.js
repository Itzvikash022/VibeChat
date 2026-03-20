const Sticker = require('../models/Sticker');

/**
 * POST /api/stickers
 * Save a media message as a personal sticker.
 */
const createSticker = async (req, res) => {
  const { userId, mediaUrl, audioUrl, isPublic, text, textPosition, overlays } = req.body;

  if (!userId || !mediaUrl) {
    return res.status(400).json({ error: 'userId and mediaUrl are required.' });
  }

  try {
    const sticker = await Sticker.create({
      userId,
      mediaUrl,
      audioUrl: audioUrl || null,
      text: text || '',
      textPosition: textPosition || { x: 0.5, y: 0.5 },
      overlays: overlays || [],
      isPublic: !!isPublic,
    });
    return res.status(201).json(sticker);
  } catch (err) {
    console.error('createSticker error:', err.message);
    return res.status(500).json({ error: 'Failed to save sticker.' });
  }
};

/**
 * GET /api/stickers/me?userId=<id>
 * Retrieve all stickers saved by the current user, newest first.
 */
const getMyStickers = async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId query param is required.' });
  }

  try {
    const stickers = await Sticker.find({ userId }).sort({ createdAt: -1 });
    return res.status(200).json(stickers);
  } catch (err) {
    console.error('getMyStickers error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch stickers.' });
  }
};

/**
 * DELETE /api/stickers/:id?userId=<id>
 * Delete a sticker – only the owner can delete.
 */
const deleteSticker = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId query param is required.' });
  }

  try {
    const sticker = await Sticker.findById(id);
    if (!sticker) return res.status(404).json({ error: 'Sticker not found.' });
    if (sticker.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this sticker.' });
    }
    await sticker.deleteOne();
    return res.status(200).json({ message: 'Sticker deleted.' });
  } catch (err) {
    console.error('deleteSticker error:', err.message);
    return res.status(500).json({ error: 'Failed to delete sticker.' });
  }
};

module.exports = { createSticker, getMyStickers, deleteSticker };
