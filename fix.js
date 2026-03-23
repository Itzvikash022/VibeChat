const fs = require('fs');
const file = 'd:/Projects/VibeChat/frontend/screens/MainScreen.js';
let content = fs.readFileSync(file, 'utf8');

const target1 = `const uploadToCloudinary = async (localUri, resourceType = 'image') => {
  const formData = new FormData();
  const ext = localUri.split('.').pop();
  formData.append('file', {
    uri: localUri,
    type: resourceType === 'video' ? \`video/\${ext}\` : (resourceType === 'raw' ? 'audio/m4a' : \`image/\${ext}\`),
    name: \`upload.\${ext}\`,
  });
  formData.append('upload_preset', 'vibechat_unsigned');
  const res = await fetch(\`https://api.cloudinary.com/v1_1/drfptsgim/\${resourceType}/upload\`, { method: 'POST', body: formData });
  const data = await res.json();
  return data.secure_url;
};`;

const target1CRLF = target1.replace(/\n/g, '\r\n');

const replace1 = `const uploadToCloudinary = async (localUri, resourceType = 'image') => {
  const formData = new FormData();
  const ext = localUri.split('.').pop();
  if (Platform.OS === 'web') {
    const resp = await fetch(localUri);
    const blob = await resp.blob();
    formData.append('file', blob, \`upload.\${ext}\`);
  } else {
    let type = resourceType === 'video' ? \`video/\${ext}\` : (resourceType === 'raw' ? 'audio/m4a' : \`image/\${ext}\`);
    formData.append('file', {
      uri: Platform.OS === 'android' ? localUri : localUri.replace('file://', ''),
      name: \`upload.\${ext}\`,
      type,
    });
  }

  const { data } = await api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data?.data?.url || data?.url;
};`;

let t2 = `<FlatList
                  ref={flatListRef}
                  data={messages}`;

let t2CRLF = t2.replace(/\n/g, '\r\n');

let r2 = `<FlatList
                  ref={flatListRef}
                  onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                  onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                  data={messages}`;

if(content.includes(target1)) content = content.replace(target1, replace1);
else if (content.includes(target1CRLF)) content = content.replace(target1CRLF, replace1);
else console.log('Target 1 not found');

if(content.includes(t2)) content = content.replace(t2, r2);
else if (content.includes(t2CRLF)) content = content.replace(t2CRLF, r2);
else console.log('Target 2 not found');

fs.writeFileSync(file, content);
console.log('Done');
