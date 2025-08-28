#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Expected chapter counts for validation
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

// Validate verse structure
function validateVerseStructure(verse, book, chapter) {
  const errors = [];
  
  // Check required fields
  if (!verse.book_id) errors.push('Missing book_id');
  if (!verse.book_name) errors.push('Missing book_name');
  if (!verse.chapter) errors.push('Missing chapter');
  if (!verse.verse) errors.push('Missing verse');
  if (!verse.text) errors.push('Missing text');
  
  // Check data consistency
  if (verse.book_name !== book) {
    errors.push(`Book name mismatch: expected "${book}", got "${verse.book_name}"`);
  }
  
  if (verse.chapter !== chapter) {
    errors.push(`Chapter mismatch: expected ${chapter}, got ${verse.chapter}`);
  }
  
  if (typeof verse.verse !== 'number' || verse.verse < 1) {
    errors.push(`Invalid verse number: ${verse.verse}`);
  }
  
  if (typeof verse.text !== 'string' || verse.text.trim().length === 0) {
    errors.push('Empty or invalid text');
  }
  
  return errors;
}

// Validate chapter structure
function validateChapterStructure(data, book, chapter) {
  const errors = [];
  
  // Check required fields
  if (!data.reference) errors.push('Missing reference');
  if (!data.verses || !Array.isArray(data.verses)) {
    errors.push('Missing or invalid verses array');
    return errors;
  }
  
  // Check reference format
  const expectedReference = `${book} ${chapter}`;
  if (data.reference !== expectedReference) {
    errors.push(`Reference mismatch: expected "${expectedReference}", got "${data.reference}"`);
  }
  
  // Check verses array
  if (data.verses.length === 0) {
    errors.push('Empty verses array');
    return errors;
  }
  
  // Validate each verse
  const verseErrors = [];
  const verseNumbers = new Set();
  
  for (let i = 0; i < data.verses.length; i++) {
    const verse = data.verses[i];
    const verseValidationErrors = validateVerseStructure(verse, book, chapter);
    
    if (verseValidationErrors.length > 0) {
      verseErrors.push(`Verse ${i + 1}: ${verseValidationErrors.join(', ')}`);
    }
    
    // Check for duplicate verse numbers
    if (verseNumbers.has(verse.verse)) {
      verseErrors.push(`Duplicate verse number: ${verse.verse}`);
    } else {
      verseNumbers.add(verse.verse);
    }
  }
  
  if (verseErrors.length > 0) {
    errors.push(`Verse validation errors: ${verseErrors.join('; ')}`);
  }
  
  // Check verse number sequence
  const sortedVerses = [...data.verses].sort((a, b) => a.verse - b.verse);
  for (let i = 0; i < sortedVerses.length; i++) {
    if (sortedVerses[i].verse !== i + 1) {
      errors.push(`Non-sequential verse numbers: expected ${i + 1}, got ${sortedVerses[i].verse}`);
    }
  }
  
  return errors;
}

