'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

/*
 * The wide table is laid out at this width and scaled to fit, so its layout
 * rules, which follow the container's width, always see the same size.
 */
const REFERENCE_WIDTH = 1216;
const STAGE_MIN_WIDTH = 1024;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.5;

interface TableStageProps {
  children: ReactNode;
}

/**
 * Fits the table into the space its parent gives it, both in width and in
 * height, by scaling it as a whole. The parent has to give it a definite
 * height, e.g. as a flex item. Where the space is narrower than a wide table
 * needs, the table isn't scaled and flows in the container's width instead.
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

  const isScaled = host.width >= STAGE_MIN_WIDTH;
  const byWidth = host.width / REFERENCE_WIDTH;
  const byHeight = contentHeight > 0 ? host.height / contentHeight : byWidth;
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Math.min(byWidth, byHeight)),
  );

  return (
    <div ref={hostRef} className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div
        className="mx-auto my-auto"
        style={
          isScaled
            ? {
                width: REFERENCE_WIDTH * scale,
                height: contentHeight * scale,
              }
            : { width: '100%' }
        }
      >
        <div
          ref={contentRef}
          className="@container"
          style={
            isScaled
              ? {
                  width: REFERENCE_WIDTH,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }
              : undefined
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
