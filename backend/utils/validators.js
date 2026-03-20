const { z } = require('zod');

// Auth Schemas
const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Only alphanumeric and underscore allowed'),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Message Schemas
const sendMessageSchema = z.object({
  senderId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid senderId format'),
  receiverId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid receiverId format'),
  messageType: z.enum(['text', 'image', 'audio', 'media', 'sticker']).default('text'),
  message: z.string().max(2000).optional(),
  mediaUrl: z.string().url().optional(),
  audioUrl: z.string().url().optional(),
});

// Sticker Schema
const stickerSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid userId format'),
  imageUrl: z.string().url(),
  overlays: z.array(z.object({
    text: z.string(),
    color: z.string(),
    position: z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    }),
  })).optional(),
  audioUrl: z.string().url().optional(),
  isPublic: z.boolean().default(false),
});

module.exports = {
  registerSchema,
  loginSchema,
  sendMessageSchema,
  stickerSchema,
};
