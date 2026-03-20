import React from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

/**
 * StickerGridItem
 * Displays a single sticker in the picker grid.
 * - Tap to send
 * - Long press to delete
 */
const StickerGridItem = ({ sticker, onSend, onDelete, theme }) => {
  return (
    <TouchableOpacity
      style={[styles.cell, { backgroundColor: theme.input }]}
      onPress={() => onSend(sticker)}
      onLongPress={() => onDelete(sticker)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: sticker.mediaUrl }} style={styles.image} resizeMode="cover" />
      {sticker.audioUrl ? (
        <View style={styles.audioBadge}>
          <Ionicons name="volume-high" size={10} color="#fff" />
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cell: {
    width: '22%',
    aspectRatio: 1,
    margin: '1.5%',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  audioBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default StickerGridItem;
