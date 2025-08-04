import { useState } from "react";

export default function Home() {
  const [text, setText] = useState("DOBO");

  return (
    <div className="min-h-screen bg-[#f5f3ef] font-sans px-4 py-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <img src="/logo-dobo.png" alt="DOBO logo" className="w-10 h-10" />
          <div>
            <h1 className="text-lg font-bold leading-tight">DOBO</h1>
            <p className="text-xs text-gray-500">Planta una idea</p>
          </div>
        </div>
        <div className="text-3xl cursor-pointer">&#9776;</div>
      </header>

      {/* Scrollable color selector */}
      <div className="flex gap-3 overflow-x-auto mb-5 scrollbar-hide">
        {["#c7b299", "#ce8136", "#302b27", "#fff6b2"].map((color, i) => (
          <div
            key={i}
            className="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0"
            style={{ backgroundColor: color }}
          ></div>
        ))}
      </div>

      {/* Product Preview */}
      <div className="relative mx-auto w-[280px] h-[280px] mb-4">
        <img
          src="/maceta.png"
          alt="Maceta"
          className="w-full h-full object-contain"
        />
        <img
          src="/planta.png"
          alt="Planta"
          className="absolute top-0 left-0 w-full h-full object-contain"
        />
        <div className="absolute top-[22%] left-1/2 transform -translate-x-1/2 text-center text-black text-xl font-bold">
          {text}
        </div>
        <div className="absolute bottom-1 left-1 text-xs font-medium">12cm</div>
      </div>

      {/* Precio y accesorios */}
      <div className="text-center mb-5">
        <div>
          <span className="line-through text-gray-400 text-sm">$14.000</span>{" "}
          <span className="text-2xl font-bold text-black">$10.000</span>
        </div>
        <h2 className="text-md font-semibold mt-3 mb-2">Accesorios</h2>
        <div className="flex justify-center gap-3 mt-1">
          {["tools.png", "stones.png", "", ""].map((img, i) => (
            <div
              key={i}
              className="w-14 h-14 bg-gray-300 rounded overflow-hidden flex-shrink-0"
              style={{
                backgroundImage: img ? `url(/${img})` : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Descripciones */}
      <div className="px-2 text-sm text-gray-700">
        <p>
          <strong>Planta</strong><br />
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
        <p className="mt-3">
          <strong>Maceta</strong><br />
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
      </div>

      {/* Input + Comprar */}
      <div className="mt-6 px-2 flex items-center justify-center gap-2">
        <input
          className="border border-gray-300 px-3 py-2 rounded text-sm w-1/2"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="bg-[#eee0c8] text-black font-bold px-6 py-2 rounded shadow">
          Comprar
        </button>
      </div>

      {/* Reference Images */}
      <div className="mt-8">
        <h2 className="text-center font-bold text-sm mb-3">Reference image</h2>
        <div className="flex justify-center gap-3 px-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-20 h-20 bg-gray-300 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
