const fs = require('fs');
const file = 'd:/Projects/VibeChat/frontend/screens/MainScreen.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/<MessageBubble=\{userId\}/g, `<MessageBubble 
            item={msg} 
            userId={userId}`);

fs.writeFileSync(file, content);
console.log('Fixed MessageBubble corrupted tag completely');
