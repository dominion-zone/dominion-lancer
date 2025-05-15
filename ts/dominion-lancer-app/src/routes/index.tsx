import { createFileRoute } from "@tanstack/solid-router";
import createEmblaCarousel from "embla-carousel-solid";
import Autoplay from "embla-carousel-autoplay";
import carouselStyle from "~/styles/Carousel.module.css";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [emblaRef] = createEmblaCarousel(
    () => ({ loop: true }),
    () => [Autoplay({ delay: 5000 })]
  );
  return (
    <main>
      <div class={carouselStyle.carousel} ref={emblaRef}>
        <div class={carouselStyle.carouselContainer}>
          <div classList={{ [carouselStyle.carouselSlide]: true, card: true }}>
            <h3>
              Keeping the SUI Blockchain safe by confidentially reporting
              vulnerabilities
            </h3>
            <img alt="Sui security" src="/1.png" />
          </div>
          <div classList={{ [carouselStyle.carouselSlide]: true, card: true }}>
            <h3>
              Privately verify blockchain vulnerabilities through secure AWS
              Nitro Enclave simulations
            </h3>
            <img alt="AWS Nitro Enclaves" src="/2.png" />
          </div>
          <div classList={{ [carouselStyle.carouselSlide]: true, card: true }}>
            <h3>
              Quick and secure delivery of critical bug reports — directly to the verified protocol owners
            </h3>
            <img alt="Communication" src="/3.png" />
          </div>
          <div classList={{ [carouselStyle.carouselSlide]: true, card: true }}>
            <h3>
              Encrypted vulnerability reports stored securely and verified on-chain
            </h3>
            <img alt="Communication" src="/4.png" />
          </div>
          <div classList={{ [carouselStyle.carouselSlide]: true, card: true }}>
            <h3>
              Building Trust Between Ethical Hackers and Protocol Developers
            </h3>
            <img alt="Communication" src="/5.png" />
          </div>
        </div>
      </div>
    </main>
  );
}
