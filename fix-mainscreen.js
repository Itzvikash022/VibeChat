const fs = require('fs');
const file = 'd:/Projects/VibeChat/frontend/screens/MainScreen.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/<MessageBubbleuserId=\{userId\}/g, '<MessageBubble \n            item={msg} \n            userId={userId}');

fs.writeFileSync(file, content);
console.log('Fixed MainScreen tag');
