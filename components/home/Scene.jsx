"use client";
import React from "react";
import styles from "../../styles/home.module.css";
import IndicatorDots from "./IndicatorDots";
export default function Scene({ sceneWrapRef, stageRef, plantScrollRef, potScrollRef, plants = [], pots = [], selectedPlantIndex = 0, setSelectedPlantIndex, selectedPotIndex = 0, setSelectedPotIndex, selectedPotVariant, plantSwipeEvents = {}, potSwipeEvents = {}, onPlantPrev, onPlantNext, onPotPrev, onPotNext, handlePointerDownCap, handlePointerUpCap, editing = false, }) {
  return (
    <div className="position-relative" ref={sceneWrapRef} style={{ width:"100%", maxWidth:"500px", aspectRatio:"500 / 650", backgroundImage:"url('/images/fondo-dobo.jpg')", backgroundSize:"cover", backgroundPosition:"center", backgroundRepeat:"no-repeat", border:"3px dashed #6c757d", borderRadius:"20px", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", touchAction:"pan-y", userSelect:"none" }}>
      <IndicatorDots count={plants.length} current={selectedPlantIndex} onSelect={(i)=>setSelectedPlantIndex(Math.max(0, Math.min(i, plants.length - 1)))} position="top" />
      <button className={`${styles.chev} ${styles.chevTopLeft}`} aria-label="Anterior" onClick={() => onPlantPrev?.()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg></button>
      <button className={`${styles.chev} ${styles.chevTopRight}`} aria-label="Siguiente" onClick={() => onPlantNext?.()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg></button>
      <IndicatorDots count={pots.length} current={selectedPotIndex} onSelect={(i)=>setSelectedPotIndex(Math.max(0, Math.min(i, pots.length - 1)))} position="bottom" />
      <button className={`${styles.chev} ${styles.chevBottomLeft}`} aria-label="Anterior" onClick={() => onPotPrev?.()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg></button>
      <button className={`${styles.chev} ${styles.chevBottomRight}`} aria-label="Siguiente" onClick={() => onPotNext?.()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg></button>
      <div ref={stageRef} data-capture-stage="1" className="d-flex justify-content-center align-items-end" style={{ height:"100%", "--zoom":0.75, transform:"scale(var(--zoom))", transformOrigin:"50% 70%", willChange:"transform", backfaceVisibility:"hidden", touchAction:"pan-y", userSelect:"none" }}>
        <div className={styles.carouselContainer} ref={potScrollRef} data-capture="pot-container" style={{ zIndex:1, touchAction:"pan-y", userSelect:"none" }} onPointerDownCapture={(e)=>handlePointerDownCap?.(e)} onPointerUpCapture={(e)=>handlePointerUpCap?.(e, { prev:onPotPrev, next:onPotNext })} onAuxClick={(e)=>e.preventDefault()} onContextMenu={(e)=>e.preventDefault()} {...potSwipeEvents}>
          <div className={styles.carouselTrack} data-capture="pot-track" style={{ transform:`translateX(-${selectedPotIndex * 100}%)` }}>
            {pots.map((product, idx) => {
              const isSel = idx === selectedPotIndex;
              const vImg = isSel ? (selectedPotVariant?.image || selectedPotVariant?.imageUrl || null) : null;
              const imageUrl = vImg || product.image;
              return (<div key={product.id || idx} className={styles.carouselItem}><img src={imageUrl} alt={product.title} className={styles.carouselImage} /></div>);
            })}
          </div>
        </div>
        <div className={styles.carouselContainer} ref={plantScrollRef} data-capture="plant-container" style={{ zIndex:2, position:"absolute", bottom:"300px", height:"530px", left:"50%", transform:"translateX(-50%)", touchAction:"pan-y", userSelect:"none" }} onPointerDownCapture={(e)=>handlePointerDownCap?.(e)} onPointerUpCapture={(e)=>handlePointerUpCap?.(e, { prev:onPlantPrev, next:onPlantNext })} onAuxClick={(e)=>e.preventDefault()} onContextMenu={(e)=>e.preventDefault()} {...plantSwipeEvents}>
          <div className={styles.carouselTrack} data-capture="plant-track" style={{ transform:`translateX(-${selectedPlantIndex * 100}%)` }}>
            {plants.map((product, idx) => (<div key={product.id || idx} className={styles.carouselItem}><img src={product.image} alt={product.title} className={`${styles.carouselImage} ${styles.plantImageOverlay}`} /></div>))}
          </div>
        </div>
      </div>
    </div>
  );
}
