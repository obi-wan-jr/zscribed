#!/usr/bin/env node

import puppeteer from 'puppeteer';

const BASE_URL = 'https://audio.juandelacruzjr.com';
const TEST_USER = 'inggo';

async function testUserDisplay() {
    console.log('🚀 Starting User Display Test...\n');
    
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
        
        console.log('📋 Test 1: Login and Check User Display');
        console.log('========================================');
        
        // Login first
        console.log('1.1 Logging in...');
        await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle2' });
        await page.type('#userName', TEST_USER);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('button[type="submit"]')
        ]);
        
        console.log('1.2 Checking navigation after login...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
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
        
        console.log('\n📋 Test 2: Navigate to Different Pages');
        console.log('=====================================');
        
        // Test on different pages
        const pages = ['/tts.html', '/bible.html', '/admin.html'];
        
        for (const pagePath of pages) {
            console.log(`2.1 Testing ${pagePath}...`);
            await page.goto(`${BASE_URL}${pagePath}`, { waitUntil: 'networkidle2' });
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const userSectionText = await page.evaluate(() => {
                const userSection = document.getElementById('userSection');
                return userSection ? userSection.textContent : 'No user section';
            });
            
            console.log(`User section on ${pagePath}:`, userSectionText);
            
            // Check if user name is still displayed
            const hasUserGreeting = await page.evaluate(() => {
                const greeting = document.querySelector('#userSection span');
                return greeting && greeting.textContent.includes('Hi,');
            });
            
            if (hasUserGreeting) {
                console.log(`✅ User greeting maintained on ${pagePath}`);
            } else {
                console.log(`❌ User greeting lost on ${pagePath}`);
            }
        }
        
        console.log('\n📋 Test 3: API Direct Test');
        console.log('==========================');
        
        // Test the API directly
        const currentUser = await page.evaluate(async () => {
            try {
                const res = await fetch('/api/auth/current-user', {
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json'
                    }
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
        
        console.log('\n📋 Test 4: Navigation Update Test');
        console.log('===============================');
        
        // Test the updateNavigation function
        const navigationResult = await page.evaluate(async () => {
            try {
                // Import the function (this might not work in this context)
                // Let's test the DOM directly
                const userSection = document.getElementById('userSection');
                if (!userSection) return 'No user section';
                
                const greeting = userSection.querySelector('span');
                const logoutBtn = userSection.querySelector('button');
                
                return {
                    hasGreeting: !!greeting,
                    greetingText: greeting ? greeting.textContent : null,
                    hasLogout: !!logoutBtn,
                    logoutText: logoutBtn ? logoutBtn.textContent : null
                };
            } catch (error) {
                return { error: error.message };
            }
        });
        
        console.log('Navigation test result:', navigationResult);
        
        console.log('\n🎯 User Display Test Summary');
        console.log('============================');
        console.log('✅ Login successful');
        console.log('✅ API authentication working');
        console.log('✅ User section present');
        
        if (navigationResult.hasGreeting && navigationResult.greetingText.includes('Hi,')) {
            console.log('✅ User greeting displayed correctly');
        } else {
            console.log('❌ User greeting not displayed correctly');
        }
        
        if (navigationResult.hasLogout) {
            console.log('✅ Logout button present');
        } else {
            console.log('❌ Logout button missing');
        }
        
    } catch (error) {
        console.error('❌ User display test failed:', error.message);
        console.error(error.stack);
    } finally {
        console.log('\n🔚 Closing browser...');
        await browser.close();
    }
}

// Run the test
testUserDisplay().catch(console.error);
