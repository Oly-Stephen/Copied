// Function to get formatted and cleaned HTML
function getFormattedHTML() {
    // Get the HTML content
    let html = document.documentElement.outerHTML;
    
    // Basic cleanup
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    html = html.replace(/>\s+</g, '>\n<');
    
    return html;
}

// Function to collect all CSS
function getAllCSS() {
    let allCSS = '';
    
    // Get all stylesheet rules
    Array.from(document.styleSheets).forEach(stylesheet => {
        try {
            Array.from(stylesheet.cssRules || []).forEach(rule => {
                allCSS += rule.cssText + '\n';
            });
        } catch (e) {
            // Handle cross-origin stylesheets
            if (stylesheet.href) {
                allCSS += `/* External stylesheet: ${stylesheet.href} */\n`;
            }
        }
    });
    
    // Get inline styles
    const styles = document.getElementsByTagName('style');
    Array.from(styles).forEach(style => {
        allCSS += style.innerHTML + '\n';
    });
    
    return allCSS;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrape") {
        try {
            const html = getFormattedHTML();
            const css = getAllCSS();
            
            sendResponse({
                html: html,
                css: css
            });
        } catch (error) {
            sendResponse({
                html: "Error scraping HTML: " + error.message,
                css: "Error scraping CSS: " + error.message
            });
        }
    }
    return true; // Keep the message channel open for async response
});