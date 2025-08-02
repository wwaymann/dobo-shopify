
import Head from 'next/head'
import Image from 'next/image'
import { useState } from 'react'

export default function Home() {
  const [selectedPot, setSelectedPot] = useState('/pot1.png');
  const [selectedPlant, setSelectedPlant] = useState('/plant1.png');
  const [customText, setCustomText] = useState('Texto');

  const pots = ['/pot1.png', '/pot2.png', '/pot3.png'];
  const plants = ['/plant1.png', '/plant2.png', '/plant3.png'];

  return (
    <div className="min-h-screen bg-white text-gray-800 flex flex-col items-center p-4">
      <Head>
        <title>DOBO Custom</title>
      </Head>

      <h1 className="text-3xl font-bold mb-4">Personaliza tu DOBO</h1>

      <div className="relative w-full max-w-md aspect-square mb-4">
        <Image src={selectedPot} alt="Maceta" layout="fill" objectFit="contain" />
        <Image src={selectedPlant} alt="Planta" layout="fill" objectFit="contain" />
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-xl font-bold text-black opacity-60">
          {customText}
        </div>
      </div>

      <input
        type="text"
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
        className="border p-2 rounded w-full max-w-md mb-4"
        placeholder="Texto sobre la maceta"
      />

      <div className="w-full max-w-md overflow-x-auto mb-4">
        <h2 className="text-lg mb-2">Elige una maceta</h2>
        <div className="flex space-x-2">
          {pots.map((pot, index) => (
            <button key={index} onClick={() => setSelectedPot(pot)} className="w-24 h-24 relative border rounded overflow-hidden">
              <Image src={pot} alt={`Pot ${index}`} layout="fill" objectFit="contain" />
            </button>
          ))}
        </div>
      </div>

      <div className="w-full max-w-md overflow-x-auto mb-4">
        <h2 className="text-lg mb-2">Elige una planta</h2>
        <div className="flex space-x-2">
          {plants.map((plant, index) => (
            <button key={index} onClick={() => setSelectedPlant(plant)} className="w-24 h-24 relative border rounded overflow-hidden">
              <Image src={plant} alt={`Plant ${index}`} layout="fill" objectFit="contain" />
            </button>
          ))}
        </div>
      </div>

      <button className="bg-black text-white py-2 px-6 rounded mt-4">Comprar</button>
    </div>
  )
}
