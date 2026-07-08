import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-br" className={cn("font-sans", geist.variable)}
    >
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
      <body className="min-h-full min-w-full" suppressHydrationWarning>
        <SidebarProvider>
          <AppSidebar />
            <main className="w-full">
              <SidebarTrigger />
              {children}
            </main>
        </SidebarProvider>
      </body>
    </html>
  );
}