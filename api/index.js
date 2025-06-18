const fs = require('fs');
const path = require('path');

const express = require("express");
const cors = require("cors");
const app = express();

// Load and adapt the tokenizer logic from js/tokenizer.js
// For simplicity, we will inline the necessary tokenizer logic here.
// In production, consider refactoring to share code between client and server.

// --- Begin tokenizer logic (adapted for Node.js) ---
let thaiWords = {};
let wordTree = {};
let compoundWords = {};

function readDictionary(words) {
  if (!Array.isArray(words)) {
    words = words.split("\n");
  }
  for (let i in words) {
    let word = words[i];
    if (word.length > 0) {
      if (word.search(/,/) >= 0) {
        let compoundWord = word.split(':');
        word = compoundWord[0];
        compoundWords[word] = compoundWord[1].split(',');
      }
      thaiWords[word] = true;
      generateWordTree(word);
    }
  }
}

function generateWordTree(word) {
  let path = wordTree;
  for (let i in word) {
    let c = word[i];
    if (!path[c]) {
      path[c] = {};
    }
    path = path[c];
  }
}

function queryWordTree(word) {
  let isFound = true;
  let path = wordTree;
  for (let i in word) {
    let c = word[i];
    if (!path[c]) {
      isFound = false;
      break;
    }
    path = path[c];
  }
  return isFound;
}

function convertLowerCase(string) {
  return string.toLowerCase();
}

function filterSymbols(data) {
  data = data.replace(/(\n)/g, '');
  data = data.replace(/[^a-z 0-9 ก-๙]/gi, ' ');
  return data;
}

function breakThaiWords(string) {
  let words = [];
  let i = 0;
  while (i < string.length) {
    let longestWord = '';
    let longestWordEnd = i;
    // Try to find the longest word starting at position i
    for (let j = i + 1; j <= string.length; j++) {
      let substr = string.slice(i, j);
      if (thaiWords[substr]) {
        longestWord = substr;
        longestWordEnd = j;
      }
    }
    if (longestWord) {
      // If it's a compound word, break it further
      if (compoundWords[longestWord]) {
        let brokenWords = compoundWords[longestWord];
        for (let k = 0; k < brokenWords.length; k++) {
          words.push(brokenWords[k]);
        }
      } else {
        words.push(longestWord);
      }
      i = longestWordEnd;
    } else {
      // If no word found, treat single character as unknown
      words.push(string[i]);
      i++;
    }
  }
  return words;
}

function tokenize(string) {
  string = filterSymbols(string);
  string = convertLowerCase(string);
  let workingArray = string.split(" ");
  let resultArray = [];
  for (let i in workingArray) {
    let string = workingArray[i];
    if (string.search(/[ก-๙]/) >= 0) {
      let thaiTokens = breakThaiWords(string);
      for (let j in thaiTokens) {
        string = thaiTokens[j];
        if (string.length > 0) {
          resultArray.push(string);
        }
      }
    } else {
      if (string.length > 0) {
        resultArray.push(string);
      }
    }
  }
  return resultArray;
}
// --- End tokenizer logic ---

function loadDictionaries() {
  const dataDir = path.join(process.cwd(), 'data');
  const dictionaryFiles = [
    'tdict-city.txt',
    'tdict-collection.txt',
    'tdict-common.txt',
    'tdict-country.txt',
    'tdict-district.txt',
    'tdict-geo.txt',
    'tdict-history.txt',
    'tdict-ict.txt',
    'tdict-lang-ethnic.txt',
    'tdict-proper.txt',
    'tdict-science.txt',
    'tdict-spell.txt',
    'tdict-std-compound.txt',
    'tdict-std.txt',
    'compound-words.txt',
  ];
  dictionaryFiles.forEach(file => {
    const filePath = path.join(dataDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      readDictionary(content);
    } else {
      console.log("File not found: ", filePath);
    }
  });
}
// Enable CORS for all routes
app.use(cors());

app.get("/tokenize", async (req, res) => {

  loadDictionaries();
  console.log("Dictionaries with total words: ", Object.keys(thaiWords).length);

  const text = req.query.text;
  if (typeof text !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "text" query parameter' });
    return;
  }
  console.log("Tokenizing text: ", text);

  // Split text by newlines, tokenize each line, and preserve newlines in segmented output
  const lines = text.split(/\r?\n/);
  const words = lines.map(line => tokenize(line));
  const segmented = words.map(lineWords => lineWords.join(' ')).join('\n');

  // Check for mismatch: remove spaces and compare
  const filteredInput = filterSymbols(text).replace(/\s+/g, '');
  const joinedTokens = words.map(lineWords => lineWords.join('')).join('');
  const mismatch = filteredInput !== joinedTokens;

  res.status(200).json({
    words: words,
    segmented: segmented,
    text: text,
    ...(mismatch ? { mismatch: true } : {})
  });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
