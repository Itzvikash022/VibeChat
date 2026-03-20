const mongoose = require('mongoose');
const Message = require('../models/Message');

// ── In-memory presence tracking (resets on server restart) ────────────────────
const onlineUsers  = new Map(); // userId  → socketId
const socketToUser = new Map(); // socketId → userId

/**
 * Initializes all Socket.io event handlers.
 */
const initSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ── join ──────────────────────────────────────────────────────────────────
    // User joins their personal room and marks themselves as online.
    socket.on('join', (userId) => {
      const uid = userId.toString();
      socket.join(uid);
      onlineUsers.set(uid, socket.id);
      socketToUser.set(socket.id, uid);
      console.log(`User ${uid} is online`);

      // Broadcast to ALL connected clients so anyone with this
      // user's chat open can update their status indicator immediately.
      io.emit('user_online', { userId: uid });
    });

    // ── get_online_status ─────────────────────────────────────────────────────
    // Point-in-time check: "is this user currently connected?"
    socket.on('get_online_status', ({ userId }) => {
      socket.emit('online_status', {
        userId,
        online: onlineUsers.has(userId.toString()),
      });
    });

    // ── send_message ──────────────────────────────────────────────────────────
    socket.on('send_message', async (data) => {
      const { senderId, receiverId, messageType, message, mediaUrl, audioUrl } = data;
      if (!senderId || !receiverId) {
        socket.emit('error', { message: 'Invalid message payload.' });
        return;
      }
      try {
        const newMessage = await Message.create({ 
          senderId, 
          receiverId, 
          messageType: messageType || 'text',
          message, 
          mediaUrl, 
          audioUrl 
        });
        const payload = {
          _id:         newMessage._id,
          senderId:    newMessage.senderId,
          receiverId:  newMessage.receiverId,
          messageType: newMessage.messageType,
          message:     newMessage.message,
          mediaUrl:    newMessage.mediaUrl,
          audioUrl:    newMessage.audioUrl,
          createdAt:   newMessage.createdAt,
        };
        io.to(receiverId).emit('receive_message', payload);
        socket.emit('message_sent', payload);
      } catch (err) {
        console.error('send_message error:', err.message);
        socket.emit('error', { message: 'Failed to send message.' });
      }
    });

    // ── get_history ───────────────────────────────────────────────────────────
    // Excludes messages soft-deleted for the requesting user.
    // Supports pagination via 'before' (timestamp) and 'limit'.
    socket.on('get_history', async (data) => {
      const { userId, otherUserId, before, limit = 50 } = data;
      try {
        const query = {
          $or: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
          deletedFor: { $nin: [new mongoose.Types.ObjectId(userId)] },
        };

        if (before) {
          query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
          .sort({ createdAt: -1 }) // Get latest first for pagination
          .limit(limit);

        // Send back reversed so they are in chronological order for the UI
        socket.emit('chat_history', messages.reverse());
      } catch (err) {
        console.error('get_history error:', err.message);
        socket.emit('error', { message: 'Failed to load chat history.' });
      }
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const userId = socketToUser.get(socket.id);
      if (userId) {
        onlineUsers.delete(userId);
        socketToUser.delete(socket.id);
        console.log(`User ${userId} is offline`);
        // Broadcast offline status so any open chats update immediately
        io.emit('user_offline', { userId });
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = initSocket;
