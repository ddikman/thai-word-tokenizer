const fs = require('fs');
const path = require('path');

// --- Begin tokenizer logic (copied from index.js) ---
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
    }
  });
}

// 20 Thai phrases and their expected segmentations
const testCases = [
  // Greetings
  { input: 'สวัสดีครับ', expected: ['สวัสดี', 'ครับ'] },
  { input: 'สวัสดีค่ะ', expected: ['สวัสดี', 'ค่ะ'] },
  { input: 'สบายดีไหม', expected: ['สบายดี', 'ไหม'] },
  { input: 'ขอบคุณมาก', expected: ['ขอบคุณ', 'มาก'] },
  { input: 'ยินดีต้อนรับ', expected: ['ยินดี', 'ต้อนรับ'] },
  // Questions
  { input: 'คุณชื่ออะไร', expected: ['คุณ', 'ชื่อ', 'อะไร'] },
  { input: 'ไปที่ไหน', expected: ['ไป', 'ที่ไหน'] },
  { input: 'ราคาเท่าไหร่', expected: ['ราคา', 'เท่าไหร่'] },
  { input: 'วันนี้วันอะไร', expected: ['วันนี้', 'วัน', 'อะไร'] },
  { input: 'คุณพูดภาษาอังกฤษได้ไหม', expected: ['คุณ', 'พูด', 'ภาษา', 'อังกฤษ', 'ได้', 'ไหม'] },
  // Common sentences
  { input: 'ฉันหิวข้าว', expected: ['ฉัน', 'หิว', 'ข้าว'] },
  { input: 'ผมมาจากกรุงเทพ', expected: ['ผม', 'มา', 'จาก', 'กรุงเทพ'] },
  { input: 'เธอสวยมาก', expected: ['เธอ', 'สวย', 'มาก'] }, // This one fails, I can't get it to work
  { input: 'อากาศร้อนจัง', expected: ['อากาศ', 'ร้อน', 'จัง'] },
  { input: 'ขอโทษครับ', expected: ['ขอโทษ', 'ครับ'] },
  // With numbers or English
  { input: 'ฉันอายุ 25 ปี', expected: ['ฉัน', 'อายุ', '25', 'ปี'] },
  { input: 'เบอร์โทรศัพท์ของคุณคืออะไร', expected: ['เบอร์', 'โทรศัพท์', 'ของ', 'คุณ', 'คือ', 'อะไร'] },
  { input: 'ไป centralworld กันไหม', expected: ['ไป', 'centralworld', 'กัน', 'ไหม'] },
  { input: 'วันนี้ฝนตกหนัก', expected: ['วันนี้', 'ฝน', 'ตก', 'หนัก'] },
  { input: 'ฉันชอบกินไอศกรีม', expected: ['ฉัน', 'ชอบ', 'กิน', 'ไอศกรีม'] },
];

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function runTests() {
  loadDictionaries();
  let passed = 0;
  let failed = 0;
  testCases.forEach(({ input, expected }, idx) => {
    const actual = tokenize(input);
    const ok = arraysEqual(actual, expected);
    if (ok) {
      console.log(`✅ [${idx + 1}] PASS: '${input}' => [${actual.join(', ')}]`);
      passed++;
    } else {
      console.log(`❌ [${idx + 1}] FAIL: '${input}'`);
      console.log(`   Expected: [${expected.join(', ')}]`);
      console.log(`   Actual:   [${actual.join(', ')}]`);
      failed++;
    }
  });
  console.log(`\nSummary: ${passed} passed, ${failed} failed, ${testCases.length} total.`);
}

runTests();