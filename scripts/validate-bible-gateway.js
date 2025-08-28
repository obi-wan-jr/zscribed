#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bible book mappings for BibleGateway
const BIBLE_BOOKS = {
  'Genesis': 'genesis',
  'Exodus': 'exodus', 
  'Leviticus': 'leviticus',
  'Numbers': 'numbers',
  'Deuteronomy': 'deuteronomy',
  'Joshua': 'joshua',
  'Judges': 'judges',
  'Ruth': 'ruth',
  '1 Samuel': '1-samuel',
  '2 Samuel': '2-samuel',
  '1 Kings': '1-kings',
  '2 Kings': '2-kings',
  '1 Chronicles': '1-chronicles',
  '2 Chronicles': '2-chronicles',
  'Ezra': 'ezra',
  'Nehemiah': 'nehemiah',
  'Esther': 'esther',
  'Job': 'job',
  'Psalms': 'psalms',
  'Proverbs': 'proverbs',
  'Ecclesiastes': 'ecclesiastes',
  'Song of Solomon': 'song-of-solomon',
  'Isaiah': 'isaiah',
  'Jeremiah': 'jeremiah',
  'Lamentations': 'lamentations',
  'Ezekiel': 'ezekiel',
  'Daniel': 'daniel',
  'Hosea': 'hosea',
  'Joel': 'joel',
  'Amos': 'amos',
  'Obadiah': 'obadiah',
  'Jonah': 'jonah',
  'Micah': 'micah',
  'Nahum': 'nahum',
  'Habakkuk': 'habakkuk',
  'Zephaniah': 'zephaniah',
  'Haggai': 'haggai',
  'Zechariah': 'zechariah',
  'Malachi': 'malachi',
  'Matthew': 'matthew',
  'Mark': 'mark',
  'Luke': 'luke',
  'John': 'john',
  'Acts': 'acts',
  'Romans': 'romans',
  '1 Corinthians': '1-corinthians',
  '2 Corinthians': '2-corinthians',
  'Galatians': 'galatians',
  'Ephesians': 'ephesians',
  'Philippians': 'philippians',
  'Colossians': 'colossians',
  '1 Thessalonians': '1-thessalonians',
  '2 Thessalonians': '2-thessalonians',
  '1 Timothy': '1-timothy',
  '2 Timothy': '2-timothy',
  'Titus': 'titus',
  'Philemon': 'philemon',
  'Hebrews': 'hebrews',
  'James': 'james',
  '1 Peter': '1-peter',
  '2 Peter': '2-peter',
  '1 John': '1-john',
  '2 John': '2-john',
  '3 John': '3-john',
  'Jude': 'jude',
  'Revelation': 'revelation'
};

// Chapter counts for validation
const CHAPTER_COUNTS = {
  'Genesis': 50, 'Exodus': 40, 'Leviticus': 27, 'Numbers': 36, 'Deuteronomy': 34,
  'Joshua': 24, 'Judges': 21, 'Ruth': 4, '1 Samuel': 31, '2 Samuel': 24,
  '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
  'Ezra': 10, 'Nehemiah': 13, 'Esther': 10, 'Job': 42, 'Psalms': 150,
  'Proverbs': 31, 'Ecclesiastes': 12, 'Song of Solomon': 8, 'Isaiah': 66,
  'Jeremiah': 52, 'Lamentations': 5, 'Ezekiel': 48, 'Daniel': 12,
  'Hosea': 14, 'Joel': 3, 'Amos': 9, 'Obadiah': 1, 'Jonah': 4, 'Micah': 7,
  'Nahum': 3, 'Habakkuk': 3, 'Zephaniah': 3, 'Haggai': 2, 'Zechariah': 14, 'Malachi': 4,
  'Matthew': 28, 'Mark': 16, 'Luke': 24, 'John': 21, 'Acts': 28,
  'Romans': 16, '1 Corinthians': 16, '2 Corinthians': 13, 'Galatians': 6,
  'Ephesians': 6, 'Philippians': 4, 'Colossians': 4, '1 Thessalonians': 5,
  '2 Thessalonians': 3, '1 Timothy': 6, '2 Timothy': 4, 'Titus': 3,
  'Philemon': 1, 'Hebrews': 13, 'James': 5, '1 Peter': 5, '2 Peter': 3,
  '1 John': 5, '2 John': 1, '3 John': 1, 'Jude': 1, 'Revelation': 22
};

