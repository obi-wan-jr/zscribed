#!/usr/bin/env node

import puppeteer from 'puppeteer';

const BASE_URL = 'https://audio.juandelacruzjr.com';
const TEST_USERS = ['irish', 'gelo', 'jm', 'inggo'];

async function testNewUsers() {
    console.log('🚀 Testing New User Authentication...\n');
    
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
        
        for (const user of TEST_USERS) {
            console.log(`📋 Testing user: ${user}`);
            console.log('=====================================');
            
            // Go to login page
            await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle2' });
            
            // Clear any existing input
            await page.evaluate(() => {
                const input = document.getElementById('userName');
                if (input) input.value = '';
            });
            
            // Type username
            await page.type('#userName', user);
            
            // Submit login
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2' }),
                page.click('button[type="submit"]')
            ]);
            
            // Wait for navigation and check result
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const currentUrl = page.url();
            console.log(`Current URL: ${currentUrl}`);
            
            if (currentUrl.includes('/index.html') || currentUrl.includes('/tts.html') || currentUrl.includes('/bible.html') || currentUrl.includes('/admin.html')) {
                console.log(`✅ ${user} - Login successful!`);
                
                // Check if user name is displayed
                const userSection = await page.$('#userSection');
                if (userSection) {
                    const userSectionText = await page.evaluate(el => el.textContent, userSection);
                    console.log(`User section: ${userSectionText}`);
                    
                    if (userSectionText.includes('Hi,') && userSectionText.includes(user)) {
                        console.log(`✅ ${user} - User name displayed correctly`);
                    } else {
                        console.log(`⚠️ ${user} - User name not displayed correctly`);
                    }
                }
            } else {
                console.log(`❌ ${user} - Login failed, still on login page`);
            }
            
            // Logout for next test
            try {
                await page.evaluate(async () => {
                    await fetch('/api/auth/logout', { method: 'POST' });
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.log('Logout failed, continuing...');
            }
            
            console.log('');
        }
        
        console.log('🎯 Test Summary');
        console.log('===============');
        console.log('✅ All users should now be able to log in');
        console.log('✅ User names should display correctly');
        console.log('✅ Navigation should work for all users');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        console.log('\n🔚 Closing browser...');
        await browser.close();
    }
}

// Run the test
testNewUsers().catch(console.error);
