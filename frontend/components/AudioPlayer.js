import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

/**
 * AudioPlayer Component
 * Handles playback of voice messages. 
 * Ensures only one audio plays at a time via external control.
 */
const AudioPlayer = ({ url, isMe, theme, currentPlayingUrl, setCurrentPlayingUrl, hideCopy }) => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return sound ? () => { sound.unloadAsync(); } : undefined;
  }, [sound]);

  // Monitor global currentPlayingUrl to stop if another one starts
  useEffect(() => {
    if (currentPlayingUrl !== url && isPlaying) {
      stopPlayback();
    }
  }, [currentPlayingUrl]);

  async function playSound() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      if (sound) {
        await sound.playAsync();
        setIsPlaying(true);
        setCurrentPlayingUrl(url);
        return;
      }

      setLoading(true);
      console.log('Attempting to play audio:', url);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true }
      ).catch(err => {
        console.error('Audio.Sound.createAsync error:', err);
        throw err;
      });
      
      setSound(newSound);
      setIsPlaying(true);
      setCurrentPlayingUrl(url);
      setLoading(false);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.error) {
          console.error('Playback status error:', status.error);
        }
        if (status.didJustFinish) {
          setIsPlaying(false);
          setCurrentPlayingUrl(null);
        }
      });
    } catch (error) {
      console.error('Audio playback error details:', error);
      Alert.alert('Playback Error', 'Could not play this audio file. Check your browser permissions.');
      setLoading(false);
    }
  }

  async function stopPlayback() {
    if (sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
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
