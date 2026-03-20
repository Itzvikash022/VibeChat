import React from 'react';
import { Image, StyleSheet, ActivityIndicator, View, TouchableOpacity, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * ImageMessage Component
 * Uses expo-image-picker images uploaded to Cloudinary.
 */
const ImageMessage = ({ url, isMe, theme, hideCopy, isSticker }) => {
  return (
    <View style={[
      styles.container, 
      isSticker && { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 }
    ]}>
      <Image
        source={{ uri: url }}
        style={[styles.image, isSticker && { width: 140, height: 140 }]}
        resizeMode="contain"
      />
      {!hideCopy && (
        <TouchableOpacity 
          style={styles.copyBtn} 
          onPress={() => {
            if (Platform.OS === 'web') {
              navigator.clipboard.writeText(url);
              alert('URL Copied to clipboard!');
            }
          }}
        >
          <Ionicons name="link-outline" size={14} color="#fff" />
          <Text style={styles.copyText}> Copy Link</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  image: {
    width: 240,
    height: 180,
    borderRadius: 12,
  },
  copyBtn: {
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 12,
  },
  copyText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

export default ImageMessage;
