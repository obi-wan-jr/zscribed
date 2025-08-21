const https = require('https');
const http = require('http');

// Test configuration
const TEST_CONFIG = {
    baseUrl: 'https://audio.juandelacruzjr.com',
    timeout: 10000
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: TEST_CONFIG.timeout
        };
        
        const req = client.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        if (options.body) {
            req.write(options.body);
        }
        
        req.end();
    });
}

// Test JavaScript functionality
async function testJavaScriptFunctionality() {
    console.log('🧪 Test 1: JavaScript Functionality Analysis');
    
    try {
        const response = await makeRequest(`${TEST_CONFIG.baseUrl}/bible.js`);
        
        if (response.statusCode !== 200) {
            throw new Error(`HTTP ${response.statusCode}`);
        }
        
        const content = response.data;
        
        // Check for specific functionality patterns
        const checks = [
            { 
                name: 'Radio button event listeners', 
                pattern: 'addEventListener.*change', 
                found: content.includes('addEventListener') && content.includes('change'),
                description: 'Radio buttons should have change event listeners'
            },
            { 
                name: 'selectMode function', 
                pattern: 'function selectMode', 
                found: content.includes('function selectMode'),
                description: 'selectMode function should exist'
            },
            { 
                name: 'Visual state management', 
                pattern: 'border-indigo-500', 
                found: content.includes('border-indigo-500'),
                description: 'Should manage visual state with border-indigo-500 class'
            },
            { 
                name: 'Radio indicator management', 
                pattern: 'bg-indigo-500', 
                found: content.includes('bg-indigo-500'),
                description: 'Should manage radio indicator with bg-indigo-500 class'
            },
            { 
                name: 'Input section visibility', 
                pattern: 'classList.*hidden', 
                found: content.includes('classList') && content.includes('hidden'),
                description: 'Should manage input section visibility'
            },
            { 
                name: 'State synchronization', 
                pattern: 'radio.checked', 
                found: content.includes('radio.checked') || content.includes('checked ='),
                description: 'Should synchronize radio button checked state'
            },
            { 
                name: 'Status message updates', 
                pattern: 'updateStatus', 
                found: content.includes('updateStatus'),
                description: 'Should update status messages'
            },
            { 
                name: 'Mode validation', 
                pattern: 'currentMode', 
                found: content.includes('currentMode'),
                description: 'Should track current mode'
            }
        ];
        
        let allPassed = true;
        checks.forEach(check => {
            if (check.found) {
                console.log(`✅ ${check.name}: ${check.description}`);
            } else {
                console.log(`❌ ${check.name}: ${check.description}`);
                allPassed = false;
            }
        });
        
        return allPassed;
    } catch (error) {
        console.error(`❌ JavaScript functionality test failed: ${error.message}`);
        return false;
    }
}

// Test HTML structure
async function testHTMLStructure() {
    console.log('\n🧪 Test 2: HTML Structure Analysis');
    
    try {
        const response = await makeRequest(`${TEST_CONFIG.baseUrl}/bible.html`);
        
        if (response.statusCode !== 200) {
            throw new Error(`HTTP ${response.statusCode}`);
        }
        
        const content = response.data;
        
        // Check for proper HTML structure
        const checks = [
            { 
                name: 'Radio button structure', 
                pattern: 'input type="radio" name="transcribeMode"', 
                found: content.includes('input type="radio" name="transcribeMode"'),
                description: 'Should have proper radio button inputs'
            },
            { 
                name: 'Label structure', 
                pattern: '<label.*id="bookOption"', 
                found: content.includes('<label') && content.includes('id="bookOption"'),
                description: 'Should have proper label structure for options'
            },
            { 
                name: 'Visual indicators', 
                pattern: 'w-8 h-8.*rounded-full', 
                found: content.includes('w-8 h-8') && content.includes('rounded-full'),
                description: 'Should have visual radio indicators'
            },
            { 
                name: 'Input sections', 
                pattern: 'id="chapterInput"', 
                found: content.includes('id="chapterInput"'),
                description: 'Should have chapter input section'
            },
            { 
                name: 'Multiple chapters input', 
                pattern: 'id="chaptersInput"', 
                found: content.includes('id="chaptersInput"'),
                description: 'Should have multiple chapters input section'
            },
            { 
                name: 'Status element', 
                pattern: 'id="status"', 
                found: content.includes('id="status"'),
                description: 'Should have status display element'
            }
        ];
        
        let allPassed = true;
        checks.forEach(check => {
            if (check.found) {
                console.log(`✅ ${check.name}: ${check.description}`);
            } else {
                console.log(`❌ ${check.name}: ${check.description}`);
                allPassed = false;
            }
        });
        
        return allPassed;
    } catch (error) {
        console.error(`❌ HTML structure test failed: ${error.message}`);
        return false;
    }
}

