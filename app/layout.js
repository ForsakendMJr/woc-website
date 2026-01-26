// app/layout.js
import "./globals.css";
import Navbar from "./components/Navbar";
import Providers from "./providers";
import { WocThemeProvider } from "./WocThemeProvider";
import WocFloatingAssistant from "./components/WocFloatingAssistant";

export const metadata = {
  title: "Web of Communities",
  description:
    "Discord adventure engine: clans, exams, duels, marriage, housing & more.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <WocThemeProvider>
            <Navbar />
            <main className="woc-shell min-h-[calc(100vh-3.5rem)]">
              {children}
            </main>
            <WocFloatingAssistant />
          </WocThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
