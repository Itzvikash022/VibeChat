import { io } from 'socket.io-client';
import { BASE_URL } from './api';

let socket = null;

/**
 * Initializes and returns the Socket.io connection.
 * @param {string} token - JWT Access Token
 * @returns {Socket} the socket instance
 */
export const getSocket = (token) => {
  if (!token) {
    throw new Error('Socket auth token is required');
  }

  if (!socket) {
    socket = io(BASE_URL, {
      transports: ['websocket'],
      auth: { token }, // Pass token for JWT verification
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      // If auth failed, we might want to trigger a refresh or logout
    });
  } else if (token && socket.auth?.token !== token) {
    socket.auth = { token };
  }
  return socket;
};

/**
 * Disconnects the socket and clears the instance.
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
