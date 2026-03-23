const mongoose = require('mongoose');
const Message = require('../models/Message');
const User    = require('../models/User');

/**
 * DELETE /messages
 * Body: { userId, otherUserId, deleteType: 'self' | 'both' }
 *
 * 'self' → soft-delete: push userId into deletedFor on matched messages.
 *          The other user still sees the messages.
 * 'both' → hard-delete: remove the documents entirely for both users.
 */
const deleteHistory = async (req, res, next) => {
  const { userId, otherUserId, deleteType } = req.body;

  if (!userId || !otherUserId || !deleteType) {
    return res.status(400).json({ error: 'userId, otherUserId, and deleteType are required.' });
  }

  // Match all messages between the two users (both directions)
  const query = {
    $or: [
      { senderId: userId, receiverId: otherUserId },
      { senderId: otherUserId, receiverId: userId },
    ],
  };

  try {
    if (deleteType === 'both') {
      // Hard delete — remove documents entirely
      await Message.deleteMany(query);
    } else {
      // Soft delete — only hide for the requesting user
      await Message.updateMany(query, {
        $addToSet: { deletedFor: new mongoose.Types.ObjectId(userId) },
      });
    }

    return res.status(200).json({ success: true, deleteType });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /messages/conversations?userId=...
 * Returns a list of unique conversation partners for the given user,
 * each with their username and the last non-deleted message.
 * This is called on login so offline messages show up in the sidebar.
 */
const getConversations = async (req, res, next) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required.' });

  try {
    const uid = new mongoose.Types.ObjectId(userId);

    // Find all messages where this user is sender or receiver (and not deleted for them)
    const messages = await Message.find({
      $or: [{ senderId: uid }, { receiverId: uid }],
      deletedFor: { $nin: [uid] },
    })
      .sort({ createdAt: -1 }) // newest first so we can pick the last per partner
      .lean();

    // Build a map of partnerId → latest message
    const partnerMap = new Map();
    for (const msg of messages) {
      const partnerId = msg.senderId.toString() === userId
        ? msg.receiverId.toString()
        : msg.senderId.toString();
      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, msg);
      }
    }

    if (partnerMap.size === 0) return res.status(200).json([]);

    // Fetch usernames for all partners in one query
    const partnerIds = [...partnerMap.keys()];
    const users = await User.find({ _id: { $in: partnerIds } }).select('_id username').lean();
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.username]));

    const conversations = partnerIds
      .filter((id) => userMap[id]) // skip deleted users
      .map((id) => {
        const msg = partnerMap.get(id);
        return {
          userId:      id,
          username:    userMap[id],
          lastMessage: msg.message || (msg.messageType !== 'text' ? `[${msg.messageType}]` : ''),
          time:        msg.createdAt,
        };
      });

    return res.status(200).json({ success: true, data: conversations });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /messages/conversations
 * Body: { userId, vibeIdOrUsername }
 * Used to "add" a conversation by verifying the partner exists.
 */
const addConversation = async (req, res, next) => {
  const { userId, vibeIdOrUsername } = req.body;
  if (!vibeIdOrUsername) return res.status(400).json({ error: 'Vibe ID or Username required' });

  try {
    const q = vibeIdOrUsername.trim();
    // Search by vibeId (exact, case-insensitive if needed, but schema uses uppercase) or username
    const partner = await User.findOne({
      $or: [
        { vibeId: q.toUpperCase() },
        { username: { $regex: new RegExp('^' + q + '$', 'i') } }
      ]
    }).select('_id username vibeId');

    if (!partner) return res.status(404).json({ error: 'User not found' });
    if (userId && partner._id.toString() === userId) return res.status(400).json({ error: "You can't chat with yourself." });

    return res.status(200).json({
      success: true,
      data: {
        userId: partner._id,
        username: partner.username,
        vibeId: partner.vibeId
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { deleteHistory, getConversations, addConversation };
