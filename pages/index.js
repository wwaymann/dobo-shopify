import { useState } from "react";

export default function Home() {
  const [text, setText] = useState("DOBO");

  return (
    <div className="min-h-screen bg-[#f5f3ef] font-sans px-4 py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <img src="/logo-dobo.png" alt="DOBO logo" className="w-10 h-10" />
          <div>
            <h1 className="text-lg font-bold leading-tight">DOBO</h1>
            <p className="text-xs text-gray-500">Planta una idea</p>
          </div>
        </div>
        <div className="text-3xl">&#9776;</div>
      </header>

      {/* Scrollable macetas */}
      <h2 className="font-semibold text-lg mb-2">Elige tu maceta</h2>
      <div className="flex gap-2 overflow-x-auto mb-4 pb-2">
        {["maceta1.png", "maceta2.png", "maceta3.png", "maceta4.png"].map((img, i) => (
          <img
            key={i}
            src={`/${img}`}
            alt={`Maceta ${i + 1}`}
            className="h-20 w-auto rounded shadow cursor-pointer"
          />
        ))}
      </div>

      {/* Scrollable plantas */}
      <h2 className="font-semibold text-lg mb-2">Elige tu planta</h2>
      <div className="flex gap-2 overflow-x-auto mb-4 pb-2">
        {["planta1.png", "planta2.png", "planta3.png", "planta4.png"].map((img, i) => (
          <img
            key={i}
            src={`/${img}`}
            alt={`Planta ${i + 1}`}
            className="h-20 w-auto rounded shadow cursor-pointer"
          />
        ))}
      </div>

      {/* Product Preview */}
      <div className="relative mx-auto w-[300px]">
        <img
          src="/maceta.png"
          alt="Maceta"
          className="w-full object-contain"
        />
        <img
          src="/planta.png"
          alt="Planta"
          className="absolute top-0 left-0 w-full object-contain"
        />
        <div className="absolute top-[20%] left-1/2 transform -translate-x-1/2 text-center text-black text-2xl font-bold">
          {text}
        </div>
        <div className="absolute bottom-0 left-0 text-xs font-medium">12cm</div>
      </div>

      {/* Precio y accesorios */}
      <div className="text-center my-4">
        <div>
          <span className="line-through text-gray-400">$14.000</span>{" "}
          <span className="text-2xl font-bold">$10.000</span>
        </div>
        <h2 className="text-md font-semibold mt-2">Accesorios</h2>
        <div className="flex justify-center gap-2 mt-2">
          {["tools.png", "stones.png", "", ""].map((img, i) => (
            <div
              key={i}
              className="w-14 h-14 bg-gray-300 rounded"
              style={{ backgroundImage: img ? `url(/${img})` : "none", backgroundSize: "cover" }}
            ></div>
          ))}
        </div>
      </div>

      {/* Descripciones */}
      <div className="px-2 text-sm">
        <p>
          <strong>Planta</strong><br />
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
        <p className="mt-2">
          <strong>Maceta</strong><br />
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
      </div>

      {/* Input + Comprar */}
      <div className="mt-4 px-2">
        <input
          className="border border-gray-300 px-2 py-1 rounded mr-2"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="bg-[#eee0c8] font-bold text-black px-6 py-2 rounded">
          Comprar
        </button>
      </div>

      {/* Reference Images */}
      <div className="mt-6">
        <h2 className="text-center font-bold text-sm mb-2">Reference image</h2>
        <div className="flex justify-center gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-20 h-20 bg-gray-300 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
