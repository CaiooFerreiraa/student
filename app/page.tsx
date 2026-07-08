import HomeStatics from "@/components/home-statics";
import HomeHero from "@/components/home-hero";

export default function Home() {
  return (
    <div className="mx-5">
      <HomeHero />
      <HomeStatics />
    </div>
  );
};
