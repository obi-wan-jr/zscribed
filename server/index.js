import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3005;

// Bible data directory
const BIBLE_DATA_DIR = path.resolve(__dirname, '../data/bible/web');

// Bible books mapping
const BIBLE_BOOKS = {
  'GEN': { name: 'Genesis', chapters: 50 },
  'EXO': { name: 'Exodus', chapters: 40 },
  'LEV': { name: 'Leviticus', chapters: 27 },
  'NUM': { name: 'Numbers', chapters: 36 },
  'DEU': { name: 'Deuteronomy', chapters: 34 },
  'JOS': { name: 'Joshua', chapters: 24 },
  'JDG': { name: 'Judges', chapters: 21 },
  'RUT': { name: 'Ruth', chapters: 4 },
  '1SA': { name: '1 Samuel', chapters: 31 },
  '2SA': { name: '2 Samuel', chapters: 24 },
  '1KI': { name: '1 Kings', chapters: 22 },
  '2KI': { name: '2 Kings', chapters: 25 },
  '1CH': { name: '1 Chronicles', chapters: 29 },
  '2CH': { name: '2 Chronicles', chapters: 36 },
  'EZR': { name: 'Ezra', chapters: 10 },
  'NEH': { name: 'Nehemiah', chapters: 13 },
  'EST': { name: 'Esther', chapters: 10 },
  'JOB': { name: 'Job', chapters: 42 },
  'PSA': { name: 'Psalms', chapters: 150 },
  'PRO': { name: 'Proverbs', chapters: 31 },
  'ECC': { name: 'Ecclesiastes', chapters: 12 },
  'SNG': { name: 'Song of Solomon', chapters: 8 },
  'ISA': { name: 'Isaiah', chapters: 66 },
  'JER': { name: 'Jeremiah', chapters: 52 },
  'LAM': { name: 'Lamentations', chapters: 5 },
  'EZK': { name: 'Ezekiel', chapters: 48 },
  'DAN': { name: 'Daniel', chapters: 12 },
  'HOS': { name: 'Hosea', chapters: 14 },
  'JOL': { name: 'Joel', chapters: 3 },
  'AMO': { name: 'Amos', chapters: 9 },
  'OBA': { name: 'Obadiah', chapters: 1 },
  'JON': { name: 'Jonah', chapters: 4 },
  'MIC': { name: 'Micah', chapters: 7 },
  'NAH': { name: 'Nahum', chapters: 3 },
  'HAB': { name: 'Habakkuk', chapters: 3 },
  'ZEP': { name: 'Zephaniah', chapters: 3 },
  'HAG': { name: 'Haggai', chapters: 2 },
  'ZEC': { name: 'Zechariah', chapters: 14 },
  'MAL': { name: 'Malachi', chapters: 4 },
  'MAT': { name: 'Matthew', chapters: 28 },
  'MRK': { name: 'Mark', chapters: 16 },
  'LUK': { name: 'Luke', chapters: 24 },
  'JHN': { name: 'John', chapters: 21 },
  'ACT': { name: 'Acts', chapters: 28 },
  'ROM': { name: 'Romans', chapters: 16 },
  '1CO': { name: '1 Corinthians', chapters: 16 },
  '2CO': { name: '2 Corinthians', chapters: 13 },
  'GAL': { name: 'Galatians', chapters: 6 },
  'EPH': { name: 'Ephesians', chapters: 6 },
  'PHP': { name: 'Philippians', chapters: 4 },
  'COL': { name: 'Colossians', chapters: 4 },
  '1TH': { name: '1 Thessalonians', chapters: 5 },
  '2TH': { name: '2 Thessalonians', chapters: 3 },
  '1TI': { name: '1 Timothy', chapters: 6 },
  '2TI': { name: '2 Timothy', chapters: 4 },
  'TIT': { name: 'Titus', chapters: 3 },
  'PHM': { name: 'Philemon', chapters: 1 },
  'HEB': { name: 'Hebrews', chapters: 13 },
  'JAS': { name: 'James', chapters: 5 },
  '1PE': { name: '1 Peter', chapters: 5 },
  '2PE': { name: '2 Peter', chapters: 3 },
  '1JN': { name: '1 John', chapters: 5 },
  '2JN': { name: '2 John', chapters: 1 },
  '3JN': { name: '3 John', chapters: 1 },
  'JUD': { name: 'Jude', chapters: 1 },
  'REV': { name: 'Revelation', chapters: 22 }
};

// Helper function to get book ID from name
function getBookId(bookName) {
  const normalizedName = bookName.toLowerCase().replace(/[^a-z]/g, '');
  for (const [id, book] of Object.entries(BIBLE_BOOKS)) {
    const normalizedBookName = book.name.toLowerCase().replace(/[^a-z]/g, '');
    if (normalizedName === normalizedBookName || normalizedName === id.toLowerCase()) {
      return id;
    }
  }
  return null;
}

