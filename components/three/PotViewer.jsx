// /components/three/PotViewer.jsx
import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Decal, OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";

function PotMesh({ color = "#6aa4c0", children }) {
  const points = useMemo(() => {
    const p = [];
    p.push(new THREE.Vector2(0.05, 0.0));
    p.push(new THREE.Vector2(0.09, 0.0));
    p.push(new THREE.Vector2(0.11, 0.02));
    p.push(new THREE.Vector2(0.12, 0.12));
    p.push(new THREE.Vector2(0.11, 0.18));
    p.push(new THREE.Vector2(0.12, 0.20));
    return p;
  }, []);
  const geo = useMemo(() => new THREE.LatheGeometry(points, 96), [points]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} metalness={0.1} roughness={0.6} />
      {children}
    </mesh>
  );
}

function Scene({ normalUrl }) {
  const normal = useTexture(normalUrl); // ahora dentro del Canvas
  normal.wrapS = normal.wrapT = THREE.ClampToEdgeWrapping;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 2, 2]} intensity={1.2} />
      <group position={[0, -0.06, 0]}>
        <PotMesh>
          <Decal position={[0, 0.12, 0.121]} rotation={[0, 0, 0]} scale={0.14}>
            <meshStandardMaterial
              color="white"
              roughness={0.6}
              metalness={0.0}
              normalMap={normal}
              normalScale={new THREE.Vector2(1, 1)}
              transparent
            />
          </Decal>
        </PotMesh>
      </group>
      <OrbitControls enablePan={false} minDistance={0.35} maxDistance={1.2} />
    </>
  );
}

export default function PotViewer({ normalUrl, bg = "white" }) {
  if (!normalUrl) return null;
  return (
    <div style={{ width: "100%", height: "80vh", background: bg }}>
      <Canvas
        dpr={[1, 1]}
        gl={{ antialias: false, powerPreference: "high-performance", alpha: true }}
        camera={{ position: [0, 0.22, 0.55], fov: 35 }}
        shadows={false}
      >
        <Scene normalUrl={normalUrl} />
      </Canvas>
    </div>
  );
}
