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
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

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
                {children}
            </body>
        </html>
    );
}
