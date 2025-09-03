import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BibleService {
    constructor() {
        this.dataDir = path.resolve(__dirname, '../../data/bible/web');
        this.books = this.getBookList();
        this.translations = ['web']; // For now, just WEB translation
    }

    getBooks() {
        return this.books;
    }

    getTranslations() {
        return this.translations;
    }

    getBookList() {
        return [
            'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
            'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
            '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
            'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms',
            'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah',
            'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
            'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
            'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
            'Matthew', 'Mark', 'Luke', 'John', 'Acts',
            'Romans', '1 Corinthians', '2 Corinthians', 'Galatians',
            'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
            '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
            'Hebrews', 'James', '1 Peter', '2 Peter', '1 John',
            '2 John', '3 John', 'Jude', 'Revelation'
        ];
    }

    getMaxChapters(book) {
        const chapterCounts = {
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
            '2 Thessalonians': 3, '1 Timothy': 6, '2 Timothy': 4, 'Titus': 3, 'Philemon': 1,
            'Hebrews': 13, 'James': 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5,
            '2 John': 1, '3 John': 1, 'Jude': 1, 'Revelation': 22
        };
        return chapterCounts[book] || 1;
    }

    async getBibleText(options) {
        const { 
            translation = 'web', 
            book, 
            chapter, 
            verseRanges, 
            excludeNumbers = true, 
            excludeFootnotes = true, 
            type = 'chapter', 
            chapters = '' 
        } = options;

        let allText = '';

        try {
            if (type === 'book') {
                // Handle entire book
                const maxChapters = this.getMaxChapters(book);
                for (let ch = 1; ch <= maxChapters; ch++) {
                    const chapterText = await this.getChapterText(translation, book, ch, verseRanges);
                    const cleanedText = this.cleanupBibleText(chapterText, { excludeNumbers, excludeFootnotes });
                    allText += `${book}, Chapter ${ch}.\n${cleanedText}\n\n`;
                }
            } else if (type === 'chapters' && chapters) {
                // Handle multiple chapters
                const chapterRanges = chapters.split(',').map(range => range.trim());
                for (const range of chapterRanges) {
                    if (range.includes('-')) {
                        const [start, end] = range.split('-').map(n => parseInt(n.trim()));
                        if (!isNaN(start) && !isNaN(end)) {
                            for (let ch = start; ch <= end; ch++) {
                                const chapterText = await this.getChapterText(translation, book, ch, verseRanges);
                                const cleanedText = this.cleanupBibleText(chapterText, { excludeNumbers, excludeFootnotes });
                                allText += `${book}, Chapter ${ch}.\n${cleanedText}\n\n`;
                            }
                        }
                    } else {
                        const ch = parseInt(range);
                        if (!isNaN(ch)) {
                            const chapterText = await this.getChapterText(translation, book, ch, verseRanges);
                            const cleanedText = this.cleanupBibleText(chapterText, { excludeNumbers, excludeFootnotes });
                            allText += `${cleanedText}\n\n`;
                        }
                    }
                }
            } else {
                // Handle single chapter
                const chapterText = await this.getChapterText(translation, book, chapter, verseRanges);
                allText = this.cleanupBibleText(chapterText, { excludeNumbers, excludeFootnotes });
            }

            return allText.trim();

        } catch (error) {
            throw new Error(`Failed to fetch Bible text: ${error.message}`);
        }
    }

    async getChapterText(translation, book, chapter, verseRanges = null) {
        const filename = `${book.toLowerCase().replace(/\s+/g, '-')}-${chapter}.json`;
        const filePath = path.join(this.dataDir, filename);

        if (!fs.existsSync(filePath)) {
            throw new Error(`Chapter not found: ${book} ${chapter}`);
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        let text = '';

        if (verseRanges && verseRanges.trim()) {
            // Parse verse ranges and extract specific verses
            const verses = this.parseVerseRanges(verseRanges);
            for (const verse of verses) {
                if (data.verses && data.verses[verse]) {
                    text += `${data.verses[verse]}\n`;
                }
            }
        } else {
            // Get all verses
            if (data.verses) {
                text = Object.values(data.verses).join('\n');
            } else if (data.text) {
                text = data.text;
            }
        }

        return text;
    }

    parseVerseRanges(verseRanges) {
        const verses = [];
        const ranges = verseRanges.split(',').map(range => range.trim());

        for (const range of ranges) {
            if (range.includes('-')) {
                const [start, end] = range.split('-').map(n => parseInt(n.trim()));
                if (!isNaN(start) && !isNaN(end)) {
                    for (let v = start; v <= end; v++) {
                        verses.push(v);
                    }
                }
            } else {
                const verse = parseInt(range);
                if (!isNaN(verse)) {
                    verses.push(verse);
                }
            }
        }

        return verses.sort((a, b) => a - b);
    }

    cleanupBibleText(text, options = {}) {
        const { excludeNumbers = true, excludeFootnotes = true } = options;
        let cleanedText = text;

        if (excludeNumbers) {
            // Remove verse numbers (e.g., "1", "2", "3")
            cleanedText = cleanedText.replace(/^\d+\s*/gm, '');
        }

        if (excludeFootnotes) {
            // Remove footnotes (e.g., [1], [2], [a], [b])
            cleanedText = cleanedText.replace(/\s*\[\d+\]\s*/g, ' ');
            cleanedText = cleanedText.replace(/\s*\[[a-z]\]\s*/gi, ' ');
        }

        // Clean up extra whitespace
        cleanedText = cleanedText.replace(/\n\s*\n/g, '\n\n');
        cleanedText = cleanedText.trim();

        return cleanedText;
    }

    validateChapter(book, chapter) {
        const maxChapters = this.getMaxChapters(book);
        const chapterNum = parseInt(chapter);

        if (isNaN(chapterNum)) {
            return { valid: false, error: 'Chapter must be a number' };
        }

        if (chapterNum < 1 || chapterNum > maxChapters) {
            return { valid: false, error: `Chapter must be between 1 and ${maxChapters}` };
        }

        return { valid: true, bookInfo: { maxChapters } };
    }

    validateVerseRanges(book, chapter, verseRanges) {
        const chapterValidation = this.validateChapter(book, chapter);
        if (!chapterValidation.valid) {
            return chapterValidation;
        }

        if (!verseRanges || !verseRanges.trim()) {
            return { valid: true };
        }

        try {
            const verses = this.parseVerseRanges(verseRanges);
            if (verses.length === 0) {
                return { valid: false, error: 'Invalid verse range format' };
            }

            // Check if verses are within reasonable bounds (assuming max 200 verses per chapter)
            const maxVerse = Math.max(...verses);
            if (maxVerse > 200) {
                return { valid: false, error: 'Verse number too high' };
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, error: 'Invalid verse range format' };
        }
    }
}
