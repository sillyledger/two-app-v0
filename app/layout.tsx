import type { Metadata } from 'next'
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({ 
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: 'TWO — Write better. Think clearer.',
  description: 'Beautiful docs for individuals and small teams who live on Apple devices. Fast, focused, and nothing you don\'t need.',
  applicationName: 'TWO',
  icons: {
    icon: '/logo-two.svg',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark bg-background ${instrumentSerif.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-title" content="TWO" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script src="https://cdn.paddle.com/paddle/v2/paddle.js" async />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'light') {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                  } else {
                    document.documentElement.classList.remove('light');
                    document.documentElement.classList.add('dark');
                  }
                  var fontSize = localStorage.getItem('font-size');
                  if (fontSize === 'small') {
                    document.documentElement.style.fontSize = '13px';
                  } else if (fontSize === 'large') {
                    document.documentElement.style.fontSize = '17px';
                  } else {
                    document.documentElement.style.fontSize = '';
                  }
                } catch(e) {}
              })();
              window.addEventListener('load', function() {
                var interval = setInterval(function() {
                  if (window.Paddle) {
                    clearInterval(interval);
                    window.Paddle.Environment.set('production');
                    window.Paddle.Initialize({ token: 'live_5d79c55970d6730fce490b94bc1' });
                  }
                }, 100);
              });
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
