#!/usr/bin/env node

import puppeteer from 'puppeteer';

const BASE_URL = 'https://audio.juandelacruzjr.com';
const TEST_USER = 'inggo';

async function testSinglePage() {
    console.log('🚀 Starting Single Page Test...\n');
    
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
        
        console.log('📋 Test: TTS Page Navigation');
        console.log('============================');
        
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
        
        console.log('1.3 Waiting for fallback to execute...');
        await new Promise(resolve => setTimeout(resolve, 8000)); // Wait 8 seconds
        
        // Check if user name is displayed
        const userSection = await page.$('#userSection');
        if (userSection) {
            const userSectionText = await page.evaluate(el => el.textContent, userSection);
            console.log('User section content:', userSectionText);
            
            // Check for user greeting
            const greetingElement = await page.$('#userSection span');
            if (greetingElement) {
                const greetingText = await page.evaluate(el => el.textContent, greetingElement);
                console.log('Greeting text:', greetingText);
                
                if (greetingText.includes('Hi,') && greetingText.includes(TEST_USER)) {
                    console.log('✅ User name displayed correctly:', greetingText);
                } else {
                    console.log('❌ User name not displayed correctly:', greetingText);
                }
            } else {
                console.log('❌ No greeting element found');
            }
            
            // Check for logout button
            const logoutButton = await page.$('#userSection button');
            if (logoutButton) {
                const logoutText = await page.evaluate(el => el.textContent, logoutButton);
                console.log('✅ Logout button found:', logoutText);
            } else {
                console.log('❌ No logout button found');
            }
        } else {
            console.log('❌ User section not found');
        }
        
        // Test the API directly
        const currentUser = await page.evaluate(async () => {
            try {
                const res = await fetch('/api/auth/current-user', {
                    credentials: 'include',
                    headers: { 'Accept': 'application/json' }
                });
                if (res.ok) {
                    const data = await res.json();
                    return data.user;
                }
                return null;
            } catch (error) {
                return null;
            }
        });
        
        console.log('Current user from API:', currentUser);
        
        if (currentUser === TEST_USER) {
            console.log('✅ API returns correct user');
        } else {
            console.log('❌ API does not return correct user');
        }
        
    } catch (error) {
        console.error('❌ Single page test failed:', error.message);
        console.error(error.stack);
    } finally {
        console.log('\n🔚 Closing browser...');
        await browser.close();
    }
}

// Run the test
testSinglePage().catch(console.error);
