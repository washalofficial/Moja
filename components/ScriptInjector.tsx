import React, { useEffect, useRef } from 'react';

interface ScriptInjectorProps {
  html: string;
  className?: string;
}

export const ScriptInjector: React.FC<ScriptInjectorProps> = ({ html, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !html) return;

    // Clear previous content
    containerRef.current.innerHTML = '';

    // Create a temporary container to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Process all nodes
    const processNodes = (nodes: NodeList, target: HTMLElement) => {
      nodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const elem = node as HTMLElement;
          
          if (elem.tagName === 'SCRIPT') {
            // Create a new script element
            const script = document.createElement('script');
            script.type = elem.getAttribute('type') || 'text/javascript';
            
            // Copy attributes
            Array.from(elem.attributes).forEach(attr => {
              if (attr.name !== 'type') {
                script.setAttribute(attr.name, attr.value);
              }
            });
            
            // Copy content for inline scripts
            if (elem.textContent) {
              script.textContent = elem.textContent;
            }
            
            target.appendChild(script);
          } else {
            // Clone non-script elements
            const clone = elem.cloneNode(false) as HTMLElement;
            processNodes(elem.childNodes, clone);
            target.appendChild(clone);
          }
        } else if (node.nodeType === Node.TEXT_NODE) {
          target.appendChild(node.cloneNode(true));
        }
      });
    };

    processNodes(temp.childNodes, containerRef.current);
  }, [html]);

  return <div ref={containerRef} className={className} />;
};
