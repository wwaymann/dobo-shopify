// pages/_app.js
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/globals.css';
import useIframeAutosize from '../hooks/useIframeAutosize';
import Head from 'next/head';

function MyApp({ Component, pageProps }) {
  useIframeAutosize();
  return (<>
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>
    <Component {...pageProps} />
  </>);
}

export default MyApp;