// Helper function to load Bible chapter data
function loadChapter(bookId, chapter) {
  try {
    const bookName = BIBLE_BOOKS[bookId].name.toLowerCase().replace(/\s+/g, '-');
    const filename = `${bookName}-${chapter}.json`;
    const filepath = path.join(BIBLE_DATA_DIR, filename);
    
    if (!fs.existsSync(filepath)) {
      return null;
    }
    
    const data = fs.readFileSync(filepath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading chapter ${bookId} ${chapter}:`, error.message);
    return null;
  }
}

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Bible API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Get all books
app.get('/api/books', (req, res) => {
  try {
    const books = Object.entries(BIBLE_BOOKS).map(([id, book]) => ({
      id,
      name: book.name,
      chapters: book.chapters
    }));
    
    res.json({
      success: true,
      data: books
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch books'
    });
  }
});

// Get specific book
app.get('/api/books/:bookId', (req, res) => {
  try {
    const { bookId } = req.params;
    const book = BIBLE_BOOKS[bookId];
    
    if (!book) {
      return res.status(404).json({
        success: false,
        error: 'Book not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: bookId,
        name: book.name,
        chapters: book.chapters
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch book'
    });
  }
});

// Get chapter
app.get('/api/books/:bookId/chapters/:chapter', (req, res) => {
  try {
    const { bookId, chapter } = req.params;
    const chapterNum = parseInt(chapter);
    
    if (!BIBLE_BOOKS[bookId]) {
      return res.status(404).json({
        success: false,
        error: 'Book not found'
      });
    }
    
    if (chapterNum < 1 || chapterNum > BIBLE_BOOKS[bookId].chapters) {
      return res.status(400).json({
        success: false,
        error: `Chapter must be between 1 and ${BIBLE_BOOKS[bookId].chapters}`
      });
    }
    
    const chapterData = loadChapter(bookId, chapterNum);
    
    if (!chapterData) {
      return res.status(404).json({
        success: false,
        error: 'Chapter data not found'
      });
    }
    
    res.json({
      success: true,
      data: chapterData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chapter'
    });
  }
});

// Get verse range
app.get('/api/books/:bookId/chapters/:chapter/verses', (req, res) => {
  try {
    const { bookId, chapter } = req.params;
    const { start, end } = req.query;
    const chapterNum = parseInt(chapter);
    
    if (!BIBLE_BOOKS[bookId]) {
      return res.status(404).json({
        success: false,
        error: 'Book not found'
      });
    }
    
    if (chapterNum < 1 || chapterNum > BIBLE_BOOKS[bookId].chapters) {
      return res.status(400).json({
        success: false,
        error: `Chapter must be between 1 and ${BIBLE_BOOKS[bookId].chapters}`
      });
    }
    
    const chapterData = loadChapter(bookId, chapterNum);
    
    if (!chapterData) {
      return res.status(404).json({
        success: false,
        error: 'Chapter data not found'
      });
    }
    
    let verses = chapterData.verses;
    
    // Filter by verse range if specified
    if (start || end) {
      const startVerse = start ? parseInt(start) : 1;
      const endVerse = end ? parseInt(end) : verses.length;
      
      if (startVerse < 1 || endVerse > verses.length || startVerse > endVerse) {
        return res.status(400).json({
          success: false,
          error: 'Invalid verse range'
        });
      }
      
      verses = verses.filter(verse => verse.verse >= startVerse && verse.verse <= endVerse);
    }
    
    res.json({
      success: true,
      data: {
        reference: chapterData.reference,
        verses: verses
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch verses'
    });
  }
});

// Search verses by text
app.get('/api/search', (req, res) => {
  try {
    const { q, book, chapter } = req.query;
    
    if (!q || q.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 3 characters'
      });
    }
    
    const searchTerm = q.toLowerCase();
    const results = [];
    
    // If book is specified, search only that book
    const booksToSearch = book ? [book] : Object.keys(BIBLE_BOOKS);
    
    for (const bookId of booksToSearch) {
      if (!BIBLE_BOOKS[bookId]) continue;
      
      const maxChapters = chapter ? Math.min(parseInt(chapter), BIBLE_BOOKS[bookId].chapters) : BIBLE_BOOKS[bookId].chapters;
      const startChapter = chapter ? parseInt(chapter) : 1;
      
      for (let ch = startChapter; ch <= maxChapters; ch++) {
        const chapterData = loadChapter(bookId, ch);
        if (!chapterData) continue;
        
        const matchingVerses = chapterData.verses.filter(verse => 
          verse.text.toLowerCase().includes(searchTerm)
        );
        
        if (matchingVerses.length > 0) {
          results.push({
            book: bookId,
            bookName: BIBLE_BOOKS[bookId].name,
            chapter: ch,
            verses: matchingVerses
          });
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        query: q,
        results: results.slice(0, 100) // Limit results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Search failed'
    });
  }
});

// Get random verse
app.get('/api/random', (req, res) => {
  try {
    const books = Object.keys(BIBLE_BOOKS);
    const randomBook = books[Math.floor(Math.random() * books.length)];
    const randomChapter = Math.floor(Math.random() * BIBLE_BOOKS[randomBook].chapters) + 1;
    
    const chapterData = loadChapter(randomBook, randomChapter);
    
    if (!chapterData) {
      return res.status(500).json({
        success: false,
        error: 'Failed to load random verse'
      });
    }
    
    const randomVerse = chapterData.verses[Math.floor(Math.random() * chapterData.verses.length)];
    
    res.json({
      success: true,
      data: {
        reference: `${BIBLE_BOOKS[randomBook].name} ${randomChapter}:${randomVerse.verse}`,
        verse: randomVerse
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get random verse'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Bible API Server listening on http://localhost:${PORT}`);
  console.log(`[Server] Bible data loaded from: ${BIBLE_DATA_DIR}`);
  console.log(`[Server] Available books: ${Object.keys(BIBLE_BOOKS).length}`);
});