// Get all available local bible files
function getLocalBibleFiles() {
  const bibleDir = path.join(__dirname, '..', 'data', 'bible', 'web');
  const files = fs.readdirSync(bibleDir).filter(f => f.endsWith('.json'));
  
  return files.map(file => {
    const match = file.match(/^(.+)-(\d+)\.json$/);
    if (match) {
      // Convert filename to proper book name
      const filename = match[1];
      let book = filename.replace(/-/g, ' ');
      
      // Handle special cases for book names
      const bookMappings = {
        '1-samuel': '1 Samuel',
        '2-samuel': '2 Samuel', 
        '1-kings': '1 Kings',
        '2-kings': '2 Kings',
        '1-chronicles': '1 Chronicles',
        '2-chronicles': '2 Chronicles',
        '1-corinthians': '1 Corinthians',
        '2-corinthians': '2 Corinthians',
        '1-thessalonians': '1 Thessalonians',
        '2-thessalonians': '2 Thessalonians',
        '1-timothy': '1 Timothy',
        '2-timothy': '2 Timothy',
        '1-peter': '1 Peter',
        '2-peter': '2 Peter',
        '1-john': '1 John',
        '2-john': '2 John',
        '3-john': '3 John',
        'song-of-solomon': 'Song of Solomon'
      };
      
      if (bookMappings[filename]) {
        book = bookMappings[filename];
      } else {
        // Capitalize first letter of each word
        book = book.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      }
      
      return {
        file,
        book,
        chapter: parseInt(match[2]),
        path: path.join(bibleDir, file)
      };
    }
    return null;
  }).filter(Boolean);
}

// Load local bible data
function loadLocalBibleData(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data;
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    return null;
  }
}

// Extract BibleGateway data from JavaScript object
function extractBibleGatewayData(html) {
  try {
    // Look for the BG.appData JavaScript object
    const appDataMatch = html.match(/BG\.appData\(({[\s\S]*?})\);/);
    if (!appDataMatch) {
      throw new Error('Could not find BG.appData in HTML');
    }
    
    const appDataStr = appDataMatch[1];
    const appData = JSON.parse(appDataStr);
    
    // Extract books data
    const books = appData.books?.WEB;
    if (!books) {
      throw new Error('Could not find WEB translation books data');
    }
    
    return books;
  } catch (error) {
    console.error('Error extracting BibleGateway data:', error.message);
    return null;
  }
}

// Fetch verse from BibleGateway using the JavaScript data
async function fetchBibleGatewayVerse(book, chapter, verse) {
  try {
    const bookSlug = BIBLE_BOOKS[book];
    if (!bookSlug) {
      throw new Error(`Unknown book: ${book}`);
    }

    // BibleGateway URL for WEB translation
    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(book)}+${chapter}%3A${verse}&version=WEB`;
    
    console.log(`Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    
    // Extract the JavaScript data
    const booksData = extractBibleGatewayData(html);
    if (!booksData) {
      throw new Error('Failed to extract BibleGateway data');
    }
    
    // Find the specific book
    const bookData = booksData.find(b => b.display === book);
    if (!bookData || !bookData.chapters) {
      throw new Error(`Book ${book} not found or no chapters data`);
    }
    
    // Find the specific chapter
    const chapterData = bookData.chapters.find(c => c.chapter === chapter);
    if (!chapterData || !chapterData.content) {
      throw new Error(`Chapter ${chapter} not found in ${book}`);
    }
    
    // For single verse requests, we need to get the full chapter and extract the verse
    // BibleGateway provides chapter content, so we need to parse it
    const chapterContent = chapterData.content.join(' ');
    
    // Try to extract the specific verse from the chapter content
    // This is a simplified approach - we'll get the full chapter text
    return chapterContent;
    
  } catch (error) {
    console.error(`Error fetching from BibleGateway: ${error.message}`);
    return null;
  }
}

// Clean text for comparison
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.,!?;:'"()-]/g, '')
    .trim()
    .toLowerCase();
}

