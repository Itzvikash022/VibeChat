const mongoose = require('mongoose');

/**
 * User schema — now with email and hashed password for real auth.
 */
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    vibeId: {
      type: String,
      unique: true,
      sparse: true, // Allow existing users to be null initially
      trim: true,
      uppercase: true,
      match: [/^[@!_\-&<>()\[\]a-zA-Z0-9]*$/, 'Vibe ID contains invalid characters'],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true, // bcrypt hash — never stored in plain text
    },
    refreshToken: { type: String, default: null },
    pushToken: { type: String, default: null },
  },
  { timestamps: true }
);

// Add indexes for search optimization
userSchema.index({ email: 1 });
userSchema.index({ vibeId: 1 });

// Method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  const bcrypt = require('bcryptjs');
  return await bcrypt.compare(enteredPassword, this.password);
};

// Helper to generate a random uppercase alphanumeric ID
const generateRandomVibeId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Pre-save hook to generate a random Vibe ID if not provided
userSchema.pre('save', async function (next) {
  if (!this.vibeId) {
    this.vibeId = generateRandomVibeId();
  } else {
    this.vibeId = this.vibeId.toUpperCase();
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
