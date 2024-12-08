document.addEventListener('DOMContentLoaded', function() {
    // Get all elements
    const scrapeButton = document.getElementById('scrapeButton');
    const htmlOutput = document.getElementById('htmlOutput');
    const cssOutput = document.getElementById('cssOutput');
    const jsOutput = document.getElementById('jsOutput');
    const htmlCheck = document.getElementById('htmlCheck');
    const cssCheck = document.getElementById('cssCheck');
    const jsCheck = document.getElementById('jsCheck');
    const toast = document.getElementById('toast');

    // Tab functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const tabId = `${button.dataset.tab}Tab`;
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Scrape button functionality
    scrapeButton.addEventListener('click', async function() {
        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            
            if (!tab?.id) {
                throw new Error('No active tab found');
            }

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: scrapeContent
            });

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

    // Copy button functionality
    document.querySelectorAll('.copy-btn').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            const textarea = document.getElementById(targetId);
            navigator.clipboard.writeText(textarea.value)
                .then(() => {
                    showToast();
                })
                .catch(err => console.error('Failed to copy:', err));
        });
    });

    // Preview button functionality
    document.querySelectorAll('.preview-btn').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.target;
            const textarea = document.getElementById(targetId);
            const type = targetId.replace('Output', '').toLowerCase();
            previewContent(textarea.value, type);
        });
    });

    // Toast functionality
    function showToast() {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
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

function previewContent(content, type) {
    // Create a blob URL for the content
    const getPreviewHTML = () => {
        switch (type) {
            case 'html':
                return `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>HTML Preview</title>
                        <style>
                            /* CSS Reset */
                            *, *::before, *::after { box-sizing: border-box; }
                            body { margin: 0; line-height: 1.5; }
                        </style>
                    </head>
                    <body>
                        ${content}
                        <script>
                            // Make external links work in preview
                            document.querySelectorAll('a').forEach(link => {
                                if (link.href) {
                                    link.target = '_blank';
                                }
                            });
                        </script>
                    </body>
                    </html>
                `;
            case 'css':
                return `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>CSS Preview</title>
                        <style>${content}</style>
                    </head>
                    <body>
                        <div class="preview-container">
                            <h1>CSS Preview</h1>
                            <div class="demo-elements">
                                <h2>Heading Level 2</h2>
                                <h3>Heading Level 3</h3>
                                <p>This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
                                <div class="button-container">
                                    <button>Button 1</button>
                                    <button>Button 2</button>
                                </div>
                                <ul>
                                    <li>List Item 1</li>
                                    <li>List Item 2</li>
                                    <li>List Item 3</li>
                                </ul>
                                <form>
                                    <input type="text" placeholder="Text input">
                                    <input type="checkbox" id="check"><label for="check">Checkbox</label>
                                    <select>
                                        <option>Select Option 1</option>
                                        <option>Select Option 2</option>
                                    </select>
                                </form>
                            </div>
                        </div>
                    </body>
                    </html>
                `;
            case 'js':
                return `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>JavaScript Preview</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            #console { 
                                background: #f5f5f5; 
                                padding: 15px; 
                                border-radius: 5px;
                                margin: 10px 0;
                                min-height: 100px;
                                max-height: 300px;
                                overflow-y: auto;
                            }
                            .error { color: #ff0000; }
                            .log { color: #333; }
                        </style>
                    </head>
                    <body>
                        <h1>JavaScript Preview</h1>
                        <div id="console"></div>
                        <script>
                            const consoleDiv = document.getElementById('console');
                            const originalConsole = { ...console };
                            
                            function logToElement(type, ...args) {
                                const line = document.createElement('div');
                                line.className = type;
                                line.textContent = args.map(arg => 
                                    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
                                ).join(' ');
                                consoleDiv.appendChild(line);
                                originalConsole[type](...args);
                            }

                            console.log = (...args) => logToElement('log', ...args);
                            console.error = (...args) => logToElement('error', ...args);
                            console.warn = (...args) => logToElement('warn', ...args);

                            try {
                                ${content}
                            } catch (error) {
                                console.error('Error:', error.message);
                            }
                        </script>
                    </body>
                    </html>
                `;
        }
    };

    // Create blob URL
    const blob = new Blob([getPreviewHTML()], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);

    // Open preview in a new window with specific dimensions
    const width = 1024;
    const height = 768;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;

    const previewWindow = window.open(
        blobUrl,
        '_blank',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
    );

    if (!previewWindow) {
        alert('Pop-up blocked! Please allow pop-ups for this site.');
        return;
    }

    // Clean up the blob URL when the window is closed
    previewWindow.onbeforeunload = () => {
        URL.revokeObjectURL(blobUrl);
    };
}