import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Sketch",
  description: "A fun project to conver image to countour sketch",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
    >
      <body className="min-h-full flex flex-col">
          <Providers>
            {children}
          </Providers>
      </body>
    </html>
  );
}
