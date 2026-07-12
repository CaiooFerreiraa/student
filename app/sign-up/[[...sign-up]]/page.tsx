import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#e9efff_0%,#f5f7fb_48%)] px-4 py-10">
      <SignUp fallbackRedirectUrl="/" />
    </main>
  );
}
