// pages/index.js
import dynamic from "next/dynamic";
import Head from "next/head";

const HomePage = dynamic(() => import("../features/home/HomePage"), { ssr: false });

export default function IndexPage() {
  return (
    <>
      <Head>
        <title>DOBO</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <HomePage />
    </>
  );
}