// Compare local vs BibleGateway
async function compareVerse(localData, book, chapter, verse) {
  const localVerse = localData.verses.find(v => v.verse === verse);
  if (!localVerse) {
    return { error: `Verse ${verse} not found in local data` };
  }

  const bibleGatewayText = await fetchBibleGatewayVerse(book, chapter, verse);
  if (!bibleGatewayText) {
    return { error: `Failed to fetch from BibleGateway` };
  }

  const localClean = cleanText(localVerse.text);
  const gatewayClean = cleanText(bibleGatewayText);

  const isMatch = localClean === gatewayClean;
  
  return {
    book,
    chapter,
    verse,
    local: localVerse.text,
    bibleGateway: bibleGatewayText,
    localClean,
    gatewayClean,
    isMatch,
    similarity: calculateSimilarity(localClean, gatewayClean)
  };
}

// Calculate text similarity percentage
function calculateSimilarity(text1, text2) {
  if (text1 === text2) return 100;
  
  const words1 = text1.split(' ');
  const words2 = text2.split(' ');
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = Math.max(words1.length, words2.length);
  
  return Math.round((commonWords.length / totalWords) * 100);
}

// Main validation function
async function validateBibleData(sampleSize = 10) {
  console.log('🔍 Starting Bible Gateway validation...\n');
  
  const localFiles = getLocalBibleFiles();
  console.log(`📚 Found ${localFiles.length} local bible files\n`);
  
  if (localFiles.length === 0) {
    console.error('❌ No local bible files found');
    return;
  }

  const results = [];
  const errors = [];
  
  // Sample random files for validation
  const samples = localFiles
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize);

  console.log(`🎯 Validating ${samples.length} random chapters...\n`);

  for (const sample of samples) {
    console.log(`📖 Validating ${sample.book} ${sample.chapter}...`);
    
    const localData = loadLocalBibleData(sample.path);
    if (!localData) {
      errors.push({ file: sample.file, error: 'Failed to load local data' });
      continue;
    }

    // Validate a few random verses from this chapter
    const verses = localData.verses;
    const verseSamples = verses
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(3, verses.length));

    for (const verseData of verseSamples) {
      console.log(`  Verse ${verseData.verse}...`);
      
      const comparison = await compareVerse(localData, sample.book, sample.chapter, verseData.verse);
      
      if (comparison.error) {
        errors.push({
          file: sample.file,
          book: sample.book,
          chapter: sample.chapter,
          verse: verseData.verse,
          error: comparison.error
        });
      } else {
        results.push(comparison);
      }
      
      // Rate limiting - be respectful to BibleGateway
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('');
  }

  // Generate report
  console.log('📊 Validation Results:\n');
  
  const matches = results.filter(r => r.isMatch);
  const mismatches = results.filter(r => !r.isMatch);
  
  console.log(`✅ Exact matches: ${matches.length}/${results.length} (${Math.round(matches.length/results.length*100)}%)`);
  console.log(`❌ Mismatches: ${mismatches.length}/${results.length} (${Math.round(mismatches.length/results.length*100)}%)`);
  console.log(`⚠️  Errors: ${errors.length}`);
  
  if (mismatches.length > 0) {
    console.log('\n🔍 Mismatch Details:');
    mismatches.forEach(m => {
      console.log(`\n${m.book} ${m.chapter}:${m.verse}`);
      console.log(`Local: "${m.local}"`);
      console.log(`BibleGateway: "${m.bibleGateway}"`);
      console.log(`Similarity: ${m.similarity}%`);
    });
  }
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(e => {
      console.log(`- ${e.file || `${e.book} ${e.chapter}:${e.verse}`}: ${e.error}`);
    });
  }

  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalSamples: results.length + errors.length,
      exactMatches: matches.length,
      mismatches: mismatches.length,
      errors: errors.length,
      matchPercentage: Math.round(matches.length/results.length*100)
    },
    results,
    errors
  };

  const reportFile = `bible-gateway-validation-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportFile}`);

  return report;
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const sampleSize = parseInt(process.argv[2]) || 10;
  
  validateBibleData(sampleSize)
    .then(() => {
      console.log('\n✅ Validation complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Validation failed:', error);
      process.exit(1);
    });
}

export { validateBibleData, compareVerse, fetchBibleGatewayVerse };
