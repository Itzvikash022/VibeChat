const { Expo } = require('expo-server-sdk');
const logger = require('./logger');

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Sends a push notification to a single token.
 * @param {string} pushToken - The target Expo push token.
 * @param {object} payload - Notification data { title, body, data }.
 */
const sendPushNotification = async (pushToken, { title, body, data }) => {
  // Check that all your push tokens appear to be valid Expo push tokens
  if (!Expo.isExpoPushToken(pushToken)) {
    logger.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const messages = [{
    to: pushToken,
    sound: 'default',
    title,
    body,
    data: data || {},
    priority: 'high',
    channelId: 'default',
  }];

  try {
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        logger.error('Error sending push notification chunk:', error);
      }
    }
    
    // NOTE: In a full production app, you should check tickets for errors
    // and handle them (e.g. remove invalid tokens from DB).
    // For now, we'll just log success.
    logger.info('Push notification tickets received:', tickets.length);
  } catch (err) {
    logger.error('Failed to send push notification:', err);
  }
};

module.exports = { sendPushNotification };
