// pages/index.js — entry
import Head from "next/head";
import dynamic from "next/dynamic";

// Cargamos HomePage sin SSR para evitar acceso a window/document en build
const HomePage = dynamic(() => import("../features/home/HomePage"), { ssr: false });

export default function Index() {
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
