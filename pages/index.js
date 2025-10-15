// pages/index.js
import React from "react";
import Head from "next/head";
import dynamic from "next/dynamic";

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