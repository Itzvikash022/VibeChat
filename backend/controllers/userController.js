const User = require('../models/User');

/**
 * GET /users/:id
 * Returns a user by their MongoDB _id.
 */
const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id).select('-password -__v');

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Proactive migration: generate vibeId if missing
    if (!user.vibeId) {
      await user.save(); // Trigger pre-save hook
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error('GetUserById error:', error.message);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid user ID format.' });
    }
    return res.status(500).json({ error: 'Server error.' });
  }
};

/**
 * GET /users/search/:vibeId
 * Returns a user by their unique vibeId.
 */
const getUserByVibeId = async (req, res) => {
  let { vibeId } = req.params;
  if (!vibeId) return res.status(400).json({ error: 'Vibe ID required' });

  try {
    const user = await User.findOne({ vibeId: vibeId.toUpperCase() }).select('-password -__v');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json(user);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};

/**
 * PATCH /users/vibe-id
 * Body: { userId, newVibeId }
 */
const updateVibeId = async (req, res) => {
  const { userId, newVibeId } = req.body;

  if (!userId || !newVibeId?.trim()) {
    return res.status(400).json({ error: 'User ID and New Vibe ID are required.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.vibeId = newVibeId.trim();
    await user.save();

    return res.status(200).json({ 
      message: 'Vibe ID updated!', 
      vibeId: user.vibeId 
    });
  } catch (error) {
    if (error.code === 11000 || (error.name === 'MongoError' && error.code === 11000)) {
      // Check if the duplicate key error is on the vibeId field
      const field = Object.keys(error.keyPattern || {})[0] || 'vibeId';
      return res.status(409).json({ error: `This ${field === 'vibeId' ? 'Vibe ID' : field} is already taken.` });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    console.error('UpdateVibeId server error:', error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
};

module.exports = { getUserById, getUserByVibeId, updateVibeId };
