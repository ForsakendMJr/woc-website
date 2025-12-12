// app/layout.js
import './globals.css';
import Navbar from './components/Navbar';
import { WocThemeProvider } from './WocThemeProvider';
import WocFloatingAssistant from './components/WocFloatingAssistant';

export const metadata = {
  title: 'World of Communities',
  description:
    'Discord adventure engine: clans, exams, duels, marriage, housing & more.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="theme-cosmic">
      {/* data-woc-mood is set/updated by WocThemeProvider on the client */}
      <body className="min-h-screen" data-woc-mood="story">
        <WocThemeProvider>
          <Navbar />
          <main className="woc-shell min-h-[calc(100vh-3.5rem)]">
            {children}
          </main>
          {/* optional: floating helper avatar */}
          <WocFloatingAssistant />
        </WocThemeProvider>
      </body>
    </html>
  );
}
