"use client";

import { useMemo, useRef, useState } from "react";
import { MeshProps, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type QuatrefoilProps = MeshProps & {
  colorIndex: number;
  opacity?: number;
  info?: { name: string; imageUrl?: string };
  onHover?: (info: { name: string; imageUrl?: string } | null) => void;
};

const COLORS = ["#4A90E2", "#7B68EE", "#50C878", "#FFD700"];
const HOVER_COLOR = "#FF6B9D";

function createQuatrefoilShape() {
  const shape = new THREE.Shape();
  const radius = 0.4;
  const petalRadius = radius * 0.5;
  
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI * 2) / 4;
    const cx = Math.cos(angle) * petalRadius;
    const cy = Math.sin(angle) * petalRadius;
    
    if (i === 0) {
      shape.moveTo(cx, cy + petalRadius);
      shape.absarc(cx, cy, petalRadius, angle - Math.PI / 2, angle + Math.PI / 2, false);
    } else {
      shape.absarc(cx, cy, petalRadius, angle - Math.PI / 2, angle + Math.PI / 2, false);
    }
  }
  shape.closePath();
  
  return new THREE.ShapeGeometry(shape);
}

export function Quatrefoil({ colorIndex, opacity = 0.6, info, onHover, ...props }: QuatrefoilProps) {
  const geometry = useMemo(() => createQuatrefoilShape(), []);
  const baseColor = useMemo(() => COLORS[colorIndex % COLORS.length], [colorIndex]);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const rotationRef = useRef(0);
  const colorRef = useRef(new THREE.Color(baseColor));
  
  useFrame((_, dt) => {
    if (meshRef.current && meshRef.current.material) {
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      
      if (hovered) {
        rotationRef.current += dt * 2;
        meshRef.current.rotation.z = rotationRef.current;
        colorRef.current.lerp(new THREE.Color(HOVER_COLOR), dt * 5);
      } else {
        rotationRef.current *= Math.pow(0.9, dt * 60);
        meshRef.current.rotation.z = rotationRef.current;
        colorRef.current.lerp(new THREE.Color(baseColor), dt * 5);
      }
      
      mat.color.copy(colorRef.current);
    }
  });
  
  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        if (info && onHover) onHover(info);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        if (onHover) onHover(null);
        document.body.style.cursor = "auto";
      }}
      {...props}
    >
      <meshBasicMaterial
        color={baseColor}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default Quatrefoil;

