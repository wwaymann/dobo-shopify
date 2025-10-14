// pages/index.js
import Head from "next/head";
import dynamic from "next/dynamic";

const HomePage = dynamic(() => import("../features/home/HomePage"), { ssr: false });

export default function IndexPage() {
  return (
    <>
      <Head>
        <title>DOBO</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <HomePage />
    </>
  );
}
