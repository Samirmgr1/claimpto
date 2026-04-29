import { useEffect, useRef } from 'react';
import { useSettings } from '../../context/AuthContext';

/**
 * CustomCodeInjector
 * 
 * Dynamically injects admin-configured header code into <head> and
 * footer code before </body> in the Telegram Mini-App.
 * 
 * - Parses HTML strings and injects <style>, <link>, <meta>, <script>, and other elements
 * - Scripts are cloned to ensure browser execution (innerHTML scripts don't auto-execute)
 * - Cleans up previously injected elements on settings change to avoid duplicates
 */
function CustomCodeInjector() {
  const { settings } = useSettings();
  const headerElementsRef = useRef([]);
  const footerElementsRef = useRef([]);

  // Inject header code into <head>
  useEffect(() => {
    // Clean up previous header injections
    headerElementsRef.current.forEach(el => {
      try { el.parentNode?.removeChild(el); } catch (e) { /* ignore */ }
    });
    headerElementsRef.current = [];

    const headerCode = settings?.headerCode;
    if (!headerCode || !headerCode.trim()) return;

    headerElementsRef.current = parseAndInject(headerCode, document.head);

    return () => {
      headerElementsRef.current.forEach(el => {
        try { el.parentNode?.removeChild(el); } catch (e) { /* ignore */ }
      });
      headerElementsRef.current = [];
    };
  }, [settings?.headerCode]);

  // Inject footer code before </body>
  useEffect(() => {
    // Clean up previous footer injections
    footerElementsRef.current.forEach(el => {
      try { el.parentNode?.removeChild(el); } catch (e) { /* ignore */ }
    });
    footerElementsRef.current = [];

    const footerCode = settings?.footerCode;
    if (!footerCode || !footerCode.trim()) return;

    footerElementsRef.current = parseAndInject(footerCode, document.body);

    return () => {
      footerElementsRef.current.forEach(el => {
        try { el.parentNode?.removeChild(el); } catch (e) { /* ignore */ }
      });
      footerElementsRef.current = [];
    };
  }, [settings?.footerCode]);

  return null; // This component doesn't render anything visible
}

/**
 * Parse an HTML string and inject its elements into a target container.
 * Scripts are specially handled to ensure they execute in the browser.
 * 
 * @param {string} htmlString - Raw HTML/CSS/JS code to inject
 * @param {HTMLElement} target - DOM element to append children to
 * @returns {HTMLElement[]} - Array of injected elements for cleanup
 */
function parseAndInject(htmlString, target) {
  const injectedElements = [];

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
        
        // Copy all attributes
        Array.from(node.attributes).forEach(attr => {
          script.setAttribute(attr.name, attr.value);
        });

        // Add a marker attribute for identification
        script.setAttribute('data-custom-injected', 'true');

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
        // For non-script elements (style, link, meta, div, etc.), clone and append
        const clone = node.cloneNode(true);
        clone.setAttribute('data-custom-injected', 'true');
        target.appendChild(clone);
        injectedElements.push(clone);
      }
    });
  } catch (error) {
    console.error('[CustomCodeInjector] Failed to parse/inject code:', error);
  }

  return injectedElements;
}

export default CustomCodeInjector;



