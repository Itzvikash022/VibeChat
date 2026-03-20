const logger = require('../utils/logger');

/**
 * GET /users/:id
 */
const getUserById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id).select('-password -__v');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    
    // Proactive migration: generate vibeId if missing
    if (!user.vibeId) await user.save();

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /users/search/:vibeId
 */
const getUserByVibeId = async (req, res, next) => {
  let { vibeId } = req.params;
  if (!vibeId) return res.status(400).json({ success: false, message: 'Vibe ID required' });
  try {
    const user = await User.findOne({ vibeId: vibeId.toUpperCase() }).select('-password -__v');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /users/vibe-id
 */
const updateVibeId = async (req, res, next) => {
  const { userId, newVibeId } = req.body;
  if (!userId || !newVibeId?.trim()) {
    return res.status(400).json({ success: false, message: 'User ID and New Vibe ID are required.' });
  }
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.vibeId = newVibeId.trim();
    await user.save();

    return res.status(200).json({ 
      success: true,
      message: 'Vibe ID updated!', 
      data: { vibeId: user.vibeId }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This Vibe ID is already taken.' });
    }
    next(error);
  }
};

/**
 * PUT /users/push-token
 */
const updatePushToken = async (req, res, next) => {
  const { userId, pushToken } = req.body;
  if (!userId || !pushToken) {
    return res.status(400).json({ success: false, message: 'User ID and Push Token are required.' });
  }
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.pushToken = pushToken;
    await user.save();

    logger.info(`Push token updated for user ${userId}`);
    return res.status(200).json({ success: true, message: 'Push token updated' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUserById, getUserByVibeId, updateVibeId, updatePushToken };
