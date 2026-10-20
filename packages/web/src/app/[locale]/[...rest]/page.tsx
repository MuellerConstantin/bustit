import { notFound } from 'next/navigation';

/**
 * Catches every path that matches no page, so it gets the not-found page of
 * its locale inside the locale layout instead of Next.js' default one.
 */
export default function CatchAllPage() {
  notFound();
}
