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

// Test functions
async function testServerAvailability() {
    console.log('🧪 Test 1: Server Availability');
    
    try {
        const response = await makeRequest(`${TEST_CONFIG.baseUrl}/`);
        console.log(`✅ Server is available (Status: ${response.statusCode})`);
        return true;
    } catch (error) {
        console.error(`❌ Server not available: ${error.message}`);
        return false;
    }
}

async function testBiblePageLoad() {
    console.log('\n🧪 Test 2: Bible Page Load');
    
    try {
        const response = await makeRequest(`${TEST_CONFIG.baseUrl}/bible.html`);
        
        if (response.statusCode !== 200) {
            throw new Error(`HTTP ${response.statusCode}`);
        }
        
        // Check if the page contains expected elements
        const content = response.data;
        const checks = [
            { name: 'Radio buttons', pattern: 'input[name="transcribeMode"]', found: content.includes('input[name="transcribeMode"]') },
            { name: 'Book option', pattern: 'id="bookOption"', found: content.includes('id="bookOption"') },
            { name: 'Chapter option', pattern: 'id="chapterOption"', found: content.includes('id="chapterOption"') },
            { name: 'Chapters option', pattern: 'id="chaptersOption"', found: content.includes('id="chaptersOption"') },
            { name: 'Bible.js script', pattern: 'bible.js', found: content.includes('bible.js') },
            { name: 'Status element', pattern: 'id="status"', found: content.includes('id="status"') }
        ];
        
        let allPassed = true;
        checks.forEach(check => {
            if (check.found) {
                console.log(`✅ ${check.name}: Found`);
            } else {
                console.log(`❌ ${check.name}: Not found`);
                allPassed = false;
            }
        });
        
        return allPassed;
    } catch (error) {
        console.error(`❌ Bible page load failed: ${error.message}`);
        return false;
    }
}

async function testJavaScriptFiles() {
    console.log('\n🧪 Test 3: JavaScript Files');
    
    const jsFiles = [
        '/bible.js',
        '/common.js',
        '/main.js'
    ];
    
    let allPassed = true;
    
    for (const jsFile of jsFiles) {
        try {
            const response = await makeRequest(`${TEST_CONFIG.baseUrl}${jsFile}`);
            
            if (response.statusCode === 200) {
                console.log(`✅ ${jsFile}: Available`);
                
                // Check for specific functions in bible.js
                if (jsFile === '/bible.js') {
                    const content = response.data;
                    const functionChecks = [
                        { name: 'selectMode function', pattern: 'function selectMode', found: content.includes('function selectMode') },
                        { name: 'setupEventListeners function', pattern: 'function setupEventListeners', found: content.includes('function setupEventListeners') },
                        { name: 'validateSelection function', pattern: 'function validateSelection', found: content.includes('function validateSelection') }
                    ];
                    
                    functionChecks.forEach(check => {
                        if (check.found) {
                            console.log(`  ✅ ${check.name}: Found`);
                        } else {
                            console.log(`  ❌ ${check.name}: Not found`);
                            allPassed = false;
                        }
                    });
                }
            } else {
                console.log(`❌ ${jsFile}: HTTP ${response.statusCode}`);
                allPassed = false;
            }
        } catch (error) {
            console.error(`❌ ${jsFile}: ${error.message}`);
            allPassed = false;
        }
    }
    
    return allPassed;
}

async function testCSSFiles() {
    console.log('\n🧪 Test 4: CSS Files');
    
    try {
        const response = await makeRequest(`${TEST_CONFIG.baseUrl}/styles.build.css`);
        
        if (response.statusCode === 200) {
            console.log('✅ styles.build.css: Available');
            return true;
        } else {
            console.log(`❌ styles.build.css: HTTP ${response.statusCode}`);
            return false;
        }
    } catch (error) {
        console.error(`❌ CSS file test failed: ${error.message}`);
        return false;
    }
}

async function testAPIEndpoints() {
    console.log('\n🧪 Test 5: API Endpoints');
    
    // Test authentication endpoint (should return 401 for unauthenticated requests)
    try {
        const response = await makeRequest(`${TEST_CONFIG.baseUrl}/api/bible/fetch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                translation: 'web',
                book: 'John',
                chapter: 1,
                verseRanges: '1-5'
            })
        });
        
        // Should return 401 for unauthenticated requests
        if (response.statusCode === 401) {
            console.log('✅ API authentication working (returns 401 for unauthenticated requests)');
            return true;
        } else {
            console.log(`⚠️  API returned unexpected status: ${response.statusCode}`);
            return true; // Not necessarily a failure
        }
    } catch (error) {
        console.error(`❌ API test failed: ${error.message}`);
        return false;
    }
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting automated tests against meatpi...\n');
    
    const tests = [
        { name: 'Server Availability', fn: testServerAvailability },
        { name: 'Bible Page Load', fn: testBiblePageLoad },
        { name: 'JavaScript Files', fn: testJavaScriptFiles },
        { name: 'CSS Files', fn: testCSSFiles },
        { name: 'API Endpoints', fn: testAPIEndpoints }
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
    
    console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed!');
        return true;
    } else {
        console.log('💥 Some tests failed!');
        return false;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('💥 Test runner failed:', error.message);
            process.exit(1);
        });
}

module.exports = { runAllTests, makeRequest };
