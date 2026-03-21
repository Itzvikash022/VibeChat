import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { getSocket, disconnectSocket } from '../services/socketService';
import api from '../services/api';
import MessageBubble from '../components/MessageBubble';
import EmojiPicker from '../components/EmojiPicker';
import StickerPicker from '../components/StickerPicker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Notifications, Device, Constants } from '../utils/nativeModules';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const formatTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
const getInitial = (str) => str?.[0]?.toUpperCase() || '?';

// ─── Sticker audio helpers ─────────────────────────────────────────────────────
let _globalSound = null;
const stopGlobalSound = async () => {
  if (_globalSound) { try { await _globalSound.unloadAsync(); } catch {} _globalSound = null; }
};

// ─── Recording helpers ─────────────────────────────────────────────────────────
let _recording = null;

// ─── Push Notifications helpers ────────────────────────────────────────────────
async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return null;

  // Set up the handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  let token;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
        return;
      }
      
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId || 
                        Constants?.easConfig?.projectId || 
                        'be4c2a5c-4b5c-4f7d-8d5c-bd3c3c4d5e6f';

      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } else {
      console.log('Must use physical device for Push Notifications');
    }
  } catch (err) {
    console.error('registerForPushNotificationsAsync error:', err.message);
  }

  return token;
}

