#!/usr/bin/env node

import puppeteer from 'puppeteer';

const BASE_URL = 'https://audio.juandelacruzjr.com';
const TEST_USER = 'inggo';

async function testDebugNavigation() {
    console.log('🚀 Starting Navigation Debug Test...\n');
    
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
        
        console.log('📋 Test 1: Login and Debug Navigation');
        console.log('=====================================');
        
        // Login first
        console.log('1.1 Logging in...');
        await page.goto(`${BASE_URL}/login.html`, { waitUntil: 'networkidle2' });
        await page.type('#userName', TEST_USER);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('button[type="submit"]')
        ]);
        
        console.log('1.2 Waiting for page to load...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test the functions directly
        console.log('1.3 Testing functions directly...');
        
        const testResults = await page.evaluate(async () => {
            const results = {};
            
            try {
                // Test checkAuth function
                console.log('Testing checkAuth...');
                const checkAuthRes = await fetch('/api/health', {
                    credentials: 'include',
                    headers: { 'Accept': 'application/json' }
                });
                results.healthStatus = checkAuthRes.status;
                results.healthOk = checkAuthRes.ok;
                
                if (checkAuthRes.ok) {
                    const protectedRes = await fetch('/api/models?t=' + Date.now(), {
                        credentials: 'include',
                        headers: { 'Accept': 'application/json' }
                    });
                    results.protectedStatus = protectedRes.status;
                    results.protectedOk = protectedRes.ok;
                }
                
                // Test getCurrentUser function
                console.log('Testing getCurrentUser...');
                const userRes = await fetch('/api/auth/current-user', {
                    credentials: 'include',
                    headers: { 'Accept': 'application/json' }
                });
                results.userStatus = userRes.status;
                results.userOk = userRes.ok;
                
                if (userRes.ok) {
                    const userData = await userRes.json();
                    results.userData = userData;
                }
                
                // Test DOM elements
                const userSection = document.getElementById('userSection');
                results.hasUserSection = !!userSection;
                if (userSection) {
                    results.userSectionHTML = userSection.innerHTML;
                    results.userSectionText = userSection.textContent;
                }
                
                // Test if we can create the greeting
                if (results.userData && results.userData.user) {
                    const container = document.createElement('div');
                    container.className = 'flex items-center space-x-4';
                    
                    const greetingText = document.createElement('span');
                    greetingText.className = 'text-gray-300';
                    greetingText.textContent = `Hi, ${results.userData.user}!`;
                    
                    const logoutBtn = document.createElement('button');
                    logoutBtn.className = 'text-red-400 hover:text-red-300 transition-colors';
                    logoutBtn.textContent = 'Logout';
                    
                    container.appendChild(greetingText);
                    container.appendChild(logoutBtn);
                    
                    results.greetingHTML = container.outerHTML;
                }
                
            } catch (error) {
                results.error = error.message;
            }
            
            return results;
        });
        
        console.log('Test results:', JSON.stringify(testResults, null, 2));
        
        // Try to manually update the navigation
        if (testResults.userData && testResults.userData.user) {
            console.log('1.4 Manually updating navigation...');
            
            const updateResult = await page.evaluate((userData) => {
                try {
                    const userSection = document.getElementById('userSection');
                    if (userSection) {
                        // Clear existing content
                        userSection.innerHTML = '';
                        
                        // Create new greeting
                        const container = document.createElement('div');
                        container.className = 'flex items-center space-x-4';
                        
                        const greetingText = document.createElement('span');
                        greetingText.className = 'text-gray-300';
                        greetingText.textContent = `Hi, ${userData.user}!`;
                        
                        const logoutBtn = document.createElement('button');
                        logoutBtn.className = 'text-red-400 hover:text-red-300 transition-colors';
                        logoutBtn.textContent = 'Logout';
                        logoutBtn.onclick = () => {
                            fetch('/api/auth/logout', { method: 'POST' })
                                .then(() => window.location.href = '/login.html');
                        };
                        
                        container.appendChild(greetingText);
                        container.appendChild(logoutBtn);
                        userSection.appendChild(container);
                        
                        return {
                            success: true,
                            newHTML: userSection.innerHTML,
                            newText: userSection.textContent
                        };
                    }
                    return { success: false, error: 'No user section found' };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }, testResults.userData);
            
            console.log('Manual update result:', updateResult);
            
            if (updateResult.success) {
                console.log('✅ Navigation manually updated successfully!');
                
                // Wait a moment and check if it persists
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const finalCheck = await page.evaluate(() => {
                    const userSection = document.getElementById('userSection');
                    return {
                        hasUserSection: !!userSection,
                        text: userSection ? userSection.textContent : null,
                        hasGreeting: userSection ? userSection.querySelector('span') !== null : false,
                        hasLogout: userSection ? userSection.querySelector('button') !== null : false
                    };
                });
                
                console.log('Final check:', finalCheck);
            }
        }
        
    } catch (error) {
        console.error('❌ Navigation debug test failed:', error.message);
        console.error(error.stack);
    } finally {
        console.log('\n🔚 Closing browser...');
        await browser.close();
    }
}

// Run the test
testDebugNavigation().catch(console.error);
