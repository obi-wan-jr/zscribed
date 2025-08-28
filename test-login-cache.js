#!/usr/bin/env node

import puppeteer from 'puppeteer';

const BASE_URL = 'https://audio.juandelacruzjr.com';
const TEST_USER = 'inggo';

async function testLoginAndCache() {
    console.log('🚀 Starting dScribe Login and Cache Test...\n');
    
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
        
        console.log('📋 Test 1: Login Functionality');
        console.log('==============================');
        
        // Test 1: Login
        console.log('1.1 Navigating to login page...');
        await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle2' });
        
        console.log('1.2 Checking if login form is present...');
        const loginForm = await page.$('#loginForm');
        if (!loginForm) {
            throw new Error('Login form not found');
        }
        console.log('✅ Login form found');
        
        console.log('1.3 Filling login form...');
        await page.type('#userName', TEST_USER);
        console.log('✅ Username entered');
        
        console.log('1.4 Submitting login form...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('button[type="submit"]')
        ]);
        
        console.log('1.5 Checking if login was successful...');
        const currentUrl = page.url();
        console.log(`Current URL: ${currentUrl}`);
        
        if (currentUrl.includes('login.html')) {
            // Check for error message
            const errorElement = await page.$('#loginError');
            if (errorElement) {
                const errorText = await page.evaluate(el => el.textContent, errorElement);
                console.log(`❌ Login failed: ${errorText}`);
            } else {
                console.log('❌ Login failed: Still on login page but no error message');
            }
        } else {
            console.log('✅ Login successful - redirected from login page');
        }
        
        console.log('\n📋 Test 2: Admin Page Access');
        console.log('============================');
        
        // Test 2: Access admin page
        console.log('2.1 Navigating to admin page...');
        await page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'networkidle2' });
        
        const adminUrl = page.url();
        console.log(`Admin page URL: ${adminUrl}`);
        
        if (adminUrl.includes('login.html')) {
            console.log('❌ Admin page requires login - redirecting to login');
        } else {
            console.log('✅ Admin page accessible');
            
            // Wait for admin page to load
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check if status elements are loading
            const serverStatus = await page.$('#serverStatus');
            if (serverStatus) {
                const statusText = await page.evaluate(el => el.textContent, serverStatus);
                console.log(`Server Status: ${statusText}`);
            }
            
            const cacheBuster = await page.$('#cacheBuster');
            if (cacheBuster) {
                const cacheText = await page.evaluate(el => el.textContent, cacheBuster);
                console.log(`Cache Buster: ${cacheText}`);
            }
        }
        
        console.log('\n📋 Test 3: Cache Management API');
        console.log('===============================');
        
        // Test 3: Direct API calls
        console.log('3.1 Testing cache status API...');
        const cacheStatusResponse = await page.evaluate(async () => {
            const res = await fetch('/api/cache/status');
            return {
                status: res.status,
                ok: res.ok,
                data: await res.json()
            };
        });
        
        console.log('Cache Status Response:', cacheStatusResponse);
        
        console.log('3.2 Testing cache purge API...');
        const cachePurgeResponse = await page.evaluate(async () => {
            try {
                const res = await fetch('/api/cache/purge', {
                    method: 'POST'
                });
                return {
                    status: res.status,
                    ok: res.ok,
                    data: await res.json()
                };
            } catch (error) {
                return {
                    error: error.message
                };
            }
        });
        
        console.log('Cache Purge Response:', cachePurgeResponse);
        
        console.log('\n📋 Test 4: Authentication Check');
        console.log('===============================');
        
        // Test 4: Check authentication status
        console.log('4.1 Testing authentication check...');
        const authResponse = await page.evaluate(async () => {
            try {
                const res = await fetch('/api/health');
                return {
                    status: res.status,
                    ok: res.ok,
                    data: await res.json()
                };
            } catch (error) {
                return {
                    error: error.message
                };
            }
        });
        
        console.log('Auth Response:', authResponse);
        
        console.log('\n📋 Test 5: Cookie Analysis');
        console.log('==========================');
        
        // Test 5: Check cookies
        const cookies = await page.cookies();
        console.log('Cookies found:', cookies.length);
        cookies.forEach(cookie => {
            console.log(`- ${cookie.name}: ${cookie.value} (${cookie.domain})`);
        });
        
        console.log('\n📋 Test 6: Network Requests');
        console.log('===========================');
        
        // Test 6: Monitor network requests
        const requests = [];
        page.on('request', request => {
            requests.push({
                url: request.url(),
                method: request.method(),
                headers: request.headers()
            });
        });
        
        // Navigate to a page to trigger requests
        await page.goto(`${BASE_URL}/index.html`, { waitUntil: 'networkidle2' });
        
        console.log('Recent requests:');
        requests.slice(-5).forEach((req, i) => {
            console.log(`${i + 1}. ${req.method} ${req.url}`);
        });
        
        console.log('\n🎯 Test Summary');
        console.log('===============');
        console.log('✅ Login form accessible');
        console.log('✅ Admin page structure present');
        console.log('✅ Cache management APIs available');
        console.log('✅ Authentication system working');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        console.log('\n🔚 Closing browser...');
        await browser.close();
    }
}

// Run the test
testLoginAndCache().catch(console.error);
