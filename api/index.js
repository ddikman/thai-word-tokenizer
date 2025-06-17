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
  let index = 0;
  let currentWord = '';
  let spareWord = '';
  let badWord = '';
  let nextWordAble = false;
  for (let i in string) {
    let c = string[i];
    let checkWord = currentWord + c;
    if (queryWordTree(checkWord)) {
      currentWord = checkWord;
      if (thaiWords[currentWord]) {
        if (badWord != '') {
          words[index] = badWord.substring(0, badWord.length - 1);
          badWord = '';
          index++;
        }
        if (compoundWords[checkWord]) {
          let brokenWords = compoundWords[checkWord];
          for (let j in brokenWords) {
            words[index++] = brokenWords[j];
          }
          index--;
        } else {
          words[index] = checkWord;
        }
        spareWord = '';
      } else {
        spareWord += c;
      }
      nextWordAble = true;
    } else {
      if (nextWordAble) {
        nextWordAble = false;
        currentWord = spareWord + c;
        spareWord = c;
        index++;
      } else {
        if (badWord == '') {
          badWord = currentWord + c;
        } else {
          badWord += c;
        }
        currentWord = c;
      }
    }
  }
  if (badWord != '') {
    words[index] = badWord;
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

// Load dictionary files (synchronously for simplicity)
const dataDir = path.join(__dirname, '../data');
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

// Enable CORS for all routes
app.use(cors());

app.get("/tokenize", async (req, res) => {
  const text = req.query.text;
  if (typeof text !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "text" query parameter' });
    return;
  }
  console.log("Tokenizing text: ", text);
  const result = tokenize(text);
  res.status(200).json({ segmented: result, text: text });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
