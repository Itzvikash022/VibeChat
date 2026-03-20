import React from 'react';
import { View, StyleSheet } from 'react-native';
import Picker from 'emoji-picker-react';

/**
 * EmojiPicker Component
 * Used on Web platforms for selecting emojis.
 */
const EmojiPicker = ({ onEmojiSelect, theme, isVisible }) => {
  if (!isVisible) return null;

  return (
    <View style={styles.container}>
      <Picker
        onEmojiClick={(emojiData) => onEmojiSelect(emojiData.emoji)}
        theme={theme.isDark ? 'dark' : 'light'}
        lazyLoadEmojis={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    zIndex: 1000,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
});

export default EmojiPicker;
