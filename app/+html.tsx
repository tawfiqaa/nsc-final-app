import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * This file is web-only and used to configure the root HTML for every
 * web page during static rendering.
 * The contents of this function are injected into the global scope of the generated HTML.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />

        {/* PWA Tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1E1E1E" />

        {/* iOS PWA Support */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Splash screen styles */}
        <style dangerouslySetInnerHTML={{
          __html: `
                  #splash-screen {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background-color: #1E1E1E;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 9999;
                    transition: opacity 0.3s ease-out;
                  }
                  #splash-screen img {
                    width: 100px;
                    height: 100px;
                    border-radius: 20px;
                  }
                `}} />

        {/*
          This acts as a fallback/polyfill for Ionicons on the web if the local asset bundler fails.
          We use the official unpkg distribution for the font file.
        */}
        <style dangerouslySetInnerHTML={{
          __html: `
          @font-face {
            font-family: 'Ionicons';
            src: url('https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
          /* Sometimes react-native-web or expo-font uses lower case */
          @font-face {
            font-family: 'ionicons';
            src: url('https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
          }
        `}} />

        <ScrollViewStyleReset />

        {/* Add any other <meta> or <link> tags here */}
      </head>
      <body>
        {/* Minimal Splash / Loading Overlay */}
        <div id="splash-screen">
          <img src="/icons/icon-192.png" alt="Teacher Tracker Splash" />
        </div>

        {children}

        {/* Remove splash screen and register Service Worker */}
        <script dangerouslySetInnerHTML={{
          __html: `
                    window.addEventListener('load', () => {
                        const splash = document.getElementById('splash-screen');
                        if (splash) {
                            splash.style.opacity = '0';
                            setTimeout(() => splash.remove(), 300);
                        }

                        if ('serviceWorker' in navigator) {
                            navigator.serviceWorker.register('/sw.js').catch(err => {
                                console.error('Service Worker registration failed:', err);
                            });
                        }
                    });
                `}} />
      </body>
    </html>
  );
}
