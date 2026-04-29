/**
 * DOM Injector Utility
 * 
 * Shared utility for safely injecting HTML/JS ad codes and custom code
 * into the DOM. Handles script execution properly since innerHTML scripts
 * don't auto-execute in browsers.
 * 
 * Supports all ad networks: AdSense, BitMedia, Coinzilla, CryptoCoinAds,
 * A-ADS, CoinTraffic, Adsterra, PropellerAds, Monetag, etc.
 */

/**
 * Parse an HTML string and inject its elements into a target container.
 * Scripts are specially handled to ensure they execute in the browser.
 * 
 * @param {string} htmlString - Raw HTML/CSS/JS code to inject
 * @param {HTMLElement} target - DOM element to append children to
 * @param {string} [markerAttr='data-custom-injected'] - Attribute to mark injected elements
 * @returns {HTMLElement[]} - Array of injected elements for cleanup
 */
export function parseAndInject(htmlString, target, markerAttr = 'data-custom-injected') {
  const injectedElements = [];

  if (!htmlString || !htmlString.trim() || !target) {
    return injectedElements;
  }

  try {
    // Use DOMParser to safely parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // Collect all elements from <head> and <body> of parsed document
    const allElements = [
      ...Array.from(doc.head.childNodes),
      ...Array.from(doc.body.childNodes)
    ];

    allElements.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        // Skip whitespace-only text nodes
        if (!node.textContent.trim()) return;
        const textNode = document.createTextNode(node.textContent);
        target.appendChild(textNode);
        injectedElements.push(textNode);
        return;
      }

      if (node.nodeType === Node.COMMENT_NODE) {
        const comment = document.createComment(node.textContent);
        target.appendChild(comment);
        injectedElements.push(comment);
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      if (node.tagName === 'SCRIPT') {
        // Scripts inserted via innerHTML don't execute - must create fresh script elements
        const script = document.createElement('script');

        // Copy all attributes (handles async, defer, data-*, type, etc.)
        Array.from(node.attributes).forEach(attr => {
          script.setAttribute(attr.name, attr.value);
        });

        // Add a marker attribute for identification and cleanup
        script.setAttribute(markerAttr, 'true');

        if (node.src) {
          // External script
          script.src = node.src;
        } else {
          // Inline script
          script.textContent = node.textContent;
        }

        target.appendChild(script);
        injectedElements.push(script);
      } else {
        // For non-script elements (style, link, meta, div, ins, iframe, etc.), clone and append
        const clone = node.cloneNode(true);
        if (clone.setAttribute) {
          clone.setAttribute(markerAttr, 'true');
        }
        target.appendChild(clone);
        injectedElements.push(clone);

        // If the cloned element contains script tags, they won't execute
        // We need to find and re-create them
        if (clone.querySelectorAll) {
          const nestedScripts = clone.querySelectorAll('script');
          nestedScripts.forEach(nestedScript => {
            const freshScript = document.createElement('script');
            Array.from(nestedScript.attributes).forEach(attr => {
              freshScript.setAttribute(attr.name, attr.value);
            });
            freshScript.setAttribute(markerAttr, 'true');
            if (nestedScript.src) {
              freshScript.src = nestedScript.src;
            } else {
              freshScript.textContent = nestedScript.textContent;
            }
            nestedScript.parentNode.replaceChild(freshScript, nestedScript);
          });
        }
      }
    });
  } catch (error) {
    console.error('[DOMInjector] Failed to parse/inject code:', error);
  }

  return injectedElements;
}

/**
 * Remove previously injected elements from the DOM.
 * 
 * @param {HTMLElement[]} elements - Array of elements to remove
 */
export function cleanupInjectedElements(elements) {
  if (!elements || !Array.isArray(elements)) return;
  
  elements.forEach(el => {
    try {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });
}

const domInjector = { parseAndInject, cleanupInjectedElements };
export default domInjector;

