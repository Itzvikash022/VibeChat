import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import ImageMessage from './ImageMessage';
import AudioPlayer from './AudioPlayer';
import api from '../services/api';

/**
 * StickerContent - Autoplay and minimal UI for stickers
 */
const StickerContent = ({ id, url, audioUrl, isMe, theme, currentPlayingUrl, setCurrentPlayingUrl, isLastMessage }) => {
  const [status, setStatus] = useState('idle');
  const playerRef = useRef(null);
  const isAutoplayed = useRef(false);

  useEffect(() => {
    if (!audioUrl) return undefined;

    const player = createAudioPlayer(audioUrl);
    playerRef.current = player;

    const syncStatus = (s) => {
      if (s.didJustFinish) {
        setStatus('finished');
        setCurrentPlayingUrl((current) => (current === audioUrl ? null : current));
      } else if (s.playing) {
        setStatus('playing');
      }
    };

    syncStatus(player.currentStatus);
    player.addListener('playbackStatusUpdate', syncStatus);

    return () => {
      player.remove();
      playerRef.current = null;
    };
  }, [audioUrl, setCurrentPlayingUrl]);

  const play = async () => {
    if (!audioUrl) return;
    try {
      setCurrentPlayingUrl(audioUrl);
      setStatus('playing');
      playerRef.current?.play();
    } catch (err) { console.error('Sticker audio error:', err); setStatus('finished'); }
  };

  const stop = async () => {
    if (playerRef.current) { playerRef.current.pause(); }
    setStatus('finished');
  };

  useEffect(() => {
    let isCancelled = false;
    const checkAndPlay = async () => {
      if (!audioUrl || isMe || isAutoplayed.current || !isLastMessage) return;
      try {
        const playedStr = await AsyncStorage.getItem('played_stickers');
        let playedList = playedStr ? JSON.parse(playedStr) : [];
        if (!Array.isArray(playedList)) playedList = [];

        if (!playedList.includes(id)) {
          isAutoplayed.current = true;
          if (!isCancelled) setTimeout(play, 500);
          playedList.push(id);
          if (playedList.length > 500) playedList = playedList.slice(-500);
          await AsyncStorage.setItem('played_stickers', JSON.stringify(playedList));
        }
      } catch (err) {
        console.error('AsyncStorage sticker autoplay error:', err);
      }
    };

    checkAndPlay();

    return () => {
      isCancelled = true;
    };
  }, [audioUrl, isMe, id, isLastMessage]);

  useEffect(() => {
    if (currentPlayingUrl && currentPlayingUrl !== audioUrl && status === 'playing') stop();
  }, [currentPlayingUrl, audioUrl, status]);

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

const MessageBubble = ({ item, userId, theme, currentPlayingUrl, setCurrentPlayingUrl, isLastMessage }) => {
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
            id={item._id}
            url={media || content} audioUrl={audio} isMe={isMe} theme={theme}
            currentPlayingUrl={currentPlayingUrl} setCurrentPlayingUrl={setCurrentPlayingUrl}
            isLastMessage={isLastMessage}
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
  );
};

const styles = StyleSheet.create({
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
