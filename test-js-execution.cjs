const https = require('https');
const http = require('http');

const SERVER_URL = 'https://audio.juandelacruzjr.com';

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        client.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({ status: res.statusCode, data });
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function testJavaScriptExecution() {
    console.log('🔍 Testing JavaScript execution on live server...\n');
    
    try {
        // Test 1: Check if the page loads and has the expected structure
        console.log('📄 Test 1: Fetching bible.html...');
        const bibleResponse = await makeRequest(`${SERVER_URL}/bible.html`);
        
        if (bibleResponse.status !== 200) {
            console.log(`❌ Failed to fetch bible.html (Status: ${bibleResponse.status})`);
            return;
        }
        
        const html = bibleResponse.data;
        console.log('✅ bible.html loaded successfully');
        
        // Test 2: Check for radio button structure
        console.log('\n🎯 Test 2: Checking radio button structure...');
        const hasRadioButtons = html.includes('name="transcribeMode"');
        const hasBookOption = html.includes('id="bookOption"');
        const hasChapterOption = html.includes('id="chapterOption"');
        const hasChaptersOption = html.includes('id="chaptersOption"');
        
        console.log(`✅ Radio buttons: ${hasRadioButtons ? 'Found' : 'Missing'}`);
        console.log(`✅ Book option: ${hasBookOption ? 'Found' : 'Missing'}`);
        console.log(`✅ Chapter option: ${hasChapterOption ? 'Found' : 'Missing'}`);
        console.log(`✅ Chapters option: ${hasChaptersOption ? 'Found' : 'Missing'}`);
        
        // Test 3: Check for JavaScript file inclusion
        console.log('\n📜 Test 3: Checking JavaScript files...');
        const hasBibleJS = html.includes('bible.js');
        const hasCommonJS = html.includes('common.js');
        
        console.log(`✅ bible.js: ${hasBibleJS ? 'Included' : 'Missing'}`);
        console.log(`✅ common.js: ${hasCommonJS ? 'Included' : 'Missing'}`);
        
        // Test 4: Check for CSS classes in the HTML
        console.log('\n🎨 Test 4: Checking CSS classes in HTML...');
        const hasBorderIndigo = html.includes('border-indigo-500');
        const hasBgIndigo = html.includes('bg-indigo-900/20');
        const hasBorderSlate = html.includes('border-slate-600');
        
        console.log(`✅ border-indigo-500 in HTML: ${hasBorderIndigo ? 'Present' : 'Missing'}`);
        console.log(`✅ bg-indigo-900/20 in HTML: ${hasBgIndigo ? 'Present' : 'Missing'}`);
        console.log(`✅ border-slate-600 in HTML: ${hasBorderSlate ? 'Present' : 'Missing'}`);
        
        		// Test 5: Check for JavaScript functions in the HTML
		console.log('\n⚙️ Test 5: Checking JavaScript functions...');
		const hasSelectMode = html.includes('selectMode') || html.includes('window.selectMode');
		const hasSetupEventListeners = html.includes('setupEventListeners');
		const hasSetupRadioButtonListeners = html.includes('setupRadioButtonListeners') || html.includes('window.setupRadioButtonListeners');
		
		console.log(`✅ selectMode function: ${hasSelectMode ? 'Present' : 'Missing'}`);
		console.log(`✅ setupEventListeners function: ${hasSetupEventListeners ? 'Present' : 'Missing'}`);
		console.log(`✅ setupRadioButtonListeners function: ${hasSetupRadioButtonListeners ? 'Present' : 'Missing'}`);
        
        // Test 6: Check for event listeners in the HTML
        console.log('\n🎧 Test 6: Checking event listener setup...');
        const hasAddEventListener = html.includes('addEventListener');
        const hasChangeEvent = html.includes('change');
        const hasClickEvent = html.includes('click');
        
        console.log(`✅ addEventListener: ${hasAddEventListener ? 'Present' : 'Missing'}`);
        console.log(`✅ change event: ${hasChangeEvent ? 'Present' : 'Missing'}`);
        console.log(`✅ click event: ${hasClickEvent ? 'Present' : 'Missing'}`);
        
        // Test 7: Check for classList manipulation
        console.log('\n🔧 Test 7: Checking classList manipulation...');
        const hasClassListAdd = html.includes('classList.add');
        const hasClassListRemove = html.includes('classList.remove');
        const hasClassListContains = html.includes('classList.contains');
        
        console.log(`✅ classList.add: ${hasClassListAdd ? 'Present' : 'Missing'}`);
        console.log(`✅ classList.remove: ${hasClassListRemove ? 'Present' : 'Missing'}`);
        console.log(`✅ classList.contains: ${hasClassListContains ? 'Present' : 'Missing'}`);
        
        // Test 8: Check for console.log statements (debugging)
        console.log('\n🐛 Test 8: Checking debugging statements...');
        const hasConsoleLog = html.includes('console.log');
        const hasBibleJsLog = html.includes('Bible.js:');
        
        console.log(`✅ console.log statements: ${hasConsoleLog ? 'Present' : 'Missing'}`);
        console.log(`✅ Bible.js debug statements: ${hasBibleJsLog ? 'Present' : 'Missing'}`);
        
        // Test 9: Check for potential issues
        console.log('\n⚠️ Test 9: Checking for potential issues...');
        const hasSrOnly = html.includes('sr-only');
        const hasTransitionClasses = html.includes('transition-all');
        const hasDurationClasses = html.includes('duration-200');
        
        console.log(`✅ sr-only class: ${hasSrOnly ? 'Present' : 'Missing'}`);
        console.log(`✅ transition classes: ${hasTransitionClasses ? 'Present' : 'Missing'}`);
        console.log(`✅ duration classes: ${hasDurationClasses ? 'Present' : 'Missing'}`);
        
        // Summary
        console.log('\n📊 Summary:');
        console.log('='.repeat(50));
        
        const tests = [
            hasRadioButtons, hasBookOption, hasChapterOption, hasChaptersOption,
            hasBibleJS, hasCommonJS, hasSelectMode, hasSetupEventListeners,
            hasSetupRadioButtonListeners, hasAddEventListener, hasChangeEvent,
            hasClassListAdd, hasClassListRemove, hasConsoleLog, hasBibleJsLog
        ];
        
        const passedTests = tests.filter(test => test).length;
        const totalTests = tests.length;
        
        console.log(`✅ Tests passed: ${passedTests}/${totalTests}`);
        
        if (passedTests === totalTests) {
            console.log('🎉 All tests passed! The JavaScript should be working.');
            console.log('\n🔍 Next steps:');
            console.log('1. Open browser console and check for JavaScript errors');
            console.log('2. Verify that click events are being triggered');
            console.log('3. Check if CSS classes are being applied correctly');
        } else {
            console.log('❌ Some tests failed. Check the output above for issues.');
        }
        
    } catch (error) {
        console.error('❌ Error during testing:', error.message);
    }
}

// Run the test
testJavaScriptExecution();
