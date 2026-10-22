import Image from 'next/image';

interface AuthTemplateProps {
  /** Full-screen background image, e.g. `/images/login.webp`. */
  backgroundSrc: string;
  children: React.ReactNode;
}

/**
 * Plain frame for the pages before login: a card on a full-screen scene,
 * without navigation, footer or branding. Narrow screens center the card over
 * the scene. Wide screens turn it into a full-height panel on the left, and
 * the scene's middle, where the motif is, moves into the free area.
 */
export function AuthTemplate({ backgroundSrc, children }: AuthTemplateProps) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      {/*
       * Extending the image to the right by the panel's width centers it on
       * the free area, while it still fills the space under the translucent
       * panel. Both widths have to match.
       */}
      <div className="absolute inset-0 xl:-right-120">
        <Image
          src={backgroundSrc}
          alt="Background"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>

      <main className="relative z-10 flex grow items-center justify-center px-4 py-10 sm:px-6 xl:w-120 xl:items-stretch xl:p-0">
        {children}
      </main>
    </div>
  );
}
