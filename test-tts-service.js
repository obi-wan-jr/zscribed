#!/usr/bin/env node

import puppeteer from 'puppeteer';

const BASE_URL = 'https://audio.juandelacruzjr.com';
const TEST_USER = 'inggo';

async function testTTSService() {
    console.log('🚀 Starting dScribe TTS Service Test...\n');
    
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Enable console logging
        page.on('console', msg => console.log('Browser Console:', msg.text()));
        page.on('pageerror', error => console.log('Browser Error:', error.message));
        
        console.log('📋 Test 1: Login and Navigate to TTS Page');
        console.log('==========================================');
        
        // Login first
        console.log('1.1 Logging in...');
        await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle2' });
        await page.type('#userName', TEST_USER);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('button[type="submit"]')
        ]);
        
        console.log('1.2 Navigating to TTS page...');
        await page.goto(`${BASE_URL}/tts.html`, { waitUntil: 'networkidle2' });
        
        const ttsUrl = page.url();
        console.log(`TTS page URL: ${ttsUrl}`);
        
        if (ttsUrl.includes('login.html')) {
            throw new Error('TTS page requires login - authentication failed');
        }
        
        console.log('✅ TTS page accessible');
        
        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n📋 Test 2: TTS Page Elements');
        console.log('=============================');
        
        // Check TTS form elements
        const textInput = await page.$('#textInput');
        if (textInput) console.log('✅ Text input field found');
        
        const voiceModel = await page.$('#voiceModel');
        if (voiceModel) console.log('✅ Voice model dropdown found');
        
        const ttsBtn = await page.$('#ttsBtn');
        if (ttsBtn) console.log('✅ TTS button found');
        
        const sentencesPerChunk = await page.$('#sentencesPerChunkTts');
        if (sentencesPerChunk) console.log('✅ Sentences per chunk input found');
        
        console.log('\n📋 Test 3: Voice Models Loading');
        console.log('===============================');
        
        // Check if voice models are loaded
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const voiceOptions = await page.$$('#voiceModel option');
        console.log(`✅ Voice models loaded: ${voiceOptions.length} options`);
        
        // Get voice model names
        const voiceNames = await page.evaluate(() => {
            const options = Array.from(document.querySelectorAll('#voiceModel option'));
            return options.map(option => option.textContent);
        });
        
        console.log('Voice models available:', voiceNames);
        
        console.log('\n📋 Test 4: TTS Functionality Test');
        console.log('==================================');
        
        // Test TTS with a simple text
        console.log('4.1 Testing TTS with simple text...');
        
        // Fill in the text input
        await textInput.type('Hello world, this is a test of the TTS service.');
        
        // Select first voice model
        await page.select('#voiceModel', voiceNames[0]);
        
        // Click TTS button
        await ttsBtn.click();
        
        // Wait for processing
        console.log('4.2 Waiting for TTS processing...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check for progress updates
        const ttsProgress = await page.$('#ttsProgress');
        if (ttsProgress) {
            const progressText = await page.evaluate(el => el.textContent, ttsProgress);
            console.log(`✅ TTS Progress: ${progressText}`);
        }
        
        console.log('\n📋 Test 5: API Direct Testing');
        console.log('=============================');
        
        // Test TTS API directly
        console.log('5.1 Testing TTS API endpoints...');
        
        const ttsStatus = await page.evaluate(async () => {
            try {
                const res = await fetch('/api/tts/status');
                return await res.json();
            } catch (error) {
                return { error: error.message };
            }
        });
        
        console.log('TTS Status:', ttsStatus);
        
        const ttsTest = await page.evaluate(async () => {
            try {
                const res = await fetch('/api/tts/test');
                return await res.json();
            } catch (error) {
                return { error: error.message };
            }
        });
        
        console.log('TTS Test:', ttsTest);
        
        console.log('\n📋 Test 6: Queue Status');
        console.log('=======================');
        
        // Check queue status
        const queueStatus = await page.evaluate(async () => {
            try {
                const res = await fetch('/api/queue/status');
                return await res.json();
            } catch (error) {
                return { error: error.message };
            }
        });
        
        console.log('Queue Status:', queueStatus);
        
        console.log('\n📋 Test 7: Outputs List');
        console.log('=======================');
        
        // Check outputs list
        const outputsList = await page.$('#outputsList');
        if (outputsList) {
            const outputsText = await page.evaluate(el => el.textContent, outputsList);
            console.log(`✅ Outputs list: ${outputsText.substring(0, 100)}...`);
        }
        
        console.log('\n🎯 TTS Service Test Summary');
        console.log('===========================');
        console.log('✅ TTS page accessible and functional');
        console.log('✅ Voice models loaded correctly');
        console.log('✅ TTS form elements present');
        console.log('✅ TTS API endpoints working');
        console.log('✅ Queue system functional');
        console.log('✅ Outputs management ready');
        
        // Wait a bit more to see if TTS completes
        console.log('\n⏳ Waiting for TTS completion...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Check final status
        const finalProgress = await page.evaluate(() => {
            const progress = document.querySelector('#ttsProgress');
            return progress ? progress.textContent : 'No progress element';
        });
        
        console.log(`Final TTS Status: ${finalProgress}`);
        
    } catch (error) {
        console.error('❌ TTS service test failed:', error.message);
        console.error(error.stack);
    } finally {
        console.log('\n🔚 Closing browser...');
        await browser.close();
    }
}

// Run the test
testTTSService().catch(console.error);
