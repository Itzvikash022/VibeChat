const fs = require('fs');

function patchMainScreen() {
  const file = 'd:/Projects/VibeChat/frontend/screens/MainScreen.js';
  let content = fs.readFileSync(file, 'utf8');

  // Add index to renderMsg
  let target1 = `function renderMsg({ item: msg }) {`;
  let replace1 = `function renderMsg({ item: msg, index }) {\n    const isLastMessage = index === messages.length - 1;`;
  
  // Pass isLastMessage to MessageBubble
  let target2 = `<MessageBubble 
            item={msg} 
            userId={userId}
            theme={theme}
            currentPlayingUrl={currentPlayingUrl}
            setCurrentPlayingUrl={setCurrentPlayingUrl}
          />`;
  let replace2 = `<MessageBubble 
            item={msg} 
            userId={userId}
            theme={theme}
            isLastMessage={isLastMessage}
            currentPlayingUrl={currentPlayingUrl}
            setCurrentPlayingUrl={setCurrentPlayingUrl}
          />`;

  content = content.replace(target1, replace1).replace(target2, replace2);
  fs.writeFileSync(file, content);
  console.log('MainScreen.js patched');
}

function patchMessageBubble() {
  const file = 'd:/Projects/VibeChat/frontend/components/MessageBubble.js';
  let content = fs.readFileSync(file, 'utf8');

  // Add AsyncStorage import
  if (!content.includes('AsyncStorage')) {
    content = content.replace(
      `import { Audio } from 'expo-av';`, 
      `import { Audio } from 'expo-av';\nimport AsyncStorage from '@react-native-async-storage/async-storage';`
    );
  }

  // Update MessageBubble signature
  content = content.replace(
    `const MessageBubble = ({ item, userId, theme, currentPlayingUrl, setCurrentPlayingUrl }) => {`,
    `const MessageBubble = ({ item, userId, theme, currentPlayingUrl, setCurrentPlayingUrl, isLastMessage }) => {`
  );

  // Pass id and isLastMessage to StickerContent
  let stickerContentTarget = `<StickerContent 
            url={media || content} audioUrl={audio} isMe={isMe} theme={theme}
            currentPlayingUrl={currentPlayingUrl} setCurrentPlayingUrl={setCurrentPlayingUrl}
          />`;
  let stickerContentReplace = `<StickerContent 
            id={item._id}
            url={media || content} audioUrl={audio} isMe={isMe} theme={theme}
            currentPlayingUrl={currentPlayingUrl} setCurrentPlayingUrl={setCurrentPlayingUrl}
            isLastMessage={isLastMessage}
          />`;
  // The indentation might differ, let's just do a regex
  content = content.replace(
    /<StickerContent[\s\S]*?\/>/,
    `<StickerContent 
            id={item._id}
            url={media || content} audioUrl={audio} isMe={isMe} theme={theme}
            currentPlayingUrl={currentPlayingUrl} setCurrentPlayingUrl={setCurrentPlayingUrl}
            isLastMessage={isLastMessage}
          />`
  );

  // Update StickerContent signature
  content = content.replace(
    `const StickerContent = ({ url, audioUrl, isMe, theme, currentPlayingUrl, setCurrentPlayingUrl }) => {`,
    `const StickerContent = ({ id, url, audioUrl, isMe, theme, currentPlayingUrl, setCurrentPlayingUrl, isLastMessage }) => {`
  );

  // Update StickerContent useEffect
  let effectTarget = `  useEffect(() => {
    if (audioUrl && !isMe && !isAutoplayed.current) {
      isAutoplayed.current = true;
      setTimeout(play, 500);
    }
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [audioUrl, isMe]);`;

  let effectReplace = `  useEffect(() => {
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
      if (soundRef.current) soundRef.current.unloadAsync();
    };
  }, [audioUrl, isMe, id, isLastMessage]);`;

  // Fix line endings in target
  let effectTargetCRLF = effectTarget.replace(/\n/g, '\r\n');
  if (content.includes(effectTarget)) content = content.replace(effectTarget, effectReplace);
  else if (content.includes(effectTargetCRLF)) content = content.replace(effectTargetCRLF, effectReplace);
  else {
    // try a more generic replace if formatting is slightly off
    content = content.replace(/  useEffect\(\(\) => \{\s*if \(audioUrl && !isMe[\s\S]*?\}, \[audioUrl, isMe\]\);/, effectReplace);
  }

  fs.writeFileSync(file, content);
  console.log('MessageBubble.js patched');
}

patchMainScreen();
patchMessageBubble();
