import './globals.css';

export const metadata = { title: 'JARVIS AI // Operating Core', description: 'Autonomous AI Assistant' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' className='dark'>
      <body className='bg-[#020814] text-white min-h-screen overflow-x-hidden font-sans'>{children}</body>
    </html>
  );
}