// ─── Upload helper ─────────────────────────────────────────────────────────────
const uploadToCloudinary = async (localUri, resourceType = 'image') => {
  const formData = new FormData();
  const ext = localUri.split('.').pop();
  formData.append('file', {
    uri: localUri,
    type: resourceType === 'video' ? `video/${ext}` : (resourceType === 'raw' ? 'audio/m4a' : `image/${ext}`),
    name: `upload.${ext}`,
  });
  formData.append('upload_preset', 'vibechat_unsigned');
  const res = await fetch(`https://api.cloudinary.com/v1_1/drfptsgim/${resourceType}/upload`, { method: 'POST', body: formData });
  const data = await res.json();
  return data.secure_url;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function MainScreen({ navigation }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState('');
  const [vibeId, setVibeId] = useState('');
  const [editingVibeId, setEditingVibeId] = useState(false);
  const [newVibeIdInput, setNewVibeIdInput] = useState('');
  const [vibeIdError, setVibeIdError] = useState('');

  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [newChatId, setNewChatId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  const [pendingImage, setPendingImage] = useState(null);
  const [pendingAudio, setPendingAudio] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const [currentPlayingUrl, setCurrentPlayingUrl] = useState(null);

  const socketRef = useRef(null);
  const flatListRef = useRef(null);
  const activeChatRef = useRef(null);

  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    (async () => {
      const id = await AsyncStorage.getItem('userId');
      if (!id) return;
      
      const token = await registerForPushNotificationsAsync();
      if (token) {
        try {
          await api.put('/users/push-token', { userId: id, pushToken: token });
        } catch (err) {
          console.error('Failed to sync push token:', err.message);
        }
      }
    })();

    // Listen for notifications while the app is foregrounded
    const foregroundSub = Notifications.addNotificationReceivedListener(notification => {
      // You can handle in-app alerts here if desired
    });

    // Listen for when a user interactions with a notification (e.g. taps it)
    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      const { senderId } = response.notification.request.content.data;
      if (senderId) {
        // Logic to jump to that chat could go here
      }
    });

    return () => {
      foregroundSub.remove();
      responseSub.remove();
    };
  }, []);

  // ─── Load user and connect socket ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const id = await AsyncStorage.getItem('userId');
      const name = await AsyncStorage.getItem('username');
      const vid = await AsyncStorage.getItem('vibeId');
      const token = await AsyncStorage.getItem('accessToken');
      
      if (!id || !token) { navigation.replace('Login'); return; }
      
      setUserId(id);
      setUsername(name || '');
      setVibeId(vid || '');

      const socket = getSocket(token);
      socketRef.current = socket;
      socket.on('connect', () => setSocketConnected(true));
      socket.on('disconnect', () => setSocketConnected(false));
      socket.on('connect_error', () => setSocketConnected(false));
      socket.emit('join', id);

      // Backend uses snake_case event names — must match exactly
      socket.on('receive_message', (msg) => {
        const cur = activeChatRef.current;
        if (cur && (msg.senderId?.toString() === cur.userId || msg.receiverId?.toString() === cur.userId)) {
          setMessages((prev) => [...prev, msg]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
        }
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.userId === msg.senderId?.toString() || c.userId === msg.receiverId?.toString());
          if (idx < 0) return prev;
          const updated = [...prev];
          const preview = msg.messageType === 'text' ? msg.message : `[${msg.messageType}]`;
          updated[idx] = { ...updated[idx], lastMessage: preview, time: msg.createdAt || new Date().toISOString() };
          return updated;
        });
      });

      // Also listen to our own sent messages echoed back
      socket.on('message_sent', (msg) => {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m._id === msg._id || (m.status === 'sending' && m.message === msg.message));
          if (idx >= 0) { 
            const next = [...prev]; 
            next[idx] = { ...msg, status: 'sent' }; 
            return next; 
          }
          return prev;
        });
      });

      socket.on('chat_history', (history) => {
        setMessages(history);
        setLoadingHistory(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 300);
      });

      socket.on('user_online', ({ userId: uid }) => setOnlineUserIds((prev) => new Set([...prev, uid])));
      socket.on('user_offline', ({ userId: uid }) => setOnlineUserIds((prev) => { const s = new Set(prev); s.delete(uid); return s; }));

      // 1. Load from cache for speed
      const saved = await AsyncStorage.getItem(`conversations_${id}`);
      if (saved) setConversations(JSON.parse(saved));

      // 2. Fetch fresh list from server
      try {
        const { data: res } = await api.get(`/messages/conversations?userId=${id}`);
        if (res.success) {
          setConversations(res.data);
          await AsyncStorage.setItem(`conversations_${id}`, JSON.stringify(res.data));
        }
      } catch (err) {
        console.error('Failed to fetch conversations:', err.message);
      }
    })();
    return () => { disconnectSocket(); };
  }, []);

  useEffect(() => {
    if (userId && conversations.length > 0) {
      AsyncStorage.setItem(`conversations_${userId}`, JSON.stringify(conversations));
    }
  }, [conversations, userId]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleUpdateVibeId = async () => {
    const val = newVibeIdInput.trim().toUpperCase();
    if (!val) { setVibeIdError('Cannot be empty'); return; }
    const validPattern = /^[A-Z0-9@!_\-&<>()\[\]]+$/;
    if (!validPattern.test(val)) { setVibeIdError('Only letters, numbers, and @!_-&<>()[] allowed'); return; }
    if (/\s/.test(val)) { setVibeIdError('Spaces not allowed'); return; }
    try {
      const res = await api.patch('/users/vibe-id', { userId, newVibeId: val });
      const nextVibeId = res.data?.data?.vibeId || val;
      setVibeId(nextVibeId);
      await AsyncStorage.setItem('vibeId', nextVibeId);
      setEditingVibeId(false);
      setVibeIdError('');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to update';
      setVibeIdError(msg);
    }
  };

  const openChat = (conv) => {
    setActiveChat(conv);
    setMessages([]);
    setLoadingHistory(true);
    // Backend event name: get_history, params: userId + otherUserId
    socketRef.current?.emit('get_history', { userId, otherUserId: conv.userId });
    // Safety fallback: if socket never responds, stop spinning after 8s
    setTimeout(() => setLoadingHistory(false), 8000);
  };

  const startNewChat = async (query) => {
    const q = (query || newChatId || '').trim();
    if (!q) return;
    try {
      // POST /messages/conversations — formal add conversation flow
      const res = await api.post('/messages/conversations', { userId, vibeIdOrUsername: q });
      const user = res.data.data;
      
      const existing = conversations.find((c) => c.userId === user.userId);
      if (!existing) {
        const newConv = { userId: user.userId, username: user.username, lastMessage: '', time: '' };
        setConversations((prev) => [newConv, ...prev]);
        openChat(newConv);
      } else {
        openChat(existing);
      }
      setNewChatId('');
      setShowSettings(false);
    } catch (err) {
      const msg = err?.response?.data?.error || 'No user found with that ID or Vibe ID.';
      Alert.alert('Not Found', msg);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['userId', 'username', 'vibeId', 'accessToken', 'refreshToken']);
    disconnectSocket();
    navigation.replace('Login');
  };

  const handleDeleteChat = () => {
    if (!activeChat) return;
    setShowDeleteModal(true);
  };

  const doDeleteChat = async (deleteType) => {
    setShowDeleteModal(false);
    try {
      // Call backend: 'self' = delete for me only, 'both' = delete for everyone
      await api.delete('/messages', { data: { userId, otherUserId: activeChat.userId, deleteType } });
    } catch (err) {
      console.warn('Delete API failed, clearing locally anyway:', err?.message);
    }
    // Always clean up local state regardless of API success
    if (deleteType === 'both') {
      // Remove from conversation list too
      setConversations((prev) => prev.filter((c) => c.userId !== activeChat.userId));
    } else {
      // Keep conversation entry but clear messages
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.userId === activeChat.userId);
        if (idx < 0) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], lastMessage: '', time: '' };
        return updated;
      });
    }
    setMessages([]);
    setActiveChat(null);
  };

  // ─── Media helpers ─────────────────────────────────────────────────────────

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled) setPendingImage(result.assets[0].uri);
    setShowAttachMenu(false);
  };

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      _recording = recording;
      setIsRecording(true);
      setShowAttachMenu(false);
    } catch (e) { console.error('Failed to start recording', e); }
  };

  const stopRecording = async () => {
    try {
      await _recording.stopAndUnloadAsync();
      const uri = _recording.getURI();
      _recording = null;
      setIsRecording(false);
      setPendingAudio(uri);
    } catch (e) { console.error('Failed to stop recording', e); }
  };

  const sendMessage = useCallback(async () => {
    if (!activeChat) return;
    const text = inputText.trim();
    const img = pendingImage;
    const aud = pendingAudio;
    if (!text && !img && !aud) return;
    setInputText(''); setPendingImage(null); setPendingAudio(null);
    let messageType = 'text'; let message = text; let mediaUrl = null; let audioUrl = null;
    const optimisticId = Date.now().toString();
    try {
      if (img) { setUploading(true); mediaUrl = await uploadToCloudinary(img, 'image'); messageType = 'image'; setUploading(false); }
      else if (aud) { setUploading(true); audioUrl = await uploadToCloudinary(aud, 'raw'); messageType = 'audio'; setUploading(false); }
      // Payload must match backend schema: senderId, receiverId, messageType, message, mediaUrl, audioUrl
      // Optimistic render with 'sending' status
      const socketPayload = { senderId: userId, receiverId: activeChat.userId, messageType, message, mediaUrl, audioUrl };
      const optimistic = { 
        ...socketPayload, 
        _id: optimisticId, 
        createdAt: new Date().toISOString(),
        status: 'sending' 
      };
      setMessages((prev) => [...prev, optimistic]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);

      if (!socketConnected) {
        setMessages(prev => prev.map(m => m._id === optimisticId ? { ...m, status: 'failed' } : m));
        return;
      }

      socketRef.current?.emit('send_message', socketPayload);

      const preview = messageType === 'text' ? message : `[${messageType}]`;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.userId === activeChat.userId);
        if (idx < 0) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], lastMessage: preview, time: new Date().toISOString() };
        return updated;
      });
    } catch (e) { 
      setUploading(false); 
      setMessages((prev) => prev.map((m) => m._id === optimisticId ? { ...m, status: 'failed' } : m));
      Alert.alert('Error', 'Failed to send message.'); 
    }
  }, [activeChat, inputText, pendingImage, pendingAudio, userId, socketConnected]);

  const handleSendSticker = useCallback((sticker) => {
    if (!activeChat) return;
    // sticker is the full sticker object from the library (has mediaUrl/audioUrl)
    const stickerUrl = typeof sticker === 'string' ? sticker : sticker.mediaUrl;
    const socketPayload = { senderId: userId, receiverId: activeChat.userId, messageType: 'sticker', message: '', mediaUrl: stickerUrl, audioUrl: sticker?.audioUrl || null };
    socketRef.current?.emit('send_message', socketPayload);
    const optimistic = { ...socketPayload, _id: Date.now().toString(), createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    setShowStickers(false);
  }, [activeChat, userId]);

  const handleKeyPress = (e) => {
    if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault(); sendMessage();
    }
  };

  // ─── Filtered conversations (local search) ────────────────────────────────
  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) =>
        c.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.vibeId && c.vibeId.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : conversations;

  // ────────────────────────────────────────────────────────────────────────────
  const showSidebar = isDesktop || !activeChat;
  const showChat = isDesktop || activeChat;

  return (
    <View style={[s.root, { backgroundColor: theme['background'] || theme.bg }]}>

      {/* ── Decorative background orbs ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Top-right large orb */}
        <View style={[s.orb, s.orbTopRight, { backgroundColor: (theme.primary || '#c0c1ff') + '18' }]} />
        {/* Bottom-left large orb */}
        <View style={[s.orb, s.orbBottomLeft, { backgroundColor: (theme.tertiary || '#65d9a5') + '12' }]} />
        {/* Center-right subtle orb */}
        <View style={[s.orb, s.orbCenterRight, { backgroundColor: (theme.secondary || '#d0bcff') + '0E' }]} />
        {/* Top-left tiny accent orb */}
        <View style={[s.orb, s.orbTopLeft, { backgroundColor: (theme['secondary-container'] || '#571bc1') + '20' }]} />
      </View>

      <View style={s.mainLayout}>

        {/* ══ LEFT SIDEBAR ══════════════════════════════════════════════════ */}
        {showSidebar && (
          <View style={[
            s.sidebar,
            s.sidebarGlass,
            Platform.OS === 'web' && s.sidebarGlassWeb,
            { borderRightColor: (theme['outline-variant'] || '#5b5ea6') + '30' },
            !isDesktop && { width: '100%', flex: 1, borderRightWidth: 0 },
          ]}>
            {/* ── Dot-grid decorative overlay (right edge) ── */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {/* Glowing side accent line */}
              <View style={[s.sidebarGlowBorder, { backgroundColor: (theme.primary || '#c0c1ff') + '55' }]} />
              {/* Dot pattern — web only via inline style */}
              {Platform.OS === 'web' && (
                <View
                  style={[StyleSheet.absoluteFill, { opacity: 0.25 }]}
                  // @ts-ignore
                  // eslint-disable-next-line react-native/no-inline-styles
                  accessibilityLabel="dot-grid"
                  pointerEvents="none"
                >
                  <View style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0, width: 32,
                    // @ts-ignore
                    backgroundImage: 'radial-gradient(circle, rgba(192,193,255,0.7) 1px, transparent 1px)',
                    backgroundSize: '8px 8px',
                  }} />
                </View>
              )}
            </View>

            {/* Brand Header (in sidebar only) */}
              <View style={s.brandHeader}>
                <Ionicons name="chatbubbles" size={28} color={theme.accent} />
                <Text style={[s.brandName, { color: theme.accent }]}>VibeChat</Text>
                <View style={[s.connectionDot, { backgroundColor: socketConnected ? '#4caf50' : '#f44336' }]} />
              </View>

            {/* Profile / Vibe ID Card */}
            <View style={s.profileContainer}>
              <View style={[s.profileCard, { backgroundColor: theme['surface-container-low'] || theme.card }]}>
                <View style={s.profileAvatarWrapper}>
                  <View style={[s.profileAvatar, { borderColor: (theme.primary || '#c0c1ff') + '33' }]}>
                     <Text style={[s.profileAvatarText, { color: theme['on-surface'] || theme.text }]}>{getInitial(username)}</Text>
                  </View>
                  <View style={[s.statusDot, { backgroundColor: theme.tertiary || '#65d9a5', borderColor: theme['surface-container-low'] || theme.card }]} />
                </View>
                <View style={s.profileInfo}>
                  <Text style={[s.profileName, { color: theme['on-surface'] || theme.text }]} numberOfLines={1}>{username}</Text>
                  <Text style={[s.profileVibeId, { color: theme['on-surface-variant'] || theme.textSecondary }]} selectable numberOfLines={1}>
                    {vibeId || userId}
                  </Text>
                </View>
              </View>
            </View>

            {/* Search Input (searches local list) */}
            <View style={s.searchContainer}>
              <View style={s.searchBox}>
                <Ionicons name="search" size={18} color={theme['on-surface-variant'] || theme.textSecondary} style={s.searchIcon} />
                <TextInput
                  style={[s.searchInput, { backgroundColor: theme['surface-container-lowest'] || theme.input, color: theme['on-surface'] || theme.text }]}
                  placeholder="Search by name or Vibe ID..."
                  placeholderTextColor={theme.outline || theme.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Conversation List */}
            <FlatList
              data={filteredConversations}
              keyExtractor={(item) => item.userId}
              renderItem={renderConv}
              contentContainerStyle={{ paddingBottom: 120 }}
              ListEmptyComponent={
                <Text style={[s.emptyText, { color: theme.outline || theme.textSecondary }]}>
                  No connections yet.{'\n'}Add a chat from Settings.
                </Text>
              }
            />

            {/* Bottom Action Card (Web Only) */}
            {isDesktop && (
              <View style={[s.bottomCard, { backgroundColor: theme['surface-container-low'] || theme.card, borderTopColor: (theme['outline-variant'] || '#333') + '30' }]}>
                <TouchableOpacity style={s.bottomAction} onPress={toggleTheme}>
                  <MaterialCommunityIcons name={isDark ? 'weather-night' : 'weather-sunny'} size={22} color={theme['on-surface-variant'] || theme.textSecondary} />
                  <Text style={[s.bottomActionText, { color: theme['on-surface-variant'] || theme.textSecondary }]}>{isDark ? 'Dark' : 'Light'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.bottomAction} onPress={() => setShowSettings(true)}>
                  <MaterialCommunityIcons name="cog" size={22} color={theme['on-surface-variant'] || theme.textSecondary} />
                  <Text style={[s.bottomActionText, { color: theme['on-surface-variant'] || theme.textSecondary }]}>Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.bottomAction} onPress={handleLogout}>
                  <MaterialCommunityIcons name="logout" size={22} color={theme.error || '#ffb4ab'} />
                  <Text style={[s.bottomActionText, { color: theme.error || '#ffb4ab' }]}>Logout</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ══ SETTINGS MODAL ═════════════════════════════════════════════════ */}
        <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
          <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowSettings(false)}>
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={(e) => e.stopPropagation()} 
              style={[s.settingsPanel, { backgroundColor: theme['surface-container'] || theme.card }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={[s.sidebarTitle, { color: theme['on-surface'] || theme.text }]}>VibeChat</Text>
                <View style={[s.statusDot, { backgroundColor: socketConnected ? '#4caf50' : '#f44336' }]} />
              </View>
              {/* Change Vibe ID */}
              <Text style={[s.settingsLabel, { color: theme['on-surface-variant'] || theme.textSecondary }]}>Change Vibe ID</Text>
              {editingVibeId ? (
                <View style={s.settingsRow}>
                  <TextInput
                    style={[s.settingsInput, { color: theme['on-surface'] || theme.text, backgroundColor: theme['surface-container-lowest'] || theme.input, borderColor: theme['outline-variant'] || '#333' }]}
                    value={newVibeIdInput}
                    onChangeText={setNewVibeIdInput}
                    autoCapitalize="characters"
                    maxLength={15}
                    autoFocus
                    placeholder="@VIBE-ID"
                    placeholderTextColor={theme.outline || theme.textSecondary}
                  />
                  <TouchableOpacity onPress={handleUpdateVibeId} style={{ marginLeft: 8 }}>
                    <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingVibeId(false)} style={{ marginLeft: 4 }}>
                    <Ionicons name="close-circle" size={24} color={theme.error || '#ff4444'} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[s.settingsBtn, { backgroundColor: theme['surface-container-lowest'] || theme.input }]} onPress={() => { setEditingVibeId(true); setNewVibeIdInput(vibeId || ''); setVibeIdError(''); }}>
                  <Text style={[{ color: theme['on-surface'] || theme.text, fontSize: 14, flex: 1 }]}>{vibeId || 'Not set'}</Text>
                  <MaterialCommunityIcons name="pencil" size={18} color={theme.primary} />
                </TouchableOpacity>
              )}
              {vibeIdError ? <Text style={s.errorText}>{vibeIdError}</Text> : null}

              {/* Add New Chat */}
              <Text style={[s.settingsLabel, { color: theme['on-surface-variant'] || theme.textSecondary, marginTop: 20 }]}>Add New Chat</Text>
              <View style={s.settingsRow}>
                <TextInput
                  style={[s.settingsInput, { color: theme['on-surface'] || theme.text, backgroundColor: theme['surface-container-lowest'] || theme.input, borderColor: theme['outline-variant'] || '#333' }]}
                  value={newChatId}
                  onChangeText={setNewChatId}
                  placeholder="Enter Vibe ID or username"
                  placeholderTextColor={theme.outline || theme.textSecondary}
                  autoCapitalize="none"
                  onSubmitEditing={() => startNewChat()}
                />
                <TouchableOpacity onPress={() => startNewChat()} style={{ marginLeft: 8 }}>
                  <LinearGradient colors={[theme.primary || '#c0c1ff', theme.secondary || '#d0bcff']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.addChatBtn}>
                    <MaterialCommunityIcons name="account-plus" size={20} color={theme['on-primary'] || '#1000a9'} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[s.closeSettingsBtn, { borderColor: theme['outline-variant'] || '#333' }]} onPress={() => setShowSettings(false)}>
                <Text style={{ color: theme['on-surface-variant'] || theme.textSecondary, fontSize: 14, fontWeight: '600' }}>Close</Text>
              </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

        {/* ══ DELETE CHAT MODAL ══════════════════════════════════════════════ */}
        <Modal transparent visible={showDeleteModal} animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
          {/* Semi-transparent backdrop — tap to close */}
          <TouchableOpacity
            style={s.deleteModalOverlay}
            activeOpacity={1}
            onPress={() => setShowDeleteModal(false)}
          >
            {/* Bottom sheet panel — stop tap propagation so only backdrop taps close */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={[s.deleteModal, Platform.OS === 'web' && s.deleteModalWeb, { backgroundColor: theme['surface-container'] || '#1c2333' }]}
            >
              {/* Drag indicator */}
              <View style={[s.deleteModalHandle, { backgroundColor: (theme['outline-variant'] || '#444') + '88' }]} />

              <Text style={[s.deleteModalTitle, { color: theme['on-surface'] || theme.text }]}>
                Delete Conversation
              </Text>
              <Text style={[s.deleteModalSub, { color: theme['on-surface-variant'] || theme.textSecondary }]}>
                with {activeChat?.username}
              </Text>

              {/* Delete for Everyone */}
              <TouchableOpacity
                style={[s.deleteModalOption, { backgroundColor: (theme.error || '#ffb4ab') + '18' }]}
                onPress={() => doDeleteChat('both')}
              >
                <MaterialCommunityIcons name="delete-forever" size={22} color={theme.error || '#ffb4ab'} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.deleteModalOptionTitle, { color: theme.error || '#ffb4ab' }]}>Delete for Everyone</Text>
                  <Text style={[s.deleteModalOptionSub, { color: (theme.error || '#ffb4ab') + 'AA' }]}>Removes messages for both users</Text>
                </View>
              </TouchableOpacity>

              {/* Delete for Me */}
              <TouchableOpacity
                style={[s.deleteModalOption, { backgroundColor: (theme['on-surface-variant'] || '#888') + '12' }]}
                onPress={() => doDeleteChat('self')}
              >
                <MaterialCommunityIcons name="eye-off-outline" size={22} color={theme['on-surface-variant'] || '#aaa'} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.deleteModalOptionTitle, { color: theme['on-surface'] || theme.text }]}>Delete for Me</Text>
                  <Text style={[s.deleteModalOptionSub, { color: theme['on-surface-variant'] || '#888' }]}>Only removed from your view</Text>
                </View>
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity
                style={[s.deleteModalCancel, { backgroundColor: (theme['outline-variant'] || '#333') + '30' }]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={[s.deleteModalCancelText, { color: theme['on-surface-variant'] || '#aaa' }]}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* ══ RIGHT CHAT PANEL / WELCOME ══════════════════════════════════ */}
        {showChat && (
          <View style={[
            s.contentPanel,
            s.contentPanelGlass,
            Platform.OS === 'web' && s.contentPanelGlassWeb,
            { backgroundColor: 'transparent' },
          ]}>
            {activeChat ? (
              <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={isDesktop ? 0 : 64}>
                
                {/* Chat Header */}
                <View style={[s.chatHeader, { backgroundColor: (theme['surface-container'] || theme.headerBg || '#1c2333') + 'B3' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    {!isDesktop && (
                      <TouchableOpacity onPress={() => setActiveChat(null)} style={{ marginRight: 4 }}>
                        <Ionicons name="arrow-back" size={24} color={theme['on-surface-variant'] || theme.textSecondary} />
                      </TouchableOpacity>
                    )}
                    <View style={[s.chatHeaderAvatar, { backgroundColor: theme['secondary-container'] || theme.avatarBg }]}>
                      <Text style={[s.chatHeaderAvatarText, { color: theme['on-secondary-container'] || '#fff' }]}>{getInitial(activeChat.username)}</Text>
                    </View>
                    <View>
                      <Text style={[s.chatHeaderName, { color: theme['on-surface'] || theme.text }]}>{activeChat.username}</Text>
                      {onlineUserIds.has(activeChat.userId) ? (
                        <Text style={[s.chatHeaderStatus, { color: theme.tertiary || '#65d9a5' }]}>online</Text>
                      ) : (
                        <Text style={[s.chatHeaderStatus, { color: theme['on-surface-variant'] || '#8b949e' }]}>offline</Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity style={s.iconBtnHover} onPress={handleDeleteChat}>
                    <MaterialCommunityIcons name="delete-outline" size={22} color={theme.error || '#ffb4ab'} />
                  </TouchableOpacity>
                </View>

                {/* Messages List */}
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  keyExtractor={(item) => item._id?.toString()}
                  renderItem={renderMsg}
                  contentContainerStyle={s.msgList}
                  ListHeaderComponent={
                    <View style={s.dateDivider}>
                       <Text style={[s.dateDividerText, { backgroundColor: theme['surface-container'] || '#1c2333', color: theme['on-surface-variant'] || theme.text }]}>TODAY</Text>
                    </View>
                  }
                  ListEmptyComponent={
                    <Text style={[s.emptyText, { color: theme['on-surface-variant'] || theme.textSecondary, marginTop: 60 }]}>
                      {loadingHistory ? 'Loading...' : `Say hello to ${activeChat.username}!`}
                    </Text>
                  }
                />

                <EmojiPicker isVisible={showEmoji} onEmojiSelect={(emoji) => setInputText((prev) => prev + emoji)} theme={{ isDark }} />
                {showStickers && <StickerPicker userId={userId} onSend={handleSendSticker} onClose={() => setShowStickers(false)} theme={theme} navigation={navigation} />}

                {/* Input Bar */}
                <View style={s.inputBarWrapper}>
                   {(pendingImage || pendingAudio) && (
                    <View style={s.previewRow}>
                      <Text style={[s.previewLabel, { color: theme['on-surface-variant'] || theme.textSecondary }]}>
                        {pendingImage ? 'Image attached' : 'Voice message ready'}
                      </Text>
                      <TouchableOpacity onPress={() => { setPendingImage(null); setPendingAudio(null); }}>
                        <Ionicons name="close-circle" size={20} color={theme.error || '#ff4d4d'} />
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  <View style={[s.inputBarBox, { backgroundColor: theme['surface-container-lowest'] || theme.input, borderColor: (theme['outline-variant'] || '#333') + '1A' }]}>
                    
                    {/* Desktop: show all icons inline. Mobile: 3-dot menu */}
                    {isDesktop ? (
                      <View style={s.inputActionsLeft}>
                         <TouchableOpacity style={s.inputIconBtn} onPress={() => { setShowEmoji((v) => !v); setShowStickers(false); }}>
                            <MaterialCommunityIcons name="emoticon-happy" size={24} color={showEmoji ? theme.primary : (theme['on-surface-variant'] || theme.textSecondary)} />
                         </TouchableOpacity>
                         <TouchableOpacity style={s.inputIconBtn} onPress={() => { setShowStickers((v) => !v); setShowEmoji(false); }}>
                            <MaterialCommunityIcons name="sticker-plus" size={24} color={showStickers ? theme.primary : (theme['on-surface-variant'] || theme.textSecondary)} />
                         </TouchableOpacity>
                         <TouchableOpacity style={s.inputIconBtn} onPress={pickImage}>
                            <Ionicons name="image" size={24} color={theme['on-surface-variant'] || theme.textSecondary} />
                         </TouchableOpacity>
                         <TouchableOpacity style={s.inputIconBtn} onPress={isRecording ? stopRecording : startRecording}>
                            <MaterialCommunityIcons name={isRecording ? 'stop-circle' : 'microphone'} size={24} color={isRecording ? (theme.error || '#ff4d4d') : (theme['on-surface-variant'] || theme.textSecondary)} />
                         </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ position: 'relative' }}>
                        <TouchableOpacity style={s.inputIconBtn} onPress={() => setShowAttachMenu((v) => !v)}>
                          <MaterialCommunityIcons name="dots-vertical" size={24} color={theme['on-surface-variant'] || theme.textSecondary} />
                        </TouchableOpacity>
                        {showAttachMenu && (
                          <View style={[s.attachBubble, { backgroundColor: theme['surface-container'] || theme.card, borderColor: (theme['outline-variant'] || '#333') + '40' }]}>
                            <TouchableOpacity style={s.attachBubbleItem} onPress={() => { setShowEmoji((v) => !v); setShowStickers(false); setShowAttachMenu(false); }}>
                              <MaterialCommunityIcons name="emoticon-happy" size={22} color={theme.primary} />
                              <Text style={[s.attachBubbleText, { color: theme['on-surface'] || theme.text }]}>Emoji</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.attachBubbleItem} onPress={() => { setShowStickers((v) => !v); setShowEmoji(false); setShowAttachMenu(false); }}>
                              <MaterialCommunityIcons name="sticker-plus" size={22} color={theme.primary} />
                              <Text style={[s.attachBubbleText, { color: theme['on-surface'] || theme.text }]}>Sticker</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.attachBubbleItem} onPress={pickImage}>
                              <Ionicons name="image" size={22} color={theme.primary} />
                              <Text style={[s.attachBubbleText, { color: theme['on-surface'] || theme.text }]}>Media</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.attachBubbleItem} onPress={() => { isRecording ? stopRecording() : startRecording(); setShowAttachMenu(false); }}>
                              <MaterialCommunityIcons name={isRecording ? 'stop-circle' : 'microphone'} size={22} color={isRecording ? (theme.error || '#ff4d4d') : theme.primary} />
                              <Text style={[s.attachBubbleText, { color: theme['on-surface'] || theme.text }]}>{isRecording ? 'Stop' : 'Audio'}</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}

                    <TextInput
                      style={[s.textInput, { color: theme['on-surface'] || theme.text }, !isDesktop && { minHeight: 48 }]}
                      placeholder={isRecording ? 'Recording...' : uploading ? 'Uploading...' : 'Vibe here...'}
                      placeholderTextColor={theme.outline || theme.textSecondary}
                      value={inputText}
                      onChangeText={setInputText}
                      multiline
                      maxLength={1000}
                      onKeyPress={handleKeyPress}
                      editable={!uploading && !isRecording}
                    />

                    <TouchableOpacity disabled={(!inputText.trim() && !pendingImage && !pendingAudio) || uploading || isRecording} onPress={sendMessage}>
                      <LinearGradient
                         colors={[theme.primary || '#c0c1ff', theme.secondary || '#d0bcff']}
                         start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                         style={[s.sendBtnGrad, ((!inputText.trim() && !pendingImage && !pendingAudio) || uploading || isRecording) && s.sendBtnDisabled]}
                      >
                         {uploading ? <ActivityIndicator size="small" color={theme['on-primary'] || '#fff'} /> : <MaterialCommunityIcons name="send" size={18} color={theme['on-primary'] || '#1000a9'} />}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            ) : (
              /* Welcome Screen */
               <View style={s.welcomeState}>
                  <View style={[s.welcomeBgTop, { backgroundColor: (theme.primary || '#c0c1ff') + '0D' }]} />
                  <View style={[s.welcomeBgBottom, { backgroundColor: (theme.tertiary || '#65d9a5') + '0D' }]} />
                  
                  <View style={s.heroGraphicContainer}>
                     <View style={[s.heroGlow, { backgroundColor: (theme.primary || '#c0c1ff') + '33' }]} />
                     <View style={[s.heroBox, { borderColor: (theme['outline-variant'] || '#333') + '1A', backgroundColor: (theme.surface || '#0b1326') + 'B3' }]}>
                        <MaterialCommunityIcons name="auto-fix" size={64} color={theme.primary || '#c0c1ff'} />
                     </View>
                  </View>

                  <Text style={[s.welcomeTitle, { color: theme['on-surface'] || theme.text }]}>Welcome to the Atmos</Text>
                  <Text style={[s.welcomeSub, { color: theme['on-surface-variant'] || theme.textSecondary }]}>
                     Every vibe starts with a single message. Search for a connection to begin.
                  </Text>

                  {/* Start Conversation - triggers search */}
                  <View style={s.welcomeSearchRow}>
                    <TextInput
                      style={[s.welcomeSearchInput, { backgroundColor: theme['surface-container-lowest'] || theme.input, color: theme['on-surface'] || theme.text, borderColor: (theme['outline-variant'] || '#333') + '40' }]}
                      placeholder="Enter Vibe ID or username..."
                      placeholderTextColor={theme.outline || theme.textSecondary}
                      value={newChatId}
                      onChangeText={setNewChatId}
                      onSubmitEditing={() => startNewChat()}
                      autoCapitalize="none"
                    />
                  </View>
                  <TouchableOpacity style={s.startConvBtn} onPress={() => startNewChat()}>
                     <LinearGradient colors={[theme['primary-container'] || '#5d60eb', theme['secondary-container'] || '#571bc1']} start={{x:0, y:0}} end={{x:1, y:1}} style={s.startConvBtnGrad}>
                        <MaterialCommunityIcons name="message-plus" size={20} color={theme['on-primary-container'] || '#fff'} />
                        <Text style={[s.startConvBtnText, { color: theme['on-primary-container'] || '#fff' }]}>Start New Conversation</Text>
                     </LinearGradient>
                  </TouchableOpacity>
               </View>
            )}
          </View>
        )}
      </View>
      
      {/* Mobile Bottom Nav (only when sidebar is showing) */}
      {!isDesktop && !activeChat && (
        <View style={[s.mobileBottomNav, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)' }]}>
           <View style={[s.mobileNavItemActive, { backgroundColor: (theme.primary || '#c0c1ff') + '33' }]}>
              <MaterialCommunityIcons name="forum" size={22} color={theme.primary} />
              <Text style={[s.mobileNavText, { color: theme.primary }]}>Chats</Text>
           </View>
           <TouchableOpacity style={s.mobileNavItem} onPress={() => console.log('TODO: Me')}>
              <MaterialCommunityIcons name="account-circle" size={22} color={theme['on-surface-variant'] || '#8b949e'} />
              <Text style={[s.mobileNavText, { color: theme['on-surface-variant'] || '#8b949e' }]}>Me</Text>
           </TouchableOpacity>
           <TouchableOpacity style={s.mobileNavItem} onPress={() => setShowSettings(true)}>
              <MaterialCommunityIcons name="cog" size={22} color={theme['on-surface-variant'] || '#8b949e'} />
              <Text style={[s.mobileNavText, { color: theme['on-surface-variant'] || '#8b949e' }]}>Settings</Text>
           </TouchableOpacity>
           <TouchableOpacity style={s.mobileNavItem} onPress={handleLogout}>
              <MaterialCommunityIcons name="logout" size={22} color={theme.error || '#ffb4ab'} />
              <Text style={[s.mobileNavText, { color: theme.error || '#ffb4ab' }]}>Logout</Text>
           </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ── Render helpers ─────────────────────────────────────────────────────────
  function renderConv({ item }) {
    const isActive = activeChat?.userId === item.userId;
    return (
      <TouchableOpacity
        style={[s.convItem, isActive && { backgroundColor: theme.surface === '#0b1326' ? '#1e293b' : (theme['surface-container-high'] || '#2a2d3a') }]}
        onPress={() => openChat(item)}
      >
        <View style={s.convAvatarWrapper}>
           <View style={[s.convAvatar, { backgroundColor: theme['secondary-container'] || '#3b3e8e' }]}>
             <Text style={[s.convAvatarText, { color: theme['on-secondary-container'] || '#fff' }]}>{getInitial(item.username)}</Text>
           </View>
           <View style={[s.convStatusDot, { backgroundColor: onlineUserIds.has(item.userId) ? (theme.tertiary || '#65d9a5') : (theme['outline-variant'] || '#444') }]} />
        </View>
        <View style={s.convInfo}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
             <Text style={[s.convName, { color: isActive ? theme.primary : (theme['on-surface'] || theme.text) }]} numberOfLines={1}>{item.username}</Text>
             <Text style={[s.convTime, { color: isActive ? (theme.primary || '#c0c1ff') + 'B3' : (theme['on-surface-variant'] || '#8b949e') + '80' }]}>{formatTime(item.time)}</Text>
          </View>
          <Text style={[s.convPreview, { color: isActive ? (theme.primary || '#c0c1ff') + 'CC' : (theme['outline'] || '#6b6b6b') }]} numberOfLines={1}>
            {item.lastMessage || 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderMsg({ item: msg }) {
    return (
      <View style={{ flexDirection: msg.senderId?.toString() === userId ? 'row-reverse' : 'row', alignItems: 'flex-end', marginBottom: 8 }}>
        {msg.deletedFor?.includes(userId) ? (
          <Text style={[s.deletedText, { color: theme.outline }]}>Message deleted</Text>
        ) : (
          <MessageBubble 
            item={msg} 
            userId={userId}
            theme={theme}
            currentPlayingUrl={currentPlayingUrl}
            setCurrentPlayingUrl={setCurrentPlayingUrl}
          />
        )}
        {/* Status Indicator for My Messages */}
        {msg.senderId?.toString() === userId && (
          <View style={s.messageStatus}>
            {msg.status === 'sending' && <MaterialCommunityIcons name="clock-outline" size={10} color={theme['on-surface-variant']} />}
            {msg.status === 'sent' && <MaterialCommunityIcons name="check" size={10} color={theme.primary} />}
            {msg.status === 'failed' && <MaterialCommunityIcons name="alert-circle-outline" size={12} color={theme.error} />}
          </View>
        )}
      </View>
    );
  }
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'column', height: '100%', overflow: 'hidden' },

  mainLayout: { flex: 1, flexDirection: 'row' },
  
  // Sidebar
  sidebar: { width: 320, borderRightWidth: 1, flexDirection: 'column' },
  brandHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  brandName: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  connectionDot: { width: 8, height: 8, borderRadius: 4, marginLeft: -2, marginTop: 4 },

  profileContainer: { paddingHorizontal: 20, paddingVertical: 16 },
  profileCard: { padding: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileAvatarWrapper: { position: 'relative' },
  profileAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { fontSize: 20, fontWeight: '700' },
  statusDot: { position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 15, fontWeight: '700' },
  profileVibeId: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  errorText: { fontSize: 10, color: '#ffb4ab', marginTop: 4, paddingHorizontal: 20 },
  
  searchContainer: { paddingHorizontal: 20, marginBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  searchIcon: { position: 'absolute', left: 14, zIndex: 1 },
  searchInput: { flex: 1, borderRadius: 999, paddingVertical: 10, paddingLeft: 40, paddingRight: 14, fontSize: 13 },
  
  convItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginHorizontal: 12, marginBottom: 2 },
  convAvatarWrapper: { position: 'relative', marginRight: 14 },
  convAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  convAvatarText: { fontSize: 16, fontWeight: 'bold' },
  convStatusDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: 'transparent' },
  convInfo: { flex: 1, minWidth: 0 },
  convName: { fontSize: 14, fontWeight: '600' },
  convTime: { fontSize: 10, fontWeight: '500' },
  convPreview: { fontSize: 12, marginTop: 2 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 13, lineHeight: 20 },

  // Bottom card
  bottomCard: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, marginHorizontal: 0 },
  bottomAction: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  bottomActionText: { fontSize: 10, fontWeight: '600' },

  // Settings Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  settingsPanel: { width: 360, maxWidth: '90%', borderRadius: 20, padding: 28 },
  settingsTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  settingsLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  settingsRow: { flexDirection: 'row', alignItems: 'center' },
  settingsInput: { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14, borderWidth: 1 },
  settingsBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  addChatBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  closeSettingsBtn: { marginTop: 24, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },

  // Content panel
  contentPanel: { flex: 1, position: 'relative' },
  
  chatHeader: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, zIndex: 30 },
  chatHeaderAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chatHeaderAvatarText: { fontSize: 14, fontWeight: 'bold' },
  chatHeaderName: { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  chatHeaderStatus: { fontSize: 10, fontWeight: '500' },
  iconBtnHover: { padding: 8, borderRadius: 999 },
  
  msgList: { paddingHorizontal: 24, paddingVertical: 16 },
  dateDivider: { alignItems: 'center', marginVertical: 12 },
  dateDividerText: { fontSize: 10, fontWeight: 'bold', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 999, letterSpacing: 1, overflow: 'hidden' },
  
  // Input bar
  inputBarWrapper: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 8 },
  inputBarBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, borderRadius: 999, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  inputActionsLeft: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  inputIconBtn: { padding: 8 },
  textInput: { flex: 1, fontSize: 14, paddingVertical: 10, paddingHorizontal: 8 },
  sendBtnGrad: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  previewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15,
  },
  previewLabel: { fontSize: 12, fontWeight: '600' },

  // Mobile attach bubble menu
  attachBubble: { position: 'absolute', bottom: 48, left: 0, borderRadius: 16, padding: 8, borderWidth: 1, zIndex: 100, minWidth: 130, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10 },
  attachBubbleItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  attachBubbleText: { fontSize: 13, fontWeight: '500' },
  
  // Welcome
  welcomeState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, position: 'relative', overflow: 'hidden' },
  welcomeBgTop: { position: 'absolute', top: 0, right: 0, width: 500, height: 500, borderRadius: 250, transform: [{ translateY: -250 }, { translateX: 125 }] },
  welcomeBgBottom: { position: 'absolute', bottom: 0, left: 0, width: 400, height: 400, borderRadius: 200, transform: [{ translateY: 133 }, { translateX: -100 }] },
  heroGraphicContainer: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center', marginBottom: 28, position: 'relative' },
  heroGlow: { position: 'absolute', width: '100%', height: '100%', borderRadius: 120 },
  heroBox: { width: 180, height: 180, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '3deg' }] },
  welcomeTitle: { fontSize: 32, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  welcomeSub: { fontSize: 16, textAlign: 'center', maxWidth: 380, marginBottom: 24, lineHeight: 24 },
  welcomeSearchRow: { width: '100%', maxWidth: 360, marginBottom: 16 },
  welcomeSearchInput: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 20, fontSize: 14, borderWidth: 1 },
  startConvBtn: { borderRadius: 999 },
  startConvBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999 },
  startConvBtnText: { fontSize: 14, fontWeight: 'bold' },
  
  // Mobile bottom nav
  mobileBottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 20, paddingTop: 10, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.3, shadowRadius: 30, elevation: 20 },
  mobileNavItem: { alignItems: 'center', justifyContent: 'center', height: 52, width: 60 },
  mobileNavItemActive: { alignItems: 'center', justifyContent: 'center', height: 56, width: 72, borderRadius: 14 },
  mobileNavText: { fontSize: 10, fontWeight: '600', marginTop: 3 },

  // ─── Glass sidebar glow border (right edge accent) ─────────────────────
  sidebarGlowBorder: {
    position: 'absolute', top: 0, bottom: 0, right: 0, width: 1.5,
    opacity: 0.8,
  },

  // ─── Delete Modal ─────────────────────────────────────────────────────
  deleteModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  deleteModal: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 20,
    gap: 12,
  },
  deleteModalWeb: { maxWidth: 480, alignSelf: 'center', width: '100%', borderRadius: 20, marginBottom: 40 },
  deleteModalHandle: { width: 44, height: 4, borderRadius: 999, alignSelf: 'center', marginBottom: 8 },
  deleteModalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  deleteModalSub: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  deleteModalOption: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    padding: 16, borderRadius: 16,
  },
  deleteModalOptionTitle: { fontSize: 15, fontWeight: '700' },
  deleteModalOptionSub: { fontSize: 12, marginTop: 2 },
  deleteModalCancel: {
    alignItems: 'center', paddingVertical: 14, borderRadius: 14, marginTop: 4,
  },
  deleteModalCancelText: { fontSize: 15, fontWeight: '600' },

  // ─── Decorative background orbs ───────────────────────────────────────────
  orb: {
    position: 'absolute',
    borderRadius: 9999,
    // blur is achieved on web via boxShadow spread; on native via opacity
  },
  orbTopRight: {
    width: 520, height: 520,
    top: -180, right: -180,
  },
  orbBottomLeft: {
    width: 480, height: 480,
    bottom: -160, left: -160,
  },
  orbCenterRight: {
    width: 360, height: 360,
    top: '35%', right: -120,
  },
  orbTopLeft: {
    width: 240, height: 240,
    top: -80, left: -80,
  },

  // ─── Glass sidebar ────────────────────────────────────────────────────────
  sidebarGlass: {
    borderRightWidth: 1,
    // Semi-transparent base for native; web overrides with backdrop-filter
    backgroundColor: 'rgba(11,19,38,0.72)',
  },
  sidebarGlassWeb: {
    // @ts-ignore — web-only CSS-in-JS property
    backdropFilter: 'blur(24px) saturate(160%)',
    WebkitBackdropFilter: 'blur(24px) saturate(160%)',
    backgroundColor: 'rgba(11,19,38,0.65)',
  },

  // ─── Glass content panel ─────────────────────────────────────────────────
  contentPanelGlass: {
    flex: 1,
    position: 'relative',
    backgroundColor: 'rgba(8,14,30,0.55)',
  },
  contentPanelGlassWeb: {
    backdropFilter: 'blur(32px) saturate(140%)',
    WebkitBackdropFilter: 'blur(32px) saturate(140%)',
    backgroundColor: 'rgba(8,14,30,0.42)',
  },
});

