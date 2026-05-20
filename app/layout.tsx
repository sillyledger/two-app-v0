import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import ClientErrorListener from '@/components/client-error-listener'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'TWO - Notes',
  description: 'A beautiful note-taking app',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark bg-background">
      <body className="font-sans antialiased bg-background">
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            function send(payload){
              try{ navigator.sendBeacon && navigator.sendBeacon('/api/client-error', JSON.stringify(payload)) || fetch('/api/client-error',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(()=>{}) }catch(e){}
            }
            window.addEventListener('error', function(ev){ send({type:'error', message: ev.message, filename: ev.filename, lineno: ev.lineno, colno: ev.colno, stack: (ev.error && ev.error.stack) || null}) })
            window.addEventListener('unhandledrejection', function(ev){ var reason = ev.reason; send({type:'unhandledrejection', reason: typeof reason === 'string' ? reason : (reason && reason.message) || String(reason), stack: reason && reason.stack}) })
          })();
        ` }} />
        <ClientErrorListener />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
