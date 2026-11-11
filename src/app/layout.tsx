import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import {PropsWithChildren, Suspense} from 'react';

import './globals.css';
import {QueryClientContextProvider} from '../contexts/query-client-context';
import {ToolsPanelWrapper} from '@/components/tools-panel-wrapper';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Sage Business Finance',
  description: 'Explore Sage Business Finance: set up your business, receive payments and manage financial services in a sandbox.',
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: '/favicon.svg',
  },
};

type RootLayoutProps = PropsWithChildren;

const RootLayout = ({children}: RootLayoutProps) => {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning={true}
    >
      <body className="min-h-full flex flex-col">
        <QueryClientContextProvider>
          <Suspense>
            <ToolsPanelWrapper>{children}</ToolsPanelWrapper>
          </Suspense>
        </QueryClientContextProvider>
        {process.env.NODE_ENV === 'development' && (
          <footer style={{padding:'16px 24px',textAlign:'center',fontSize:12,background:'#F5F7F6',color:'#045C19'}}>
            <a href="/source-exports/sage-business-finance-source.zip" download="sage-business-finance-source.zip" style={{textDecoration:'underline',textUnderlineOffset:3}}>Download source ZIP</a>
          </footer>
        )}
      </body>
    </html>
  );
};

export default RootLayout;
