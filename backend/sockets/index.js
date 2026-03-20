const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/push');
const logger = require('../utils/logger');

// ── In-memory presence tracking (resets on server restart) ────────────────────
// Tracks which user ID is connected to which socket (supports multiple connections per user)
const onlineUserIds = new Map(); // userId -> Set(socket.id)
const socketToUser = new Map(); // socketId → userId

/**
 * Initializes all Socket.io event handlers.
 */
const initSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ── join ──────────────────────────────────────────────────────────────────
    // User joins their personal room and marks themselves as online.
    // ── join ──────────────────────────────────────────────────────────────────
    // User joins their personal room and marks themselves as online.
    socket.on('join', (userId) => {
      const uid = userId.toString();
      socket.join(uid);
      
      // Track multiple sockets per user
      if (!onlineUserIds.has(uid)) {
        onlineUserIds.set(uid, new Set());
      }
      onlineUserIds.get(uid).add(socket.id);
      socketToUser.set(socket.id, uid);
      
      console.log(`User ${uid} is online (sockets: ${onlineUserIds.get(uid).size})`);

      // Broadcast to ALL connected clients so anyone with this
      // user's chat open can update their status indicator immediately.
      io.emit('user_online', { userId: uid });
    });

    // ── get_online_status ─────────────────────────────────────────────────────
    // Point-in-time check: "is this user currently connected?"
    socket.on('get_online_status', ({ userId }) => {
      socket.emit('online_status', {
        userId,
        online: onlineUserIds.has(userId.toString()),
      });
    });

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

        // Check if recipient is online (even if in another room/chat)
        const receiverSockets = onlineUserIds.get(receiverId.toString());
        if (receiverSockets && receiverSockets.size > 0) {
          io.to(receiverId.toString()).emit('receive_message', payload);
        } else {
          // Recipient is offline, send push notification
          // Do this asynchronously so we don't block the 'message_sent' response
          (async () => {
            try {
              const [sender, receiver] = await Promise.all([
                User.findById(senderId).select('username'),
                User.findById(receiverId).select('pushToken')
              ]);

              if (receiver?.pushToken) {
                const body = messageType === 'text' ? message : `Sent an ${messageType}`;
                await sendPushNotification(receiver.pushToken, {
                  title: sender?.username || 'New Message',
                  body,
                  data: { senderId, type: 'chat_message' },
                });
              }
            } catch (err) {
              logger.error('Error handling offline push notification:', err.message);
            }
          })();
        }

        socket.emit('message_sent', payload);
      } catch (err) {
        logger.error('send_message logic error:', err.message);
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
        socketToUser.delete(socket.id);
        
        const sockets = onlineUserIds.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            onlineUserIds.delete(userId);
            console.log(`User ${userId} is offline`);
            // Broadcast offline status so any open chats update immediately
            io.emit('user_offline', { userId });
          } else {
            console.log(`User ${userId} still has ${sockets.size} active connections`);
          }
        }
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = initSocket;
