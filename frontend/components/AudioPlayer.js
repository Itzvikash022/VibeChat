import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';

/**
 * AudioPlayer Component
 * Handles playback of voice messages.
 * Ensures only one audio plays at a time via external control.
 */
const AudioPlayer = ({ url, isMe, theme, currentPlayingUrl, setCurrentPlayingUrl, hideCopy }) => {
  const playerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) return undefined;

    const player = createAudioPlayer(url);
    playerRef.current = player;

    const syncStatus = (status) => {
      setIsPlaying(Boolean(status.playing));
      if (status.playing || status.didJustFinish || status.error) {
        setLoading(false);
      }
      if (status.didJustFinish) {
        setCurrentPlayingUrl(null);
      }
    };

    syncStatus(player.currentStatus);
    player.addListener('playbackStatusUpdate', syncStatus);

    return () => {
      player.remove();
      playerRef.current = null;
    };
  }, [url, setCurrentPlayingUrl]);

  // Stop if another audio starts playing elsewhere in the thread
  useEffect(() => {
    if (currentPlayingUrl !== url && isPlaying) {
      stopPlayback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayingUrl, url, isPlaying]);

  async function playSound() {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        shouldPlayInBackground: true,
      });

      if (!playerRef.current) {
        throw new Error('Audio player is not ready');
      }

      setLoading(true);
      playerRef.current.play();
      setIsPlaying(true);
      setCurrentPlayingUrl(url);
    } catch (error) {
      console.error('Audio playback error details:', error);
      Alert.alert('Playback Error', 'Could not play this audio file. Check your connection or permissions.');
      setLoading(false);
    }
  }

  async function stopPlayback() {
    if (playerRef.current) {
      playerRef.current.pause();
    }
    setIsPlaying(false);
    setLoading(false);
    if (currentPlayingUrl === url) {
      setCurrentPlayingUrl(null);
    }
  }

  const handlePress = () => {
    if (isPlaying) stopPlayback();
    else playSound();
  };

  const copyUrl = () => {
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(url);
      alert('Audio URL copied to clipboard!');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: isMe ? 'rgba(255,255,255,0.1)' : theme.input }]}
      onPress={handlePress}
    >
      <View style={styles.row}>
        <View style={{ width: 24, marginRight: 8, alignItems: 'center' }}>
          {loading ? (
            <ActivityIndicator size="small" color={isMe ? '#fff' : theme.accent} />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={isMe ? '#fff' : theme.accent} />
          )}
        </View>
        <View style={styles.wave}>
          <Text style={[styles.text, { color: isMe ? '#fff' : theme.text }]}>Voice Message</Text>
        </View>
        {!hideCopy && (
          <TouchableOpacity onPress={copyUrl} style={styles.copyBtn}>
            <Ionicons name="link-outline" size={16} color={isMe ? 'rgba(255,255,255,0.6)' : theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    borderRadius: 20,
    minWidth: 150,
    marginVertical: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  wave: { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  text: { fontSize: 12, fontWeight: '600', position: 'absolute', top: -18 },
  copyBtn: { marginLeft: 10, padding: 4 },
});

export default AudioPlayer;
