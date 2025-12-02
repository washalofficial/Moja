import React, { useEffect, useRef } from 'react';

interface ScriptInjectorProps {
  html: string;
  className?: string;
  placementId?: string;
}

export const ScriptInjector: React.FC<ScriptInjectorProps> = ({ html, className = '', placementId = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useRef(`ad-${Math.random().toString(36).substr(2, 12)}`);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || !html || loadedRef.current) return;
    loadedRef.current = true;

    // Clear previous content
    containerRef.current.innerHTML = '';

    // Create a temporary container to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Extract scripts
    const scripts = Array.from(temp.querySelectorAll('script'));
    const inlineScripts: string[] = [];
    const externalScripts: { src: string; attrs: Record<string, string> }[] = [];

    scripts.forEach(script => {
      if (script.src) {
        const attrs: Record<string, string> = {};
        Array.from(script.attributes).forEach(attr => {
          if (attr.name !== 'src' && attr.name !== 'type') {
            attrs[attr.name] = attr.value;
          }
        });
        externalScripts.push({ src: script.src, attrs });
      } else if (script.textContent) {
        inlineScripts.push(script.textContent);
      }
    });

    if (containerRef.current) {
      // Add non-script HTML first
      Array.from(temp.childNodes).forEach(node => {
        if ((node as any).tagName !== 'SCRIPT' && node.nodeType === Node.ELEMENT_NODE) {
          const clone = (node as HTMLElement).cloneNode(true);
          containerRef.current?.appendChild(clone);
        }
      });

      // Execute inline scripts immediately (no delay for parallel loading)
      inlineScripts.forEach((content, index) => {
        const newScript = document.createElement('script');
        newScript.type = 'text/javascript';
        newScript.textContent = content;
        containerRef.current?.appendChild(newScript);
      });

      // Execute external scripts immediately after (still in parallel, just queued)
      externalScripts.forEach((script, index) => {
        const newScript = document.createElement('script');
        newScript.type = 'text/javascript';
        newScript.async = true;
        Object.entries(script.attrs).forEach(([key, value]) => {
          newScript.setAttribute(key, value);
        });
        newScript.src = script.src;
        containerRef.current?.appendChild(newScript);
      });
    }
  }, [html, placementId]);

  return (
    <div 
      ref={containerRef} 
      id={uniqueId.current} 
      className={className} 
      style={{ minHeight: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} 
    />
  );
};