// Test CSS classes
async function testCSSClasses() {
    console.log('\n🧪 Test 3: CSS Classes Analysis');
    
    try {
        const response = await makeRequest(`${TEST_CONFIG.baseUrl}/styles.build.css`);
        
        if (response.statusCode !== 200) {
            throw new Error(`HTTP ${response.statusCode}`);
        }
        
        const content = response.data;
        
        // Check for required CSS classes
        const checks = [
            { 
                name: 'Border classes', 
                pattern: 'border-indigo-500', 
                found: content.includes('border-indigo-500'),
                description: 'Should have indigo border classes for selection'
            },
            { 
                name: 'Background classes', 
                pattern: 'bg-indigo-900', 
                found: content.includes('bg-indigo-900'),
                description: 'Should have indigo background classes for selection'
            },
            { 
                name: 'Hidden class', 
                pattern: '.hidden', 
                found: content.includes('.hidden'),
                description: 'Should have hidden class for visibility control'
            },
            { 
                name: 'Transition classes', 
                pattern: 'transition', 
                found: content.includes('transition'),
                description: 'Should have transition classes for smooth animations'
            }
        ];
        
        let allPassed = true;
        checks.forEach(check => {
            if (check.found) {
                console.log(`✅ ${check.name}: ${check.description}`);
            } else {
                console.log(`❌ ${check.name}: ${check.description}`);
                allPassed = false;
            }
        });
        
        return allPassed;
    } catch (error) {
        console.error(`❌ CSS classes test failed: ${error.message}`);
        return false;
    }
}

// Test specific radio button values
async function testRadioButtonValues() {
    console.log('\n🧪 Test 4: Radio Button Values Analysis');
    
    try {
        const response = await makeRequest(`${TEST_CONFIG.baseUrl}/bible.html`);
        
        if (response.statusCode !== 200) {
            throw new Error(`HTTP ${response.statusCode}`);
        }
        
        const content = response.data;
        
        // Check for specific radio button values
        const checks = [
            { 
                name: 'Book value', 
                pattern: 'value="book"', 
                found: content.includes('value="book"'),
                description: 'Should have radio button with value="book"'
            },
            { 
                name: 'Chapter value', 
                pattern: 'value="chapter"', 
                found: content.includes('value="chapter"'),
                description: 'Should have radio button with value="chapter"'
            },
            { 
                name: 'Chapters value', 
                pattern: 'value="chapters"', 
                found: content.includes('value="chapters"'),
                description: 'Should have radio button with value="chapters"'
            }
        ];
        
        let allPassed = true;
        checks.forEach(check => {
            if (check.found) {
                console.log(`✅ ${check.name}: ${check.description}`);
            } else {
                console.log(`❌ ${check.name}: ${check.description}`);
                allPassed = false;
            }
        });
        
        return allPassed;
    } catch (error) {
        console.error(`❌ Radio button values test failed: ${error.message}`);
        return false;
    }
}

// Main test runner
async function runFunctionalTests() {
    console.log('🚀 Starting functional tests against meatpi...\n');
    
    const tests = [
        { name: 'JavaScript Functionality', fn: testJavaScriptFunctionality },
        { name: 'HTML Structure', fn: testHTMLStructure },
        { name: 'CSS Classes', fn: testCSSClasses },
        { name: 'Radio Button Values', fn: testRadioButtonValues }
    ];
    
    let passedTests = 0;
    let totalTests = tests.length;
    
    for (const test of tests) {
        try {
            const result = await test.fn();
            if (result) {
                passedTests++;
            }
        } catch (error) {
            console.error(`❌ ${test.name} failed with error: ${error.message}`);
        }
    }
    
    console.log(`\n📊 Functional Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All functional tests passed!');
        console.log('\n✅ The radio button functionality appears to be properly implemented.');
        console.log('✅ All required JavaScript functions are present.');
        console.log('✅ HTML structure is correct.');
        console.log('✅ CSS classes are available.');
        console.log('✅ Radio button values are properly set.');
        return true;
    } else {
        console.log('💥 Some functional tests failed!');
        console.log('\n⚠️  There may be issues with the radio button implementation.');
        return false;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runFunctionalTests()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('💥 Functional test runner failed:', error.message);
            process.exit(1);
        });
}

module.exports = { runFunctionalTests };
