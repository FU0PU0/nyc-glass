"use client";

import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { PropsWithChildren, Suspense } from "react";

export default function SceneCanvas({ children }: PropsWithChildren) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, physicallyCorrectLights: true }}
      camera={{ position: [0, 0, 5.5], fov: 55, up: [0, 1, 0] }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Suspense fallback={null}>
        <Environment preset="city" />
        {children}
      </Suspense>
    </Canvas>
  );
}

