import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import ImageMessage from './ImageMessage';
import AudioPlayer from './AudioPlayer';
import api from '../services/api';

/**
 * StickerContent - Autoplay and minimal UI for stickers
 */
const StickerContent = ({ url, audioUrl, isMe, theme, currentPlayingUrl, setCurrentPlayingUrl }) => {
  const [status, setStatus] = useState('idle');
  const soundRef = useRef(null);
  const isAutoplayed = useRef(false);

  const play = async () => {
    if (!audioUrl) return;
    if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; }
    try {
      setCurrentPlayingUrl(audioUrl);
      setStatus('playing');
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl }, { shouldPlay: true },
        (s) => { if (s.didJustFinish) { setStatus('finished'); if (currentPlayingUrl === audioUrl) setCurrentPlayingUrl(null); } }
      );
      soundRef.current = sound;
    } catch (err) { console.error('Sticker audio error:', err); setStatus('finished'); }
  };

  const stop = async () => {
    if (soundRef.current) { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); soundRef.current = null; }
    setStatus('finished');
  };

  useEffect(() => {
    if (audioUrl && !isMe && !isAutoplayed.current) { isAutoplayed.current = true; setTimeout(play, 500); }
    return () => { if (soundRef.current) soundRef.current.unloadAsync(); };
  }, [audioUrl, isMe]);

  useEffect(() => {
    if (currentPlayingUrl && currentPlayingUrl !== audioUrl && status === 'playing') stop();
  }, [currentPlayingUrl]);

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={play} style={styles.stickerContainer}>
      <ImageMessage url={url} isMe={isMe} theme={theme} isSticker={true} hideCopy={true} />
      {audioUrl && (
        <View style={styles.stickerIconOverlay}>
          <Ionicons name={status === 'finished' ? 'refresh' : 'volume-high'} size={16} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
};

const MessageBubble = ({ item, userId, theme, currentPlayingUrl, setCurrentPlayingUrl }) => {
  const isMe = item.senderId?.toString() === userId?.toString();
  const { messageType, message, mediaUrl, audioUrl, createdAt } = item;

  // Also support the flat socket format (type/content)
  const type = messageType || item.type || 'text';
  const content = message || item.content || '';
  const media = mediaUrl || (type === 'image' ? item.content : null);
  const audio = audioUrl || (type === 'audio' ? item.content : null);

  const formatTime = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderContent = () => {
    switch (type) {
      case 'sticker':
        return (
          <StickerContent 
            url={media || content} audioUrl={audio} isMe={isMe} theme={theme}
            currentPlayingUrl={currentPlayingUrl} setCurrentPlayingUrl={setCurrentPlayingUrl}
          />
        );
      case 'image':
        return <ImageMessage url={media || content} isMe={isMe} theme={theme} hideCopy={true} />;
      case 'audio':
        return (
          <AudioPlayer url={audio || content} isMe={isMe} theme={theme}
            currentPlayingUrl={currentPlayingUrl} setCurrentPlayingUrl={setCurrentPlayingUrl} hideCopy={true}
          />
        );
      case 'media':
        return (
          <View>
            {media && <ImageMessage url={media} isMe={isMe} theme={theme} hideCopy={true} />}
            {audio && <AudioPlayer url={audio} isMe={isMe} theme={theme}
              currentPlayingUrl={currentPlayingUrl} setCurrentPlayingUrl={setCurrentPlayingUrl} hideCopy={true} />}
            {content && type === 'media' && <Text style={[styles.text, { color: isMe ? '#fff' : (theme['on-surface'] || theme.text) }]}>{content}</Text>}
          </View>
        );
      default:
        return <Text style={[styles.text, { color: isMe ? '#fff' : (theme['on-surface'] || theme.text) }]}>{content}</Text>;
    }
  };

  const isMedia = ['image', 'audio', 'sticker', 'media'].includes(type);

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
      <View style={[
        styles.bubble,
        isMedia 
          ? styles.mediaBubble
          : isMe
            ? [styles.bubbleMe, { backgroundColor: theme['primary-container'] || theme.myBubble || '#5d60eb' }]
            : [styles.bubbleThem, { backgroundColor: theme['surface-container-high'] || theme.theirBubble || '#222a3d', borderColor: (theme['outline-variant'] || '#464555') + '40' }]
      ]}>
        {renderContent()}
        <Text style={[
          styles.time, 
          { color: isMe ? 'rgba(255,255,255,0.55)' : (theme['on-surface-variant'] || theme.textSecondary || '#8b949e') + '99' },
          isMedia && styles.timeMedia
        ]}>
          {formatTime(createdAt || item.createdAt)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: 8, paddingHorizontal: 4 },
  rowMe: { justifyContent: 'flex-end' },
  rowThem: { justifyContent: 'flex-start' },
  
  bubble: { maxWidth: '75%' },
  bubbleMe: { 
    paddingVertical: 10, paddingHorizontal: 14, 
    borderTopLeftRadius: 18, borderTopRightRadius: 18, 
    borderBottomLeftRadius: 18, borderBottomRightRadius: 6 
  },
  bubbleThem: { 
    paddingVertical: 10, paddingHorizontal: 14, 
    borderTopLeftRadius: 18, borderTopRightRadius: 18, 
    borderBottomLeftRadius: 6, borderBottomRightRadius: 18,
    borderWidth: 1 
  },
  mediaBubble: { backgroundColor: 'transparent', padding: 0 },
  
  text: { fontSize: 15, lineHeight: 22 },
  time: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  timeMedia: { marginTop: 4, marginRight: 4 },

  stickerContainer: { position: 'relative' },
  stickerIconOverlay: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12,
    width: 24, height: 24, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
});

export default MessageBubble;
