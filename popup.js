document.addEventListener('DOMContentLoaded', function() {
    const scrapeButton = document.getElementById('scrapeButton');
    const htmlOutput = document.getElementById('htmlOutput');
    const cssOutput = document.getElementById('cssOutput');
    const jsOutput = document.getElementById('jsOutput');
    const copyHtmlBtn = document.getElementById('copyHtmlBtn');
    const copyCssBtn = document.getElementById('copyCssBtn');
    const copyJsBtn = document.getElementById('copyJsBtn');
    
    // Checkboxes
    const htmlCheck = document.getElementById('htmlCheck');
    const cssCheck = document.getElementById('cssCheck');
    const jsCheck = document.getElementById('jsCheck');

    // Sections
    const htmlSection = document.querySelector('.html-section');
    const cssSection = document.querySelector('.css-section');
    const jsSection = document.querySelector('.js-section');

    // Toggle section visibility based on checkboxes
    function updateSections() {
        htmlSection.classList.toggle('hidden', !htmlCheck.checked);
        cssSection.classList.toggle('hidden', !cssCheck.checked);
        jsSection.classList.toggle('hidden', !jsCheck.checked);
    }

    // Add listeners to checkboxes
    [htmlCheck, cssCheck, jsCheck].forEach(checkbox => {
        checkbox.addEventListener('change', updateSections);
    });

    // Initial section visibility
    updateSections();

    scrapeButton.addEventListener('click', async function() {
        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            
            if (!tab?.id) {
                throw new Error('No active tab found');
            }

            // Inject the content script
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: scrapeContent
            });

            // Get the scraped content based on selected options
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: "scrape",
                options: {
                    html: htmlCheck.checked,
                    css: cssCheck.checked,
                    js: jsCheck.checked
                }
            });
            
            if (response) {
                if (htmlCheck.checked) {
                    htmlOutput.value = response.html || "No HTML content found";
                }
                if (cssCheck.checked) {
                    cssOutput.value = response.css || "No CSS content found";
                }
                if (jsCheck.checked) {
                    jsOutput.value = response.js || "No JavaScript content found";
                }
            }
        } catch (error) {
            console.error('Scraping error:', error);
            const errorMsg = "Error: Could not scrape page. Please refresh the page and try again.";
            htmlOutput.value = errorMsg;
            cssOutput.value = errorMsg;
            jsOutput.value = errorMsg;
        }
    });

    // Copy buttons
    copyHtmlBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(htmlOutput.value)
            .catch(err => console.error('Failed to copy HTML:', err));
    });

    copyCssBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(cssOutput.value)
            .catch(err => console.error('Failed to copy CSS:', err));
    });

    copyJsBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(jsOutput.value)
            .catch(err => console.error('Failed to copy JavaScript:', err));
    });
});

function scrapeContent() {
    if (window.hasScraperLoaded) return;
    window.hasScraperLoaded = true;

    function getOriginalHTML() {
        // Get only the original HTML structure
        let html = document.documentElement.cloneNode(true);
        
        // Remove all script tags
        const scripts = html.getElementsByTagName('script');
        while(scripts.length > 0) {
            scripts[0].parentNode.removeChild(scripts[0]);
        }
        
        // Remove extension-specific elements
        const extensionElements = html.querySelectorAll('[class*="chrome-extension"]');
        extensionElements.forEach(el => el.remove());
        
        // Clean up and format
        let htmlString = html.outerHTML;
        htmlString = htmlString.replace(/>\s+</g, '>\n<');
        return htmlString;
    }

    function getOriginalCSS() {
        let allCSS = '';
        
        // Only process stylesheets from the original domain
        Array.from(document.styleSheets).forEach(stylesheet => {
            try {
                // Skip extension stylesheets
                if (stylesheet.href && stylesheet.href.includes('chrome-extension://')) {
                    return;
                }
                
                Array.from(stylesheet.cssRules || []).forEach(rule => {
                    allCSS += rule.cssText + '\n';
                });
            } catch (e) {
                if (stylesheet.href) {
                    allCSS += `/* External stylesheet: ${stylesheet.href} */\n`;
                }
            }
        });
        
        return allCSS;
    }

    function getOriginalJS() {
        let allJS = '';
        
        // Get all script tags
        const scripts = document.getElementsByTagName('script');
        Array.from(scripts).forEach(script => {
            // Skip extension scripts
            if (script.src && script.src.includes('chrome-extension://')) {
                return;
            }
            
            if (script.src) {
                allJS += `// External script: ${script.src}\n`;
            } else if (script.textContent) {
                allJS += `${script.textContent}\n`;
            }
        });
        
        return allJS;
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "scrape") {
            try {
                const response = {};
                
                if (request.options.html) {
                    response.html = getOriginalHTML();
                }
                if (request.options.css) {
                    response.css = getOriginalCSS();
                }
                if (request.options.js) {
                    response.js = getOriginalJS();
                }
                
                sendResponse(response);
            } catch (error) {
                sendResponse({
                    error: "Error scraping content: " + error.message
                });
            }
        }
        return true;
    });
}