// Analyze text quality
function analyzeTextQuality(text) {
  const analysis = {
    length: text.length,
    wordCount: text.split(/\s+/).length,
    hasPunctuation: /[.,!?;:]/.test(text),
    hasQuotes: /["'""]/.test(text),
    hasParentheses: /[()]/.test(text),
    hasNumbers: /\d/.test(text),
    hasSpecialChars: /[^\w\s.,!?;:'"()-]/.test(text),
    issues: []
  };
  
  // Check for potential issues
  if (text.length < 10) {
    analysis.issues.push('Very short text');
  }
  
  if (text.length > 1000) {
    analysis.issues.push('Very long text');
  }
  
  if (!analysis.hasPunctuation) {
    analysis.issues.push('No punctuation');
  }
  
  if (analysis.hasSpecialChars) {
    analysis.issues.push('Contains special characters');
  }
  
  return analysis;
}

// Main validation function
function validateLocalBibleData() {
  console.log('🔍 Starting local Bible data validation...\n');
  
  const localFiles = getLocalBibleFiles();
  console.log(`📚 Found ${localFiles.length} local bible files\n`);
  
  if (localFiles.length === 0) {
    console.error('❌ No local bible files found');
    return;
  }

  const results = {
    totalFiles: localFiles.length,
    validFiles: 0,
    invalidFiles: 0,
    totalVerses: 0,
    totalErrors: 0,
    bookStats: {},
    errors: [],
    warnings: []
  };
  
  // Group files by book
  const filesByBook = {};
  localFiles.forEach(file => {
    if (!filesByBook[file.book]) {
      filesByBook[file.book] = [];
    }
    filesByBook[file.book].push(file);
  });
  
  console.log('📖 Validating each file...\n');
  
  for (const file of localFiles) {
    console.log(`Validating ${file.book} ${file.chapter}...`);
    
    const data = loadLocalBibleData(file.path);
    if (!data) {
      results.errors.push({
        file: file.file,
        book: file.book,
        chapter: file.chapter,
        error: 'Failed to load JSON data'
      });
      results.invalidFiles++;
      continue;
    }
    
    // Validate structure
    const structureErrors = validateChapterStructure(data, file.book, file.chapter);
    
    if (structureErrors.length > 0) {
      results.errors.push({
        file: file.file,
        book: file.book,
        chapter: file.chapter,
        errors: structureErrors
      });
      results.invalidFiles++;
      results.totalErrors += structureErrors.length;
    } else {
      results.validFiles++;
    }
    
    // Analyze text quality
    if (data.verses && Array.isArray(data.verses)) {
      results.totalVerses += data.verses.length;
      
      // Sample a few verses for quality analysis
      const sampleSize = Math.min(3, data.verses.length);
      const samples = data.verses
        .sort(() => Math.random() - 0.5)
        .slice(0, sampleSize);
      
      for (const verse of samples) {
        const quality = analyzeTextQuality(verse.text);
        if (quality.issues.length > 0) {
          results.warnings.push({
            file: file.file,
            book: file.book,
            chapter: file.chapter,
            verse: verse.verse,
            issues: quality.issues,
            analysis: quality
          });
        }
      }
    }
  }
  
  // Analyze book completeness
  console.log('\n📊 Analyzing book completeness...\n');
  
  for (const [book, files] of Object.entries(filesByBook)) {
    const expectedChapters = CHAPTER_COUNTS[book];
    const actualChapters = files.length;
    
    if (expectedChapters) {
      if (actualChapters !== expectedChapters) {
        results.warnings.push({
          type: 'book_completeness',
          book,
          expected: expectedChapters,
          actual: actualChapters,
          missing: expectedChapters - actualChapters
        });
      }
    }
    
    results.bookStats[book] = {
      chapters: actualChapters,
      expected: expectedChapters,
      complete: expectedChapters ? actualChapters === expectedChapters : 'unknown'
    };
  }
  
  // Generate report
  console.log('📊 Validation Results:\n');
  
  console.log(`📁 Files: ${results.validFiles}/${results.totalFiles} valid (${Math.round(results.validFiles/results.totalFiles*100)}%)`);
  console.log(`📝 Total verses: ${results.totalVerses.toLocaleString()}`);
  console.log(`❌ Total errors: ${results.totalErrors}`);
  console.log(`⚠️  Total warnings: ${results.warnings.length}`);
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(error => {
      console.log(`- ${error.file}: ${error.error || error.errors?.join(', ')}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    results.warnings.forEach(warning => {
      if (warning.type === 'book_completeness') {
        console.log(`- ${warning.book}: ${warning.actual}/${warning.expected} chapters (${warning.missing} missing)`);
      } else {
        console.log(`- ${warning.file} v${warning.verse}: ${warning.issues.join(', ')}`);
      }
    });
  }
  
  // Book completeness summary
  console.log('\n📚 Book Completeness:');
  const incompleteBooks = Object.entries(results.bookStats)
    .filter(([book, stats]) => stats.complete === false)
    .sort((a, b) => b[1].missing - a[1].missing);
  
  if (incompleteBooks.length > 0) {
    incompleteBooks.forEach(([book, stats]) => {
      console.log(`- ${book}: ${stats.chapters}/${stats.expected} chapters (${stats.missing} missing)`);
    });
  } else {
    console.log('✅ All books appear to be complete!');
  }
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: results,
    bookStats: results.bookStats
  };

  const reportFile = `local-bible-validation-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportFile}`);

  return report;
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    validateLocalBibleData();
    console.log('\n✅ Validation complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  }
}

export { validateLocalBibleData };
