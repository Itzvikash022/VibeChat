import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api';
import StickerGridItem from './StickerGridItem';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

const StickerPicker = ({ userId, onSend, onClose, theme, navigation }) => {
  const [activeTab, setActiveTab] = useState('library');
  const [stickers, setStickers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Creation State
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedAudio, setSelectedAudio] = useState(null); // { uri, name, type, size }
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ─── Fetch Library ───────────────────────────────────────────────────────────
  const fetchStickers = useCallback(async () => {
    if (activeTab !== 'library' || !userId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/stickers/me?userId=${userId}`);
      setStickers(data);
    } catch (err) {
      console.error('Failed to load stickers:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab]);

  useEffect(() => {
    fetchStickers();
  }, [fetchStickers]);

  // ─── Document Validations ───────────────────────────────────────────────────
  const validateFile = (file, expectedType) => {
    if (!file) return false;
    
    // Size check
    if (file.size && file.size > MAX_FILE_SIZE) {
      Alert.alert('File too large', 'Please select a file smaller than 5MB.');
      return false;
    }

    // Type check (basic)
    if (expectedType === 'image' && !file.type?.startsWith('image/')) {
       Alert.alert('Invalid Type', 'Please select an image or GIF.');
       return false;
    }
    if (expectedType === 'audio' && !file.type?.startsWith('audio/') && !file.name?.endsWith('.m4a') && !file.name?.endsWith('.mp3')) {
       // On Web, audio type detection can be hit or miss, so we check extensions too
       Alert.alert('Invalid Type', 'Please select a valid audio file.');
       return false;
    }

    return true;
  };

  // ─── Image Picking ───────────────────────────────────────────────────────────
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const file = {
        uri: asset.uri,
        name: asset.fileName || `sticker_${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
        size: asset.fileSize || 0,
      };
      if (validateFile(file, 'image')) {
        setSelectedImage(file);
      }
    }
  };

  // ─── Audio File Picking ──────────────────────────────────────────────────────
  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const file = {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'audio/mpeg',
          size: asset.size || 0,
        };
        if (validateFile(file, 'audio')) {
          setSelectedAudio(file);
          setRecording(null); // Clear recording if file picked
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open document picker.');
    }
  };

  // ─── Audio Recording ─────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      Alert.alert('Error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setSelectedAudio({
      uri,
      name: `recording_${Date.now()}.m4a`,
      type: 'audio/m4a',
      size: 0, // recording size isn't easily available immediately
    });
    setRecording(null);
  };

  // ─── Upload Helper ───────────────────────────────────────────────────────────
  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    if (Platform.OS === 'web') {
      const resp = await fetch(file.uri);
      const blob = await resp.blob();
      formData.append('file', blob, file.name || 'upload');
    } else {
      formData.append('file', {
        uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
        name: file.name,
        type: file.type,
      });
    }

    const { data } = await api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.url;
  };

  // ─── Create Action ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!selectedImage) {
      Alert.alert('Wait', 'Please select an image/GIF first.');
      return;
    }
    if (!userId) {
      Alert.alert('Session Error', 'User ID is missing. Please log in again.');
      console.error('UserId is null or empty in StickerPicker');
      return;
    }

    setUploading(true);
    try {
      console.log('--- Creating Sticker ---');
      console.log('UserId:', userId);
      
      const mediaUrl = await uploadToCloudinary(selectedImage);
      console.log('Cloudinary Media:', mediaUrl);

      let audioUrl = null;
      if (selectedAudio) {
        audioUrl = await uploadToCloudinary(selectedAudio);
        console.log('Cloudinary Audio:', audioUrl);
      }

      const payload = {
        userId,
        mediaUrl,
        audioUrl,
        isPublic: false,
      };
      
      console.log('Posting to /stickers:', payload);

      const { data } = await api.post('/stickers', payload);
      console.log('Sticker Saved:', data);

      Alert.alert('Success', 'Sticker added to library!');
      // Reset & Switch
      setSelectedImage(null);
      setSelectedAudio(null);
      setActiveTab('library');
    } catch (err) {
      console.error('Create sticker error:', err.response?.data || err.message);
      const serverMsg = err.response?.data?.error || 'Failed to save sticker.';
      Alert.alert('Error', serverMsg);
    } finally {
      setUploading(false);
    }
  };

  // ─── Send/Delete ─────────────────────────────────────────────────────────────
  const handleDelete = (sticker) => {
    const doDelete = async () => {
      try {
        await api.delete(`/stickers/${sticker._id}?userId=${userId}`);
        setStickers((prev) => prev.filter((s) => s._id !== sticker._id));
      } catch {
        Alert.alert('Error', 'Failed to delete sticker.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this sticker?')) doDelete();
    } else {
      Alert.alert('Delete Sticker', 'Remove this sticker?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ─── Renderers ───────────────────────────────────────────────────────────────
  const renderLibrary = () => (
    <View style={{ flex: 1 }}>
      {loading ? (
        <ActivityIndicator color={theme.accent} style={styles.loader} />
      ) : stickers.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="sticker-plus-outline" size={48} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No stickers yet.{'\n'}Switch to "Create" to add one!
          </Text>
        </View>
      ) : (
        <FlatList
          data={stickers}
          keyExtractor={(item) => item._id}
          numColumns={4}
          renderItem={({ item }) => (
            <StickerGridItem 
              sticker={item} 
              onSend={() => { onSend(item); onClose(); }} 
              onDelete={handleDelete} 
              theme={theme}
            />
          )}
          contentContainerStyle={styles.grid}
        />
      )}
    </View>
  );

  const renderCreate = () => (
    <View style={styles.createPanel}>
      <MaterialCommunityIcons name="sticker-plus-outline" size={56} color={theme.textSecondary} />
      <Text style={[styles.editorTitle, { color: theme.text }]}>Sticker Editor</Text>
      <Text style={[styles.editorSubtitle, { color: theme.textSecondary }]}>
        Add an image, text overlay, and audio to create a custom sticker.
      </Text>
      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: theme.sendBtn }]}
        onPress={() => {
          onClose();
          if (navigation) {
            navigation.navigate('StickerEditor', { userId });
          } else {
            Alert.alert('TODO', 'Open StickerEditorScreen');
          }
        }}
      >
        <Text style={styles.submitBtnText}>Open Editor</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.panel, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'library' && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('library')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'library' ? theme.accent : theme.textSecondary }]}>LIBRARY</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'create' && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('create')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'create' ? theme.accent : theme.textSecondary }]}>CREATE</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {activeTab === 'library' ? renderLibrary() : renderCreate()}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 380,
    borderTopWidth: 1, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    overflow: 'hidden', zIndex: 999, elevation: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  tabs: { flexDirection: 'row', flex: 1 },
  tab: { paddingVertical: 14, paddingHorizontal: 16, marginRight: 8 },
  tabText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  closeBtn: { padding: 12 },
  
  loader: { marginTop: 60 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 40 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginTop: 10 },
  grid: { paddingHorizontal: 8, paddingBottom: 16 },

  createPanel: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  editorTitle: { fontSize: 18, fontWeight: '800', marginTop: 8 },
  editorSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  
  submitBtn: {
    width: '100%', paddingVertical: 14, borderRadius: 10, alignItems: 'center'
  },
  disabledBtn: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default StickerPicker;
