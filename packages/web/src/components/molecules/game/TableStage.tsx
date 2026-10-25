'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

/* The table is laid out at this width and scaled to fit, whatever the window's. */
const REFERENCE_WIDTH = 1216;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.5;

interface TableStageProps {
  children: ReactNode;
}

/**
 * Fits the table into the space its parent gives it, both in width and in
 * height, by scaling it as a whole. The parent has to give it a definite
 * height, e.g. as a flex item.
 */
export function TableStage({ children }: TableStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState({ width: 0, height: 0 });
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    const hostElement = hostRef.current;
    const contentElement = contentRef.current;

    if (!hostElement || !contentElement) {
      return;
    }

    const hostObserver = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }

      setHost({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    // The content's own height ignores the scale, so it is the table's natural one.
    const contentObserver = new ResizeObserver(() => {
      setContentHeight(contentElement.offsetHeight);
    });

    hostObserver.observe(hostElement);
    contentObserver.observe(contentElement);

    return () => {
      hostObserver.disconnect();
      contentObserver.disconnect();
    };
  }, []);

  const isMeasured = host.width > 0 && contentHeight > 0;
  const byWidth = host.width / REFERENCE_WIDTH;
  const byHeight = isMeasured ? host.height / contentHeight : byWidth;
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Math.min(byWidth, byHeight)),
  );

  return (
    <div ref={hostRef} className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div
        // Hidden until measured, so the table doesn't show at the wrong size for a moment.
        className={isMeasured ? 'mx-auto my-auto' : 'invisible mx-auto my-auto'}
        style={{
          width: REFERENCE_WIDTH * scale,
          height: contentHeight * scale,
        }}
      >
        <div
          ref={contentRef}
          style={{
            width: REFERENCE_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
