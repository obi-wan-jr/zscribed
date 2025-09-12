import fs from 'fs';
import path from 'path';

console.log('🔍 **Bible Data Integrity & Consistency Check**\n');

// Configuration
const BIBLE_DATA_DIR = 'data/bible/web';
const RESULTS = {
  total: 0,
  valid: 0,
  invalid: 0,
  errors: [],
  warnings: [],
  fileIssues: [],
  structureIssues: [],
  contentIssues: []
};

// Helper function to check file structure
function validateFileStructure(data, filename) {
  const issues = [];
  
  // Check required fields
  const requiredFields = ['reference', 'verses', 'text', 'translation_id', 'translation_name', 'translation_note'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      issues.push(`Missing required field: ${field}`);
    }
  }
  
  // Check verses array
  if (data.verses && Array.isArray(data.verses)) {
    if (data.verses.length === 0) {
      issues.push('Verses array is empty');
    } else {
      // Check first verse structure
      const firstVerse = data.verses[0];
      const verseFields = ['book_id', 'book_name', 'chapter', 'verse', 'text'];
      for (const field of verseFields) {
        if (!(field in firstVerse)) {
          issues.push(`Missing verse field: ${field}`);
        }
      }
    }
  } else {
    issues.push('Verses field is missing or not an array');
  }
  
  // Check reference format - Updated to handle numbered books properly
  if (data.reference) {
    // Allow formats like "Genesis 1", "1 Chronicles 1", "2 Samuel 5", etc.
    const referencePattern = /^([0-9]+\s+)?[A-Za-z\s]+ \d+$/;
    if (!referencePattern.test(data.reference)) {
      issues.push(`Invalid reference format: ${data.reference}`);
    }
  }
  
  // Check text field length
  if (data.text && data.text.length < 10) {
    issues.push(`Text field too short: ${data.text.length} characters`);
  }
  
  return issues;
}

// Helper function to check content consistency
function validateContentConsistency(data, filename) {
  const issues = [];
  
  // Check verse numbering consistency
  if (data.verses && Array.isArray(data.verses)) {
    for (let i = 0; i < data.verses.length; i++) {
      const verse = data.verses[i];
      
      // Check verse number sequence
      if (verse.verse !== i + 1) {
        issues.push(`Verse numbering mismatch: expected ${i + 1}, got ${verse.verse}`);
      }
      
      // Check chapter consistency
      const expectedChapter = parseInt(data.reference.split(' ').pop());
      if (verse.chapter !== expectedChapter) {
        issues.push(`Chapter mismatch: reference says ${expectedChapter}, verse says ${verse.chapter}`);
      }
      
      // Check book consistency - Handle numbered books properly
      const referenceParts = data.reference.split(' ');
      const chapterNumber = referenceParts.pop(); // Remove chapter number
      const bookName = referenceParts.join(' '); // Join remaining parts for book name
      
      if (verse.book_name !== bookName) {
        issues.push(`Book name mismatch: reference says "${bookName}", verse says "${verse.book_name}"`);
      }
      
      // Check text content
      if (!verse.text || verse.text.trim().length === 0) {
        issues.push(`Empty verse text at verse ${verse.verse}`);
      }
      
      // Check for common content issues
      if (verse.text && verse.text.includes('undefined')) {
        issues.push(`Verse ${verse.verse} contains "undefined"`);
      }
      
      if (verse.text && verse.text.includes('null')) {
        issues.push(`Verse ${verse.verse} contains "null"`);
      }
    }
  }
  
  return issues;
}

// Helper function to check for common JSON issues
function checkForCommonIssues(data, filename) {
  const issues = [];
  
  // Check for smart quotes
  const jsonString = JSON.stringify(data);
  if (jsonString.includes('"') || jsonString.includes('"') || jsonString.includes('"')) {
    issues.push('Contains smart quotes (should be regular quotes)');
  }
  
  // Check for control characters
  if (jsonString.includes('\x00') || jsonString.includes('\x01') || jsonString.includes('\x02')) {
    issues.push('Contains control characters');
  }
  
  // Check for very long lines (potential parsing issues)
  const lines = jsonString.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > 1000) {
      issues.push(`Very long line (${lines[i].length} chars) at line ${i + 1}`);
    }
  }
  
  return issues;
}

// Main validation function
function validateFile(filepath) {
  const filename = path.basename(filepath);
  RESULTS.total++;
  
  try {
    // Read and parse file
    const content = fs.readFileSync(filepath, 'utf8');
    const data = JSON.parse(content);
    
    // Check file structure
    const structureIssues = validateFileStructure(data, filename);
    if (structureIssues.length > 0) {
      RESULTS.structureIssues.push({ filename, issues: structureIssues });
      RESULTS.warnings.push(`${filename}: ${structureIssues.join(', ')}`);
    }
    
    // Check content consistency
    const contentIssues = validateContentConsistency(data, filename);
    if (contentIssues.length > 0) {
      RESULTS.contentIssues.push({ filename, issues: contentIssues });
      RESULTS.warnings.push(`${filename}: ${contentIssues.join(', ')}`);
    }
    
    // Check for common issues
    const commonIssues = checkForCommonIssues(data, filename);
    if (commonIssues.length > 0) {
      RESULTS.fileIssues.push({ filename, issues: commonIssues });
      RESULTS.warnings.push(`${filename}: ${commonIssues.join(', ')}`);
    }
    
    if (structureIssues.length === 0 && contentIssues.length === 0 && commonIssues.length === 0) {
      RESULTS.valid++;
    } else {
      RESULTS.invalid++;
    }
    
  } catch (error) {
    RESULTS.invalid++;
    RESULTS.errors.push(`${filename}: ${error.message}`);
  }
}

