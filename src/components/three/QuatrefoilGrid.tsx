"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Quatrefoil } from "./Quatrefoil";

/* ---------- Seeded RNG ---------- */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle<T>(arr: T[], seed: number) {
  const a = arr.slice();
  const rnd = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Types ---------- */
type QuatrefoilGridProps = {
  rows?: number;
  cols?: number;
  spacing?: number;
  fadeInDuration?: number;
  onComplete?: () => void;
  buildings?: Array<{ name: string; imageUrl?: string }>;
  setHoverInfo?: (info: { name: string; imageUrl?: string } | null) => void;
  keepIndices?: number[];           // 0-based grid idx
  keepRC?: Array<[number, number]>; // (row,col) -> idx
  keepByAppearance?: number[];      // rank in appearanceOrder -> idx
  dropProgress?: number;            // 0..1
  mousePx?: { x: number; y: number } | null;
  seed?: number;
  keepTileOpacity?: number;         // 保留圖形的透明度
  reflectionProgress?: number;      // 0..1，反思階段的圖形動畫進度
  reflectionTargetIdx?: number;     // 反思階段要移動的圖形索引（預設第一個保留的）
  phase?: string;                   // 當前階段，用於判斷是否在 reflection 階段
  shapeFollowingMouse?: boolean;    // 圖形是否跟隨鼠標
  onShapeScreenPosChange?: (pos: { x: number; y: number } | null) => void; // 通知圖形屏幕位置變化

  groupPairs?: Array<[number, number]>;
};

const DEFAULT_GROUP_PAIRS: Array<[number, number]> = [
  [0, 10],  // 第一組
  [7, 9],   // 第二組
  [25, 33], // 第三組（斜向）
];

export function QuatrefoilGrid({
  rows = 5,
  cols = 10,
  spacing = 0.84,
  fadeInDuration = 3,
  onComplete,
  buildings = [],
  setHoverInfo,
  keepIndices = [0, 10, 7, 9, 23, 36],
  keepRC,
  keepByAppearance,
  dropProgress = 0,
  mousePx = null,
  seed = 1337,
  groupPairs = DEFAULT_GROUP_PAIRS,
  keepTileOpacity = 0.6,
  reflectionProgress = 0,
  reflectionTargetIdx,
  phase,
  shapeFollowingMouse = false,
  onShapeScreenPosChange,
}: QuatrefoilGridProps) {
  const tileRefs = useRef<Array<THREE.Group | null>>([]);
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set());
  const timeRef = useRef(0);
  const totalCount = rows * cols;
  const spawnInterval = fadeInDuration / totalCount;
  const fadeTime = 0.4;
  const { size, camera } = useThree();
  const shapeScreenPosRef = useRef<{ x: number; y: number } | null>(null);

  // appearanceOrder：只算一次，且可重現
  const appearanceOrderRef = useRef<number[] | null>(null);
  if (!appearanceOrderRef.current) {
    const base = Array.from({ length: totalCount }, (_, i) => i);
    appearanceOrderRef.current = seededShuffle(base, seed);
  }
  const appearanceOrder = appearanceOrderRef.current!;

  // buildingIndices（僅供 info 配對，不影響 keep）
  const buildingIndices = useMemo(() => {
    const base = Array.from({ length: totalCount }, (_, i) => i);
    const shuffled = seededShuffle(base, seed * 31 + 7);
    return new Set(shuffled.slice(0, buildings.length));
  }, [rows, cols, buildings, seed]);

  // 位置表
  const positions = useMemo(() => {
    const arr: Array<{ x: number; y: number; colorIndex: number; hasInfo: boolean }> = [];
    const startX = -((cols - 1) * spacing) / 2;
    const startY = -((rows - 1) * spacing) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        arr.push({
          x: startX + c * spacing,
          y: startY + r * spacing,
          colorIndex: (r + c) % 4,
          hasInfo: buildingIndices.has(idx),
        });
      }
    }
    return arr;
  }, [rows, cols, spacing, buildingIndices]);

  // keepSet：只要在這裡，絕對不會掉
  const keepSet = useMemo(() => {
    const s = new Set<number>();
    (keepIndices ?? []).forEach((k) => { if (k >= 0 && k < totalCount) s.add(k); });
    (keepRC ?? []).forEach(([r, c]) => {
      const idx = r * cols + c;
      if (idx >= 0 && idx < totalCount) s.add(idx);
    });
    (keepByAppearance ?? []).forEach((rank) => {
      const idx = appearanceOrder[rank];
      if (typeof idx === "number" && idx >= 0 && idx < totalCount) s.add(idx);
    });
    return s;
  }, [keepIndices, keepRC, keepByAppearance, cols, totalCount, appearanceOrder, rows]);

  // 確定反思階段的目標圖形索引
  const reflectionTarget = useMemo(() => {
    if (reflectionTargetIdx !== undefined && keepSet.has(reflectionTargetIdx)) {
      return reflectionTargetIdx;
    }
    const keptArray = Array.from(keepSet).sort((a, b) => a - b);
    return keptArray.length > 0 ? keptArray[0] : null;
  }, [reflectionTargetIdx, keepSet]);

  // 反思動畫用：記錄目標圖形的起始位置
  const reflectionStartPosRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // 非 kept 的掉落順序
  const nonKeptOrder = useMemo(() => {
    const filtered = appearanceOrder.filter((idx) => !keepSet.has(idx));
    return filtered;
  }, [appearanceOrder, keepSet]);

  const rankMap = useMemo(() => {
    const m = new Map<number, number>();
    nonKeptOrder.forEach((idx, r) => m.set(idx, r));
    return m;
  }, [nonKeptOrder]);

  const jitterMap = useMemo(() => {
    const m = new Map<number, number>();
    for (let i = 0; i < totalCount; i++) {
      const j = Math.sin((i + 0.5) * 12.9898) * 43758.5453;
      const frac = j - Math.floor(j);
      m.set(i, (frac - 0.5) * 0.7);
    }
    return m;
  }, [totalCount]);

  // 統一設定透明度的小工具
  const setTileOpacity = (wrap: THREE.Group, alpha: number) => {
    wrap.traverse((node: any) => {
      if (node.isMesh) {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        for (const m of mats) {
          if (!m) continue;
          m.transparent = true;
          m.opacity = alpha;
        }
      }
    });
  };

  // 滑鼠推擠偏移
  const offsetsRef = useRef<Array<THREE.Vector2>>(
    Array.from({ length: totalCount }, () => new THREE.Vector2())
  );

  // 追蹤已掉落（禁用 hover 用）
  const droppedIndicesRef = useRef<Set<number>>(new Set());

  // 反思鎖與開始旗標（為防止 phase 抖動造成回位）
  const reflectionLockRef = useRef(false);
  const reflectionStartedRef = useRef(false);

  useFrame((_, dt) => {
    timeRef.current += dt;

    // 進場淡入
    const localVisible = new Set(visibleIndices);
    let changed = false;
    for (let i = 0; i < appearanceOrder.length; i++) {
      const idx = appearanceOrder[i];
      const spawnTime = i * spawnInterval;
      if (timeRef.current >= spawnTime && !localVisible.has(idx)) {
        localVisible.add(idx);
        changed = true;
      }
    }
    if (changed) {
      setVisibleIndices(localVisible);
      if (localVisible.size === totalCount && onComplete) onComplete();
    }

    // 反思鎖定狀態處理
    const inReflectionProp = phase === "reflection";
    const inReflectionNow = inReflectionProp || reflectionLockRef.current;

    if (inReflectionProp && !reflectionLockRef.current) {
      reflectionLockRef.current = true;
    }
    if (!inReflectionProp && reflectionLockRef.current && reflectionProgress === 0) {
      reflectionLockRef.current = false;
      reflectionStartedRef.current = false;
      reflectionStartPosRef.current.clear();
    }

    const cam = camera as THREE.Camera;
    const groupTarget = new Map<number, THREE.Vector2>();

    if ((dropProgress ?? 0) >= 1 && mousePx && size) {
      const worldToScreen = (wx: number, wy: number) => {
        const v = new THREE.Vector3(wx, wy, 0).project(cam);
        return {
          sx: ((v.x + 1) / 2) * size.width,
          sy: (1 - (v.y + 1) / 2) * size.height,
        };
      };

      const R_SEG = 300;
      const R_END = 200;
      const R_FALL = 360;
      const SEP_CAP = 2.4;
      const MID_B = 0.4;

      let best: null | {
        a: number; b: number;
        nx: number; ny: number; len: number;
        t: number; dm: number; dA: number; dB: number;
        key: number; byFallback: boolean;
      } = null;

      for (const [a, b] of groupPairs) {
        if (!keepSet.has(a) || !keepSet.has(b)) continue;

        const ax = positions[a]?.x ?? 0, ay = positions[a]?.y ?? 0;
        const bx = positions[b]?.x ?? 0, by = positions[b]?.y ?? 0;

        const ux = bx - ax, uy = by - ay;
        const len = Math.hypot(ux, uy) || 1;
        const nx = ux / len, ny = uy / len;

        const { sx: asx, sy: asy } = worldToScreen(ax, ay);
        const { sx: bsx, sy: bsy } = worldToScreen(bx, by);

        const segx = bsx - asx, segy = bsy - asy;
        const segLen2 = Math.max(1, segx * segx + segy * segy);
        const mx = (mousePx?.x ?? 0) - asx;
        const my = (mousePx?.y ?? 0) - asy;
        let t = (mx * segx + my * segy) / segLen2;
        t = Math.min(1, Math.max(0, t));
        const cx = asx + t * segx, cy = asy + t * segy;
        const dm = Math.hypot((mousePx?.x ?? 0) - cx, (mousePx?.y ?? 0) - cy);

        const dA = Math.hypot((mousePx?.x ?? 0) - asx, (mousePx?.y ?? 0) - asy);
        const dB = Math.hypot((mousePx?.x ?? 0) - bsx, (mousePx?.y ?? 0) - bsy);

        const hitSeg = dm < R_SEG;
        const hitEnd = (dA < R_END) || (dB < R_END);
        const hit = hitSeg || hitEnd;
        const byFallback = !hit && (Math.min(dA, dB) < R_FALL);

        const key = Math.min(dm, dA, dB);
        if (hit || byFallback) {
          let tAdj = t;
          if (!hitSeg) tAdj = (dA < dB) ? 0.15 : 0.85;
          if (!best || key < best.key) {
            best = { a, b, nx, ny, len, t: tAdj, dm, dA, dB, key, byFallback };
          }
        }
      }

      if (best) {
        const { a, b, nx, ny, len, t, dm, dA, dB, byFallback } = best;
        let strength: number;
        if (!byFallback && dm < R_SEG) {
          strength = (R_SEG - dm) / R_SEG;
        } else {
          const dn = Math.min(dA, dB);
          strength = (R_FALL - dn) / R_FALL;
        }

        const midBoost = 1 - Math.abs(t - 0.5) * MID_B;
        const sepMax = Math.min(len * 0.55, SEP_CAP);
        const sep = strength * midBoost * sepMax;

        groupTarget.set(a, new THREE.Vector2(-nx * sep, -ny * sep));
        groupTarget.set(b, new THREE.Vector2(+nx * sep, +ny * sep));
      }
    }

    // 逐格更新
    for (let idx = 0; idx < totalCount; idx++) {
      const wrap = tileRefs.current[idx];
      if (!wrap) continue;

      const baseX = positions[idx]?.x ?? 0;
      const baseY = positions[idx]?.y ?? 0;
      const orderIndex = appearanceOrder.indexOf(idx);
      const spawnTime = orderIndex >= 0 ? orderIndex * spawnInterval : 0;
      const alpha = localVisible.has(idx)
        ? 0.6 * Math.min(1, (timeRef.current - spawnTime) / fadeTime)
        : 0;

      if (keepSet.has(idx)) {
        wrap.visible = true;

        // 反思階段：目標圖形移動到中間偏上並旋轉，其他淡出
        const isInReflection = inReflectionNow && reflectionProgress !== undefined;

        if (isInReflection) {
          const isTarget = reflectionTarget !== null && idx === reflectionTarget;

          if (isTarget) {
            let targetX = 0;
            let targetY = 1.0;

            // 如果圖形需要跟隨鼠標
            if (shapeFollowingMouse && mousePx && size && camera) {
              // 將鼠標屏幕坐標轉換為世界坐標
              const aspect = (camera as any).aspect || 1;
              const fovRad = ((camera as any).fov || 55) * Math.PI / 180;
              const zPos = (camera as any).position.z || 5.5;
              
              // NDC 坐標 (-1 to 1)
              const ndcX = (mousePx.x / size.width) * 2 - 1;
              const ndcY = 1 - (mousePx.y / size.height) * 2; // 注意Y軸需要翻轉
              
              // 世界坐標
              const worldHeight = 2 * Math.tan(fovRad / 2) * zPos;
              const worldWidth = worldHeight * aspect;
              
              targetX = ndcX * (worldWidth / 2);
              targetY = ndcY * (worldHeight / 2);
            }

            // 第一次開始反思時記錄起點，之後不覆寫
            if (!reflectionStartedRef.current && !reflectionStartPosRef.current.has(idx)) {
              const currentPos = wrap.position.clone();
              reflectionStartPosRef.current.set(idx, { x: currentPos.x, y: currentPos.y });
              reflectionStartedRef.current = true;
            }

            const startPos = reflectionStartPosRef.current.get(idx) || { x: baseX, y: baseY };
            const startX = startPos.x;
            const startY = startPos.y;

            // ease-out（如果是跟隨鼠標，則直接設置位置，不使用緩動）
            let newX: number, newY: number;
            if (shapeFollowingMouse) {
              newX = targetX;
              newY = targetY;
            } else {
              const eased = 1 - Math.pow(1 - (reflectionProgress ?? 0), 3);
              newX = startX + (targetX - startX) * eased;
              newY = startY + (targetY - startY) * eased;
            }

            wrap.position.set(newX, newY, 0);

            // 旋轉（可依需求調整）
            // const easeRot = 1 - Math.cos(Math.PI * (reflectionProgress ?? 0));
            // wrap.rotation.z = easeRot * Math.PI;
            wrap.rotation.z = (reflectionProgress ?? 0) * Math.PI * 2;

            // 透明度
            const eased = shapeFollowingMouse ? 1 : 1 - Math.pow(1 - (reflectionProgress ?? 0), 3);
            const targetAlpha = 0.08 + (0.9 - 0.08) * eased;
            const baseAlpha = localVisible.has(idx) ? Math.min(1, (timeRef.current - spawnTime) / fadeTime) : 0;
            setTileOpacity(wrap, baseAlpha * targetAlpha);

            // 更新圖形在屏幕上的位置（用於碰撞檢測）
            if (size && camera && onShapeScreenPosChange) {
              const world = new THREE.Vector3(newX, newY, 0);
              const projected = world.clone().project(camera as THREE.Camera);
              const screenX = ((projected.x + 1) / 2) * size.width;
              const screenY = (1 - (projected.y + 1) / 2) * size.height;
              const newScreenPos = { x: screenX, y: screenY };
              if (!shapeScreenPosRef.current || 
                  Math.abs(shapeScreenPosRef.current.x - newScreenPos.x) > 1 ||
                  Math.abs(shapeScreenPosRef.current.y - newScreenPos.y) > 1) {
                shapeScreenPosRef.current = newScreenPos;
                onShapeScreenPosChange(newScreenPos);
              }
            }

            // 清偏移
            const off = offsetsRef.current[idx];
            off.set(0, 0);
          } else {
            // 其它保留圖形淡出，但不要把位置強制拉回 base（避免跳動）
            const fadeOutAlpha = 0.08 * (1 - (reflectionProgress ?? 0));
            const baseAlpha = localVisible.has(idx) ? Math.min(1, (timeRef.current - spawnTime) / fadeTime) : 0;
            setTileOpacity(wrap, baseAlpha * fadeOutAlpha);

            const off = offsetsRef.current[idx];
            off.set(0, 0);
            if (!inReflectionNow || !reflectionStartedRef.current) {
              wrap.position.set(baseX + off.x, baseY + off.y, 0);
            }
          }

          wrap.updateMatrixWorld();
          continue;
        }

        // 非反思階段：保留圖形正常顯示
        const baseAlpha = localVisible.has(idx) ? Math.min(1, (timeRef.current - spawnTime) / fadeTime) : 0;
        const finalAlpha = baseAlpha * keepTileOpacity;
        setTileOpacity(wrap, finalAlpha);

        const isNotInReflection = !inReflectionNow;

        if ((dropProgress ?? 0) >= 1 && isNotInReflection) {
          const targetOffset = new THREE.Vector2(0, 0);

          const gt = groupTarget.get(idx);
          if (gt) {
            targetOffset.add(gt);
          }

          if (mousePx && size && camera) {
            const world = new THREE.Vector3(baseX, baseY, 0);
            const projected = world.clone().project(camera as THREE.Camera);
            const sx = ((projected.x + 1) / 2) * size.width;
            const sy = (1 - (projected.y + 1) / 2) * size.height;
            const dx = sx - mousePx.x;
            const dy = sy - mousePx.y;
            const d = Math.hypot(dx, dy);

            const R_single = 90;
            if (d < R_single && d > 1e-4) {
              const k = (R_single - d) / R_single;
              const px2w = 0.0018 * (camera as any).position.z;
              targetOffset.add(new THREE.Vector2(
                (-dx / d) * k * px2w * 40,
                (-dy / d) * k * px2w * 40
              ));
            }
          }

          const off = offsetsRef.current[idx];
          off.lerp(targetOffset, 8 * dt);
          if (!mousePx || targetOffset.lengthSq() === 0) {
            off.multiplyScalar(Math.pow(0.9, dt * 60));
          }
          wrap.position.set(baseX + off.x, baseY + off.y, 0);
        } else {
          // 不在互動階段時，回到 base，但反思目標不覆寫
          if (!(inReflectionNow && reflectionStartedRef.current && idx === reflectionTarget)) {
            wrap.position.set(baseX, baseY, 0);
          }
        }
        wrap.updateMatrixWorld();
        continue;
      }

      // 非保留格：掉落/淡出
      wrap.visible = true;
      setTileOpacity(wrap, alpha);

      if ((dropProgress ?? 0) > 0) {
        const r = rankMap.get(idx);
        if (r === undefined) {
          wrap.position.set(baseX, baseY, 0);
          droppedIndicesRef.current.delete(idx);
        } else {
          const nonKeptCount = Math.max(1, nonKeptOrder.length);
          const jitter = jitterMap.get(idx) ?? 0;
          const threshold = Math.max(0, (r + jitter) / nonKeptCount);
          const p = dropProgress ?? 0;

          if (p <= threshold) {
            wrap.position.set(baseX, baseY, 0);
            droppedIndicesRef.current.delete(idx);
          } else {
            const remaining = 1 - threshold;
            const local = remaining > 1e-3 ? Math.min(1, (p - threshold) / remaining) : 1;
            const fall = local * local * 4;
            wrap.position.set(baseX, baseY - fall, 0);
            setTileOpacity(wrap, Math.max(0, alpha * (1 - local)));
            if (local > 0.01) {
              droppedIndicesRef.current.add(idx);
            }
            if (local >= 1) {
              wrap.visible = false;
            }
          }
        }
      } else {
        wrap.position.set(baseX, baseY, 0);
        droppedIndicesRef.current.delete(idx);
      }
    }
  });

  // 建 info map
  const buildingMap = useMemo(() => {
    const idxs = Array.from(buildingIndices);
    const map = new Map<number, { name: string; imageUrl?: string }>();
    for (let i = 0; i < idxs.length && i < buildings.length; i++) {
      map.set(idxs[i], buildings[i]);
    }
    return map;
  }, [buildingIndices, buildings]);

  // render：所有 tile 初始都在自己的 base，由 useFrame 接手
  return (
    <group>
      {positions.map((pos, idx) => {
        const isInDropPhase = (dropProgress ?? 0) > 0;
        const infoForTile = isInDropPhase ? undefined : buildingMap.get(idx);

        return (
          <group
            key={idx}
            ref={(el) => {
              if (!el) {
                tileRefs.current[idx] = null;
                return;
              }
              // 如果之前還沒有紀錄過這個 group，代表是第一次掛載
              if (!tileRefs.current[idx]) {
                el.position.set(pos.x, pos.y, 0); // 只在初次掛載時設 base 位置
              }
              tileRefs.current[idx] = el;
            }}
          >
            <Quatrefoil
              colorIndex={pos.colorIndex}
              opacity={0}
              info={infoForTile}
              onHover={setHoverInfo}
            />
          </group>
        );
      })}
    </group>
  );
}

export default QuatrefoilGrid;