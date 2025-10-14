// pages/_app.js
import 'bootstrap/dist/css/bootstrap.min.css';
import '../styles/globals.css';
import useIframeAutosize from '../hooks/useIframeAutosize';



function MyApp({ Component, pageProps }) {
  useIframeAutosize();
  return <Component {...pageProps} />;
}

export default MyApp;
