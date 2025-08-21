const puppeteer = require('puppeteer');

async function runAutomatedTests() {
    console.log('🚀 Starting automated tests against meatpi...');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set viewport
        await page.setViewport({ width: 1280, height: 720 });
        
        // Enable console logging
        page.on('console', msg => {
            console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
        });
        
        // Navigate to the Bible page
        console.log('📄 Navigating to Bible page...');
        await page.goto('https://audio.juandelacruzjr.com/bible.html', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        // Wait for page to load
        await page.waitForTimeout(2000);
        
        // Test 1: Check if all radio buttons are present
        console.log('\n🧪 Test 1: Checking radio button presence...');
        const radioButtons = await page.$$('input[name="transcribeMode"]');
        console.log(`Found ${radioButtons.length} radio buttons`);
        
        if (radioButtons.length !== 3) {
            throw new Error(`Expected 3 radio buttons, found ${radioButtons.length}`);
        }
        
        // Test 2: Check initial state
        console.log('\n🧪 Test 2: Checking initial state...');
        const initialChecked = await page.$('input[name="transcribeMode"]:checked');
        if (initialChecked) {
            const initialValue = await initialChecked.evaluate(el => el.value);
            console.log(`Initial checked radio: ${initialValue}`);
        } else {
            console.log('No radio button initially checked');
        }
        
        // Test 3: Test "Specific Chapter" selection
        console.log('\n🧪 Test 3: Testing "Specific Chapter" selection...');
        await testSpecificChapter(page);
        
        // Test 4: Test "Multiple Chapters" selection
        console.log('\n🧪 Test 4: Testing "Multiple Chapters" selection...');
        await testMultipleChapters(page);
        
        // Test 5: Test "Entire Book" selection
        console.log('\n🧪 Test 5: Testing "Entire Book" selection...');
        await testEntireBook(page);
        
        console.log('\n✅ All tests completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

async function testSpecificChapter(page) {
    // Click on "Specific Chapter" radio button
    const chapterRadio = await page.$('input[name="transcribeMode"][value="chapter"]');
    if (!chapterRadio) {
        throw new Error('Specific Chapter radio button not found');
    }
    
    await chapterRadio.click();
    await page.waitForTimeout(1000);
    
    // Verify radio button is checked
    const isChecked = await chapterRadio.evaluate(el => el.checked);
    if (!isChecked) {
        throw new Error('Specific Chapter radio button not checked after click');
    }
    
    // Verify visual state
    const chapterOption = await page.$('#chapterOption');
    const hasSelectedBorder = await chapterOption.evaluate(el => 
        el.classList.contains('border-indigo-500')
    );
    if (!hasSelectedBorder) {
        throw new Error('Specific Chapter option does not have selected border');
    }
    
    // Verify status message
    const statusElement = await page.$('#status');
    if (statusElement) {
        const statusText = await statusElement.evaluate(el => el.textContent);
        if (!statusText.includes('Specific Chapter')) {
            throw new Error(`Status message incorrect: "${statusText}"`);
        }
    }
    
    // Verify input section is visible
    const chapterInput = await page.$('#chapterInput');
    const isVisible = await chapterInput.evaluate(el => 
        !el.classList.contains('hidden')
    );
    if (!isVisible) {
        throw new Error('Chapter input section not visible');
    }
    
    console.log('✅ Specific Chapter test passed');
}

async function testMultipleChapters(page) {
    // Click on "Multiple Chapters" radio button
    const chaptersRadio = await page.$('input[name="transcribeMode"][value="chapters"]');
    if (!chaptersRadio) {
        throw new Error('Multiple Chapters radio button not found');
    }
    
    await chaptersRadio.click();
    await page.waitForTimeout(1000);
    
    // Verify radio button is checked
    const isChecked = await chaptersRadio.evaluate(el => el.checked);
    if (!isChecked) {
        throw new Error('Multiple Chapters radio button not checked after click');
    }
    
    // Verify visual state
    const chaptersOption = await page.$('#chaptersOption');
    const hasSelectedBorder = await chaptersOption.evaluate(el => 
        el.classList.contains('border-indigo-500')
    );
    if (!hasSelectedBorder) {
        throw new Error('Multiple Chapters option does not have selected border');
    }
    
    // Verify status message
    const statusElement = await page.$('#status');
    if (statusElement) {
        const statusText = await statusElement.evaluate(el => el.textContent);
        if (!statusText.includes('Multiple Chapters')) {
            throw new Error(`Status message incorrect: "${statusText}"`);
        }
    }
    
    // Verify input section is visible
    const chaptersInput = await page.$('#chaptersInput');
    const isVisible = await chaptersInput.evaluate(el => 
        !el.classList.contains('hidden')
    );
    if (!isVisible) {
        throw new Error('Chapters input section not visible');
    }
    
    console.log('✅ Multiple Chapters test passed');
}

async function testEntireBook(page) {
    // Click on "Entire Book" radio button
    const bookRadio = await page.$('input[name="transcribeMode"][value="book"]');
    if (!bookRadio) {
        throw new Error('Entire Book radio button not found');
    }
    
    await bookRadio.click();
    await page.waitForTimeout(1000);
    
    // Verify radio button is checked
    const isChecked = await bookRadio.evaluate(el => el.checked);
    if (!isChecked) {
        throw new Error('Entire Book radio button not checked after click');
    }
    
    // Verify visual state
    const bookOption = await page.$('#bookOption');
    const hasSelectedBorder = await bookOption.evaluate(el => 
        el.classList.contains('border-indigo-500')
    );
    if (!hasSelectedBorder) {
        throw new Error('Entire Book option does not have selected border');
    }
    
    // Verify status message
    const statusElement = await page.$('#status');
    if (statusElement) {
        const statusText = await statusElement.evaluate(el => el.textContent);
        if (!statusText.includes('Entire Book')) {
            throw new Error(`Status message incorrect: "${statusText}"`);
        }
    }
    
    // Verify no input sections are visible
    const chapterInput = await page.$('#chapterInput');
    const chaptersInput = await page.$('#chaptersInput');
    
    const chapterInputHidden = await chapterInput.evaluate(el => 
        el.classList.contains('hidden')
    );
    const chaptersInputHidden = await chaptersInput.evaluate(el => 
        el.classList.contains('hidden')
    );
    
    if (!chapterInputHidden || !chaptersInputHidden) {
        throw new Error('Input sections should be hidden for Entire Book selection');
    }
    
    console.log('✅ Entire Book test passed');
}

// Run the tests
runAutomatedTests()
    .then(() => {
        console.log('\n🎉 All automated tests passed!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Automated tests failed:', error.message);
        process.exit(1);
    });
