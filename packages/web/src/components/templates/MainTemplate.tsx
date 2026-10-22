import Image from 'next/image';
import { Footer } from '@/components/organisms/Footer';
import { Navbar } from '@/components/organisms/Navbar';

interface MainTemplateProps {
  /**
   * Scene behind the top of the page, e.g. `/images/home.webp`. Its edges fade
   * into the background, so it can be narrower than the screen.
   */
  backgroundSrc?: string;
  children?: React.ReactNode;
}

/** Frame for the pages behind the login: navigation, content and footer. */
export function MainTemplate({ backgroundSrc, children }: MainTemplateProps) {
  /*
   * Isolated, so the backgrounds' negative z-index puts them above this
   * frame's own background but below everything else in it.
   */
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background">
      {backgroundSrc && (
        /*
         * The scene blurred and dimmed across the whole window, so the sharp
         * image above can fade into it on any screen shape. Blurred, a small
         * variant scaled up looks the same as a large one. The scale keeps
         * the blur from fading out at the window's edges.
         */
        <div className="pointer-events-none fixed inset-0 -z-10">
          <Image
            src={backgroundSrc}
            alt=""
            fill
            sizes="640px"
            className="scale-110 object-cover blur-3xl"
          />
          <div className="absolute inset-0 bg-background/60" />
        </div>
      )}
      {backgroundSrc && (
        /*
         * Capped at the image's own width, so it isn't scaled up beyond it.
         * On narrow screens the minimum height wins over the aspect ratio and
         * the image is cropped to its middle. The sides only fade once the
         * screen is wider than the image; below that they are the screen's
         * edges. The masks intersect, so sides and bottom fade out together.
         */
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto aspect-1671/941 max-w-[1671px] min-h-112 mask-b-from-45% mask-b-to-100% min-[1671px]:mask-x-from-75% min-[1671px]:mask-x-to-100%">
          <Image
            src={backgroundSrc}
            alt=""
            fill
            priority
            sizes="(min-width: 1671px) 1671px, 100vw"
            className="object-cover"
          />
        </div>
      )}
      <Navbar />
      <main className="relative mx-auto flex w-full max-w-7xl grow flex-col px-4 py-8 sm:px-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
