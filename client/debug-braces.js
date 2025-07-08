import fs from 'fs';

const content = fs.readFileSync('/Users/craigcampbell/Projects/schedulist/client/src/pages/bcba/SchedulePage.jsx', 'utf8');
const lines = content.split('\n');

let braceStack = [];
let parenStack = [];

lines.forEach((line, index) => {
  const lineNum = index + 1;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const context = line.substring(Math.max(0, i - 10), i + 10);
    
    if (char === '{') {
      braceStack.push({ line: lineNum, col: i + 1, context });
    } else if (char === '}') {
      if (braceStack.length === 0) {
        console.log(`❌ Extra closing brace at line ${lineNum}, col ${i + 1}: ${context}`);
      } else {
        braceStack.pop();
      }
    } else if (char === '(') {
      parenStack.push({ line: lineNum, col: i + 1 });
    } else if (char === ')') {
      if (parenStack.length === 0) {
        console.log(`❌ Extra closing paren at line ${lineNum}, col ${i + 1}`);
      } else {
        parenStack.pop();
      }
    }
  }
});

console.log(`\n📊 Analysis complete:`);
console.log(`Unclosed braces: ${braceStack.length}`);
console.log(`Unclosed parens: ${parenStack.length}`);

if (braceStack.length > 0) {
  console.log(`\n🔍 Unclosed braces:`);
  braceStack.forEach((brace, index) => {
    console.log(`${index + 1}. Line ${brace.line}, col ${brace.col}: ${brace.context}`);
  });
}

if (parenStack.length > 0) {
  console.log(`\n🔍 Unclosed parens:`);
  parenStack.slice(-5).forEach((paren, index) => {
    console.log(`${parenStack.length - 5 + index + 1}. Line ${paren.line}, col ${paren.col}`);
  });
}