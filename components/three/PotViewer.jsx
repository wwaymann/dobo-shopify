// /components/three/PotViewer.jsx
import React, { useMemo, forwardRef } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { Decal, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const PotMesh = forwardRef(function PotMesh({ color="#6aa4c0", children }, ref){
  const points = useMemo(()=>{
    const p = [];
    p.push(new THREE.Vector2(0.05, 0.00));
    p.push(new THREE.Vector2(0.09, 0.00));
    p.push(new THREE.Vector2(0.11, 0.02));
    p.push(new THREE.Vector2(0.12, 0.12));
    p.push(new THREE.Vector2(0.11, 0.18));
    p.push(new THREE.Vector2(0.12, 0.20));
    return p;
  },[]);
  const geo = useMemo(()=>new THREE.LatheGeometry(points, 96),[points]);
  return (
    <mesh ref={ref} geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color={color} metalness={0.1} roughness={0.6}/>
      {children}
    </mesh>
  );
});

export default function PotViewer({ normalUrl, bg="white" }) {
  if (!normalUrl) return null;
  const normal = useLoader(THREE.TextureLoader, normalUrl);
  normal.wrapS = normal.wrapT = THREE.ClampToEdgeWrapping;

  return (
    <div style={{width:"100%", height:"80vh", background:bg}}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position:[0,0.22,0.55], fov:35 }}
        shadows
      >
        <ambientLight intensity={0.5}/>
        <directionalLight position={[2,2,2]} intensity={1.2} castShadow/>

        <group position={[0,-0.06,0]}>
          <PotMesh>
            {/* Decal ahora es hijo directo de la maceta (tiene geometry válida) */}
            <Decal position={[0,0.12,0.121]} rotation={[0,0,0]} scale={0.14}>
              <meshStandardMaterial
                color="white"
                roughness={0.6}
                metalness={0.0}
                normalMap={normal}
                normalScale={new THREE.Vector2(1,1)}
                transparent
              />
            </Decal>
          </PotMesh>
        </group>

        <OrbitControls enablePan={false} minDistance={0.35} maxDistance={1.2}/>
      </Canvas>
    </div>
  );
}
