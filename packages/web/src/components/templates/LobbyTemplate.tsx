import Image from 'next/image';
import { Footer } from '@/components/organisms/Footer';
import { Navbar } from '@/components/organisms/Navbar';

interface LobbyTemplateProps {
  children?: React.ReactNode;
}

/** Frame for the pages behind the login: navigation, content and footer. */
export function LobbyTemplate({ children }: LobbyTemplateProps) {
  /*
   * Isolated, so the backgrounds' negative z-index puts them above this
   * frame's own background but below everything else in it.
   */
  return (
    <div className="flex min-h-dvh flex-col overflow-hidden bg-background">
      <Navbar />
      <main className="relative mx-auto flex w-full max-w-7xl grow flex-col px-4 sm:px-6">
        <div className="pointer-events-none fixed inset-0 -z-10">
          <Image
            src={'/images/home.webp'}
            alt=""
            fill
            sizes="640px"
            className="scale-110 object-cover blur-3xl"
          />
          <div className="absolute inset-0 bg-background/60" />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-1 mx-auto h-[clamp(18rem,35vw,34rem)] max-w-[1671px] overflow-hidden mask-b-from-45% mask-b-to-100% min-[1671px]:mask-x-from-75% min-[1671px]:mask-x-to-100%"
        >
          <Image
            src={'/images/home.webp'}
            alt="Logo"
            fill
            priority
            sizes="(min-width: 1671px) 1671px, 100vw"
            className="object-cover object-[center_40%]"
          />
        </div>
        <div className="z-10 mt-48 pb-8 sm:mt-72">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