// Get all JSON files
const files = fs.readdirSync(BIBLE_DATA_DIR)
  .filter(file => file.endsWith('.json'))
  .map(file => path.join(BIBLE_DATA_DIR, file))
  .sort();

console.log(`📊 **Validation Summary**`);
console.log(`Total files to validate: ${files.length}\n`);

// Validate each file
console.log('🔍 **Validating files...**');
for (const file of files) {
  validateFile(file);
  
  // Progress indicator
  if (RESULTS.total % 100 === 0) {
    console.log(`Processed ${RESULTS.total} files...`);
  }
}

// Generate detailed report
console.log('\n📋 **Validation Results**\n');

console.log(`✅ **Valid Files**: ${RESULTS.valid}`);
console.log(`❌ **Invalid Files**: ${RESULTS.invalid}`);
console.log(`⚠️  **Warnings**: ${RESULTS.warnings.length}`);
console.log(`🚨 **Errors**: ${RESULTS.errors.length}\n`);

if (RESULTS.errors.length > 0) {
  console.log('🚨 **Critical Errors** (Files that cannot be parsed):');
  RESULTS.errors.forEach(error => console.log(`  - ${error}`));
  console.log('');
}

if (RESULTS.warnings.length > 0) {
  console.log('⚠️  **Warnings** (Files with potential issues):');
  RESULTS.warnings.slice(0, 20).forEach(warning => console.log(`  - ${warning}`));
  if (RESULTS.warnings.length > 20) {
    console.log(`  ... and ${RESULTS.warnings.length - 20} more warnings`);
  }
  console.log('');
}

if (RESULTS.structureIssues.length > 0) {
  console.log('🏗️  **Structure Issues** (Missing or malformed fields):');
  RESULTS.structureIssues.slice(0, 10).forEach(item => {
    console.log(`  - ${item.filename}: ${item.issues.join(', ')}`);
  });
  if (RESULTS.structureIssues.length > 10) {
    console.log(`  ... and ${RESULTS.structureIssues.length - 10} more files with structure issues`);
  }
  console.log('');
}

if (RESULTS.contentIssues.length > 0) {
  console.log('📝 **Content Issues** (Data consistency problems):');
  RESULTS.contentIssues.slice(0, 10).forEach(item => {
    console.log(`  - ${item.filename}: ${item.issues.join(', ')}`);
  });
  if (RESULTS.contentIssues.length > 10) {
    console.log(`  ... and ${RESULTS.contentIssues.length - 10} more files with content issues`);
  }
  console.log('');
}

if (RESULTS.fileIssues.length > 0) {
  console.log('🔧 **File Issues** (Common JSON problems):');
  RESULTS.fileIssues.slice(0, 10).forEach(item => {
    console.log(`  - ${item.filename}: ${item.issues.join(', ')}`);
  });
  if (RESULTS.fileIssues.length > 10) {
    console.log(`  ... and ${RESULTS.fileIssues.length - 10} more files with file issues`);
  }
  console.log('');
}

// Overall assessment
console.log('📊 **Overall Assessment**');
if (RESULTS.invalid === 0 && RESULTS.warnings.length === 0) {
  console.log('🎉 **EXCELLENT**: All files are valid with no issues detected!');
} else if (RESULTS.invalid === 0 && RESULTS.warnings.length < 50) {
  console.log('✅ **GOOD**: All files are valid with minor warnings.');
} else if (RESULTS.invalid < 10) {
  console.log('⚠️  **FAIR**: Most files are valid with some issues to address.');
} else {
  console.log('❌ **POOR**: Multiple critical issues detected that need immediate attention.');
}

console.log(`\n📈 **Quality Score**: ${Math.round((RESULTS.valid / RESULTS.total) * 100)}%`);

// Save detailed results to file
const reportData = {
  timestamp: new Date().toISOString(),
  summary: {
    total: RESULTS.total,
    valid: RESULTS.valid,
    invalid: RESULTS.invalid,
    warnings: RESULTS.warnings.length,
    errors: RESULTS.errors.length
  },
  errors: RESULTS.errors,
  warnings: RESULTS.warnings,
  structureIssues: RESULTS.structureIssues,
  contentIssues: RESULTS.contentIssues,
  fileIssues: RESULTS.fileIssues
};

fs.writeFileSync('bible-data-validation-report.json', JSON.stringify(reportData, null, 2));
console.log('\n📄 **Detailed report saved to**: bible-data-validation-report.json');
