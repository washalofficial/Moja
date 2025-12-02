import React, { useEffect, useRef } from 'react';

interface AdIframeProps {
  html: string;
  placementId: string;
  width?: number;
  height?: number;
}

export const AdIframe: React.FC<AdIframeProps> = ({ html, placementId, width = 320, height = 100 }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!iframeRef.current || !html || loadedRef.current) return;
    loadedRef.current = true;

    const iframe = iframeRef.current;

    // Set iframe dimensions
    iframe.width = width.toString();
    iframe.height = height.toString();
    iframe.style.border = 'none';
    iframe.style.display = 'block';

    // Wait for iframe to load, then inject content
    const injectContent = () => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          setTimeout(injectContent, 10);
          return;
        }

        // Create complete HTML document with the ad script
        const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: transparent; }
    html { margin: 0; padding: 0; }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

        iframeDoc.open();
        iframeDoc.write(fullHtml);
        iframeDoc.close();
      } catch (e) {
        console.error('Failed to inject iframe content:', e);
      }
    };

    injectContent();
  }, [html, placementId, width, height]);

  return (
    <iframe
      ref={iframeRef}
      title={`ad-${placementId}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        border: 'none',
        display: 'block',
      }}
      loading="lazy"
    />
  );
};
