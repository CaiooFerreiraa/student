import Navbar from "@/app/components/navbar";
import HomeStatics from "@/app/components/home-statics";
import HomeHero from "@/app/components/home-hero";

export default function Home() {
  return (
    <div className="flex w-full h-full">
      <Navbar />
      <div >
        <HomeHero />
        <HomeStatics />
      </div>
    </div>
  );
};
