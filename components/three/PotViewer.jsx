// PotViewer.jsx

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Decal, Environment } from "@react-three/drei";
import * as THREE from "three";

function PotMesh({ color="#6aa4c0" }) {
  // perfil sencillo de maceta (en metros)
  const points = useMemo(()=>{
    const p = [];
    p.push(new THREE.Vector2(0.05, 0.00)); // base interior
    p.push(new THREE.Vector2(0.09, 0.00)); // base exterior
    p.push(new THREE.Vector2(0.11, 0.02));
    p.push(new THREE.Vector2(0.12, 0.12)); // vientre
    p.push(new THREE.Vector2(0.11, 0.18));
    p.push(new THREE.Vector2(0.12, 0.20)); // labio
    return p;
  },[]);
  const geo = useMemo(()=>new THREE.LatheGeometry(points, 96),[points]);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial metalness={0.1} roughness={0.6} color={color}/>
    </mesh>
  );
}

function LogoDecal({ normalUrl, pos=[0,0.12,0.121], scale=0.14 }) {
  const normal = useLoader(THREE.TextureLoader, normalUrl);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;

  // Decal carrier
  return (
    <mesh position={[0,0,0]}>
      <Decal position={pos} rotation={[0,0,0]} scale={scale}>
        <meshStandardMaterial
          color="white"
          roughness={0.6}
          metalness={0.0}
          normalMap={normal}
          normalScale={new THREE.Vector2(1,1)}
          transparent
        />
      </Decal>
    </mesh>
  );
}

function Rig() {
  const light = useRef();
  useFrame(({clock})=>{
    if (light.current) light.current.position.x = Math.sin(clock.elapsedTime*0.2)*0.5 + 1.5;
  });
  return (
    <>
      <ambientLight intensity={0.5}/>
      <directionalLight ref={light} position={[2,2,2]} intensity={1.2} castShadow/>
    </>
  );
}

export default function PotViewer({ normalUrl, bg="white" }) {
  return (
    <div style={{width:"100%", height:"80vh", background:bg}}>
      <Canvas camera={{position:[0.0,0.22,0.55], fov:35}} shadows>
        <Rig/>
        <Environment preset="studio"/>
        <group position={[0,-0.06,0]}>
          <PotMesh/>
          <LogoDecal normalUrl={normalUrl}/>
        </group>
        <OrbitControls enablePan={false} minDistance={0.35} maxDistance={1.2}/>
      </Canvas>
    </div>
  );
}
