import '@coinbase/onchainkit/styles.css';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { type ReactNode } from 'react';
import { cookieToInitialState } from 'wagmi';
import { getConfig } from '../wagmi';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SubStream',
  description: 'AI managed Subscription',
};

// Force dynamic rendering to prevent hydration mismatches
export const dynamic = 'force-dynamic';

// Suppress specific hydration warnings in development
export const suppressHydrationWarning = true;

export default function RootLayout(props: { children: ReactNode }) {
  const initialState = cookieToInitialState(
    getConfig(),
    headers().get('cookie')
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body 
        className={`${inter.className} antialiased`}
        suppressHydrationWarning
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Remove Grammarly attributes before React hydration
              window.addEventListener('load', function() {
                const body = document.body;
                body.removeAttribute('data-new-gr-c-s-check-loaded');
                body.removeAttribute('data-gr-ext-installed');
              });
            `,
          }}
        />
        <Providers initialState={initialState}>
          {props.children}
        </Providers>
      </body>
    </html>
  );
}