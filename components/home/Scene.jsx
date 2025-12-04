"use client";
import React from "react";
import styles from "../../styles/home.module.css";
import IndicatorDots from "./IndicatorDots";

export default function Scene({
  sceneWrapRef,
  stageRef,
  plantScrollRef,
  potScrollRef,
  plants = [],
  pots = [],
  selectedPlantIndex = 0,
  setSelectedPlantIndex,
  selectedPotIndex = 0,
  setSelectedPotIndex,
  selectedPotVariant,
  plantSwipeEvents = {},
  potSwipeEvents = {},
  onPlantPrev,
  onPlantNext,
  onPotPrev,
  onPotNext,
  handlePointerDownCap,
  handlePointerUpCap,
  editing = false,
}) {
  return (
    <div
      className="position-relative"
      ref={sceneWrapRef}
      style={{
        width: "100%",
        maxWidth: "500px",
        aspectRatio: "500 / 650",
        backgroundImage: "url('/images/fondo-dobo.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        border: "3px dashed #6c757d",
        borderRadius: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        touchAction: "pan-y",
        userSelect: "none",
      }}
    >
      {/* Dots planta */}
      <IndicatorDots
        count={plants.length}
        current={selectedPlantIndex}
        onSelect={(i) =>
          setSelectedPlantIndex(Math.max(0, Math.min(i, plants.length - 1)))
        }
        position="top"
      />

      {/* Flechas planta */}
      <button
        className={`${styles.chev} ${styles.chevTopLeft}`}
        aria-label="Anterior"
        onClick={() => onPlantPrev?.()}
      >
        <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <button
        className={`${styles.chev} ${styles.chevTopRight}`}
        aria-label="Siguiente"
        onClick={() => onPlantNext?.()}
      >
        <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      {/* Dots maceta */}
      <IndicatorDots
        count={pots.length}
        current={selectedPotIndex}
        onSelect={(i) =>
          setSelectedPotIndex(Math.max(0, Math.min(i, pots.length - 1)))
        }
        position="bottom"
      />

      {/* Flechas maceta */}
      <button
        className={`${styles.chev} ${styles.chevBottomLeft}`}
        aria-label="Anterior"
        onClick={() => onPotPrev?.()}
      >
        <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <button
        className={`${styles.chev} ${styles.chevBottomRight}`}
        aria-label="Siguiente"
        onClick={() => onPotNext?.()}
      >
        <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      {/* === NODO ESCENARIO — FIX DE PIVOTE === */}
      <div
        ref={stageRef}
        data-capture-stage="1"
        className="d-flex justify-content-center align-items-end"
        style={{
          height: "100%",
          width: "100%",
          "--zoom": 0.75,
          transform: "scale(var(--zoom))",
          transformOrigin: "50% 50%", // ← FIX: elimina el PIVOTE INCORRECTO 50% 70%
          position: "relative",
          willChange: "transform",
          backfaceVisibility: "hidden",
          touchAction: "pan-y",
          userSelect: "none",
        }}
      >
        {/* === MACETA — pivote superior real === */}
        <div
          className={styles.carouselContainer}
          ref={potScrollRef}
          data-capture="pot-container"
          style={{
            position: "absolute",
            bottom: "0px",
            left: "50%",
            transform: "translateX(-50%)",
            transformOrigin: "top center", // ← PIVOTE SUPERIOR CORRECTO
            zIndex: 2,
            pointerEvents: "auto",
            touchAction: "pan-y",
            userSelect: "none",
          }}
          onPointerDownCapture={(e) => handlePointerDownCap?.(e)}
          onPointerUpCapture={(e) =>
            handlePointerUpCap?.(e, { prev: onPotPrev, next: onPotNext })
          }
          {...potSwipeEvents}
        >
          <div
            className={styles.carouselTrack}
            data-capture="pot-track"
            style={{
              transform: `translateX(-${selectedPotIndex * 100}%)`,
              transformOrigin: "top center", // ← IMPORTANTE
            }}
          >
            {pots.map((product, idx) => {
              const isSel = idx === selectedPotIndex;
              const vImg = isSel
                ? selectedPotVariant?.image || selectedPotVariant?.imageUrl
                : null;
              return (
                <div key={product.id || idx} className={styles.carouselItem}>
                  <img
                    src={vImg || product.image}
                    alt={product.title}
                    className={styles.carouselImage}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* === PLANTA — pivote inferior real === */}
        <div
          className={styles.carouselContainer}
          ref={plantScrollRef}
          data-capture="plant-container"
          style={{
            position: "absolute",
            bottom: "350px", // ← AJUSTE FÍSICO, NO PIVOTE
            left: "50%",
            transform: "translateX(-50%)",
            transformOrigin: "bottom center", // ← PIVOTE REAL INFERIOR
            height: "530px",
            zIndex: 3,
            pointerEvents: "auto",
            touchAction: "pan-y",
            userSelect: "none",
          }}
          onPointerDownCapture={(e) => handlePointerDownCap?.(e)}
          onPointerUpCapture={(e) =>
            handlePointerUpCap?.(e, { prev: onPlantPrev, next: onPlantNext })
          }
          {...plantSwipeEvents}
        >
          <div
            className={styles.carouselTrack}
            data-capture="plant-track"
            style={{
              transform: `translateX(-${selectedPlantIndex * 100}%)`,
              transformOrigin: "bottom center", // ← IMPORTANTE
            }}
          >
            {plants.map((product, idx) => (
              <div key={product.id || idx} className={styles.carouselItem}>
                <img
                  src={product.image}
                  alt={product.title}
                  className={`${styles.carouselImage} ${styles.plantImageOverlay}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
