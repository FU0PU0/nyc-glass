"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SceneCanvas from "@/components/three/SceneCanvas";
import { QuatrefoilGrid } from "@/components/three/QuatrefoilGrid";
import HUDTooltip, { HoverInfo } from "@/components/ui/HUDTooltip";


// 人口密度小叉叉符號組件（參考曼哈頓人口密度分布）
// 融球動畫組件
function WindowBlobs({ colors, index }: { colors: string[]; index: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const blobsRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
  }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || colors.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 120;
    canvas.height = 120;
    
    console.log(`WindowBlobs ${index}: initializing with colors:`, colors); // Debug

    // 初始化融球 - 使用seeded random確保一致性
    const seed = index * 1000 + 12345;
    let seedValue = seed;
    const random = () => {
      seedValue = (seedValue * 9301 + 49297) % 233280;
      return seedValue / 233280;
    };
    
    const blobs = colors.map((color, i) => {
      const angle = (i / colors.length) * Math.PI * 2;
      const radius = 15 + random() * 10;
      return {
        x: 60 + Math.cos(angle) * 20,
        y: 60 + Math.sin(angle) * 20,
        vx: (random() - 0.5) * 0.3,
        vy: (random() - 0.5) * 0.3,
        radius,
        color,
      };
    });
    blobsRef.current = blobs;

    // 檢查點是否在四葉草形狀內（簡化為圓形檢測）
    const isInsideQuatrefoil = (x: number, y: number): boolean => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const dist = Math.hypot(x - centerX, y - centerY);
      return dist < 35;
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 設置裁剪區域（四葉草形狀 - 簡化為圓形）
      ctx.save();
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 35, 0, Math.PI * 2);
      ctx.clip();

      blobs.forEach((blob) => {
        // 更新位置
        blob.x += blob.vx;
        blob.y += blob.vy;

        // 限制在四葉草形狀內
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const dist = Math.hypot(blob.x - centerX, blob.y - centerY);
        const maxDist = 35;

        if (!isInsideQuatrefoil(blob.x, blob.y) || dist + blob.radius > maxDist) {
          const angle = Math.atan2(blob.y - centerY, blob.x - centerX);
          blob.x = centerX + Math.cos(angle) * (maxDist - blob.radius - 2);
          blob.y = centerY + Math.sin(angle) * (maxDist - blob.radius - 2);
          // 反彈速度
          const dot = blob.vx * Math.cos(angle) + blob.vy * Math.sin(angle);
          blob.vx -= 1.5 * dot * Math.cos(angle);
          blob.vy -= 1.5 * dot * Math.sin(angle);
          // 阻尼
          blob.vx *= 0.95;
          blob.vy *= 0.95;
        }

        // 繪製融球效果
        const gradient = ctx.createRadialGradient(
          blob.x, blob.y, 0,
          blob.x, blob.y, blob.radius
        );
        gradient.addColorStop(0, blob.color);
        gradient.addColorStop(0.7, blob.color + "80");
        gradient.addColorStop(1, blob.color + "00");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // 處理融球之間的融合
      for (let i = 0; i < blobs.length; i++) {
        for (let j = i + 1; j < blobs.length; j++) {
          const b1 = blobs[i];
          const b2 = blobs[j];
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.hypot(dx, dy);
          const minDist = b1.radius + b2.radius;
          const mergeDist = minDist * 1.5; // 融合距離

          if (dist < mergeDist && dist > 0) {
            // 融合效果：繪製連接（融球效果）
            const alpha = 1 - (dist / mergeDist);
            const gradient = ctx.createLinearGradient(b1.x, b1.y, b2.x, b2.y);
            gradient.addColorStop(0, b1.color + Math.floor(alpha * 150).toString(16).padStart(2, "0"));
            gradient.addColorStop(1, b2.color + Math.floor(alpha * 150).toString(16).padStart(2, "0"));
            
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 12 * alpha;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(b1.x, b1.y);
            ctx.lineTo(b2.x, b2.y);
            ctx.stroke();

            // 輕微彈開（不要太強）
            if (dist < minDist) {
              const angle = Math.atan2(dy, dx);
              const force = (minDist - dist) * 0.02;
              b1.vx -= Math.cos(angle) * force;
              b1.vy -= Math.sin(angle) * force;
              b2.vx += Math.cos(angle) * force;
              b2.vy += Math.sin(angle) * force;
            }
          }
        }
      }

      ctx.restore(); // 恢復裁剪
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [colors, index]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}

function DensitySymbols() {
  // 參考圖片：約 163 個 'X' 符號，分布模擬曼哈頓形狀
  // 每個 'X' 代表約 10,000 人
  // 密度數據：Land Area 22.83 sq mi, Population 1,629,153, Density 71,360 people/sq mi
  
  const symbols = useMemo(() => {
    const arr: Array<{ x: number; y: number; delay: number }> = [];
    const seed = 1337;
    
    // 定義曼哈頓形狀的密度分佈（大致橢圓形，中間寬兩端窄）
    const getDensityWeight = (x: number, y: number): number => {
      // x: 0-100 (東西), y: 0-100 (南北)
      
      // 模擬曼哈頓形狀：中間寬，上下窄
      const centerX = 50;
      const centerY = 50;
      
      // 計算到中心的距離
      const dx = x - centerX;
      const dy = y - centerY;
      
      // 橢圓形狀：寬度隨高度變化（中間最寬）
      const maxWidthAtCenter = 40; // 中心最寬
      const maxWidthAtEdge = 15;   // 邊緣最窄
      const heightRatio = y / 100;
      const currentMaxWidth = maxWidthAtEdge + (maxWidthAtCenter - maxWidthAtEdge) * Math.sin(heightRatio * Math.PI);
      
      // 計算是否在橢圓範圍內
      const inShape = Math.abs(dx) <= currentMaxWidth;
      
      if (!inShape) return 0;
      
      // 根據位置調整密度（南部和下中部更密集）
      let baseDensity = 0.6;
      if (y > 55 && y < 75) baseDensity = 0.85; // 中下部密集
      if (y > 65) baseDensity = 0.95; // 最南端最密集
      if (y < 20) baseDensity = 0.3; // 北部稀疏
      if (y > 20 && y < 35) baseDensity = 0.5; // 中上部中等
      
      // 中央區域密度更高
      if (Math.abs(dx) < 10) baseDensity *= 1.1;
      
      return Math.min(1, baseDensity);
    };
    
    // 生成符號，基於密度權重決定是否添加
    for (let i = 0; i < 4000; i++) {
      // 生成位置（留出邊緣空間，確保不被切到）
      const x = 3 + ((i * 23.7 + seed * 0.617) % 94);
      const y = 3 + ((i * 31.3 + seed * 0.823) % 94);
      
      // 根據密度權重決定是否添加此符號
      const density = getDensityWeight(x, y);
      const shouldAdd = ((i * 0.0273 + seed * 0.5) % 1) < density;
      
      if (shouldAdd) {
        // 添加隨機偏移，模擬自然分布和重疊
        const offsetX = ((i * 13.7 + seed * 0.11) % 40 - 20) / 3;
        const offsetY = ((i * 19.3 + seed * 0.17) % 40 - 20) / 3;
        
        // 確保偏移後仍在畫面內
        const finalX = Math.max(3, Math.min(97, x + offsetX));
        const finalY = Math.max(3, Math.min(97, y + offsetY));
        
        // 錯落出現的延遲：更長的時間範圍，更慢的節奏
        const random = ((i * 7.13 + seed * 0.43) % 1);
        const delay = Math.floor(random * random * 12000); // 0-12000ms
        
        arr.push({ x: finalX, y: finalY, delay });
      }
    }
    
    return arr.slice(0, 170); // 限制約 170 個符號，模擬圖片的 163 個
  }, []);

  useEffect(() => {
    // 添加 CSS 動畫
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInSymbol {
        from {
          opacity: 0;
          transform: scale(0.1) rotate(0deg);
        }
        to {
          opacity: 1;
          transform: scale(1) rotate(0deg);
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        overflow: "hidden",
      }}
    >
      {symbols.map((sym, idx) => (
        <div
          key={idx}
          style={{
            position: "absolute",
            left: `${sym.x}%`,
            top: `${sym.y}%`,
            color: "#e6eef9", // 不透明
            fontSize: "16px",
            lineHeight: 1,
            fontFamily: "sans-serif",
            fontWeight: 200,
            animation: `fadeInSymbol 1200ms ease-out ${sym.delay}ms both`,
          }}
        >
          ×
        </div>
      ))}
    </div>
  );
}

const BUILDINGS = [
  { name: "One57", imageUrl: undefined },
  { name: "432 Park Avenue", imageUrl: undefined },
  { name: "One WTC", imageUrl: undefined },
  { name: "30 Hudson Yards", imageUrl: undefined },
  { name: "The Edge", imageUrl: undefined },
  { name: "Via 57 West", imageUrl: undefined },
  { name: "10 Hudson Yards", imageUrl: undefined },
  { name: "One Manhattan West", imageUrl: undefined },
  { name: "15 Central Park West", imageUrl: undefined },
  { name: "56 Leonard Street", imageUrl: undefined },
  { name: "111 West 57th Street", imageUrl: undefined },
  { name: "425 Park Avenue", imageUrl: undefined },
];

const LINES = [
  "Since the 1950s, Manhattan has grown its skyline of glass-clad office towers.",
  "Today, many of New York's most celebrated buildings are made of glass.",
  "By day, glass draws light into the city's interiors;\n\nby night, it lets that light seep outward again—\n\nshaping the very image of the city.",
];

const ZONING_LINES = [
  {
    text: "Under New York City zoning regulations, if a building exceeds 125 feet in height, two separate buildings on the same zoning lot must be set at least 80 feet apart.",
    position: "top-left", // 左上標題下面
  },
  {
    text: "Most east–west cross streets in Manhattan have a legal width of approximately 60 feet.",
    position: "top-right", // 右上
  },
  {
    text: "Some major streets or cross-town avenues may be 100 feet wide or more.",
    position: "bottom-center", // 中下
  },
];

const REFLECTION_LINES = [
  "We can see each other.",
  "Even when you're at home, if you look out the window, you can see us",
  "and of course, we can see you too.",
  "",
  "In a city like New York, the boundary between public and private is blurred.",
  "Yet, this hasn't made the city any less lonely.",
  "We remain strangers, sharing space without connection.",
  "",
  "Glass exposes us, and isolates us at the same time.",
];

const LONELINESS_LINES = [
  "I see glass as a medium that cultivates loneliness.",
  "Through it, I peer at loneliness being nourished and reproduced",
  "like microorganisms slowly growing inside a transparent vessel.",
];

const ROWS = 5;
const COLS = 10;
// Grid: rows=6, cols=10, 0-indexed (左上角为0)
// User requirements (从左上角为1横向开始数):
// - 第一列第一个和下面一个: 位置1=索引0, 位置11=索引10
// - 第一行第八个和第十个: 位置8=索引7, 位置10=索引9
// - 第三行第六个和第四行第四个: 位置26=索引25(row 2 col 5), 位置34=索引33(row 3 col 3)
const KEPT = [0, 10, 7, 9, 25, 33]; // indices to keep

export default function Home() {
  const [hoverInfo, setHoverInfo] = useState<HoverInfo>(null);
  const [showTitle, setShowTitle] = useState(false);
  const [lineIndex, setLineIndex] = useState(-1);
  const [lineVisible, setLineVisible] = useState(false);
  const [copyActive, setCopyActive] = useState(false);
  const [copyShow, setCopyShow] = useState(false);
  const [phase, setPhase] = useState<'copy' | 'drop' | 'zoning' | 'density' | 'reflection'>('copy');
  const [dropProgress, setDropProgress] = useState(0);
  const [mousePx, setMousePx] = useState<{ x: number; y: number } | null>(null);
  
  // 推擠階段的三句話控制（自動依序浮現）
  const [zoningActive, setZoningActive] = useState(false);
  const [zoningLineIndex, setZoningLineIndex] = useState(-1);
  const [zoningLineVisible, setZoningLineVisible] = useState(false);
  const zoningTimerRef = useRef<number | null>(null);
  
  // 人口密度階段：圖形透明度和小叉叉符號
  const [keepTileOpacity, setKeepTileOpacity] = useState(0.6);
  const [densitySymbolsVisible, setDensitySymbolsVisible] = useState(false);
  const [zoningTextOpacity, setZoningTextOpacity] = useState(1);
  const [allowInteraction, setAllowInteraction] = useState(true); // 控制圖形是否可被推擠
  const [densityTitleVisible, setDensityTitleVisible] = useState(false);
  const [densityStatsVisible, setDensityStatsVisible] = useState(false);
  const [densityAnimationComplete, setDensityAnimationComplete] = useState(false); // 叉叉動畫是否完成
  
  // 反思階段：單個圖形動畫和文字
  const [reflectionProgress, setReflectionProgress] = useState(0); // 0-1，控制圖形動畫進度
  const [reflectionLineIndex, setReflectionLineIndex] = useState(-1);
  const [reflectionLineVisible, setReflectionLineVisible] = useState(false);
  const [reflectionTextActive, setReflectionTextActive] = useState(false);
  const [reflectionTextComplete, setReflectionTextComplete] = useState(false); // 所有文字是否顯示完
  const [shapeFollowingMouse, setShapeFollowingMouse] = useState(false); // 圖形是否跟隨鼠標
  const [textFadeOut, setTextFadeOut] = useState(false); // 文字是否淡出
  const [lonelinessTextVisible, setLonelinessTextVisible] = useState(false); // 孤獨文字是否顯示
  const [shapeScreenPos, setShapeScreenPos] = useState<{ x: number; y: number } | null>(null); // 圖形在屏幕上的位置
  const [smallShapeHover, setSmallShapeHover] = useState(false); // 小圖形是否被hover
  const [smallShapeClick, setSmallShapeClick] = useState(false); // 小圖形是否被點擊
  const [transitionToWindows, setTransitionToWindows] = useState(false); // 是否過渡到窗戶場景
  const [windowsSceneActive, setWindowsSceneActive] = useState(false); // 窗戶場景是否激活
  const [currentTime, setCurrentTime] = useState(7); // 當前時間（小時，7表示7:00am）
  const [shapeFadeOut, setShapeFadeOut] = useState(false); // 圖形是否淡出
  // 窗戶圖形的顏色配置（每個圖形0-3種顏色，使用seeded random確保一致性）
  const windowColors = useMemo(() => {
    const colors = [
      "#B0E0E6", // Cold light - 淡藍色
      "#FFF8DC", // Warm light - 淡黃色
      "#D2B48C", // See someone - 淡棕色
      "#98FB98", // See plants - 淡綠色
      "#E6E6FA", // TV light - 淡紫色
    ];
    const result: string[][] = [];
    // 使用seeded random生成每個圖形的顏色配置
    const seed = 12345;
    let seedValue = seed;
    const random = () => {
      seedValue = (seedValue * 9301 + 49297) % 233280;
      return seedValue / 233280;
    };
    for (let i = 0; i < 15; i++) {
      // 確保至少有一些圖形有顏色（前10個至少有1-3種顏色）
      const colorCount = i < 10 
        ? Math.max(1, Math.floor(random() * 3) + 1) // 1-3種顏色
        : Math.floor(random() * 4); // 0-3種顏色
      const selected: string[] = [];
      const available = [...colors];
      for (let j = 0; j < colorCount; j++) {
        const idx = Math.floor(random() * available.length);
        selected.push(available[idx]);
        available.splice(idx, 1);
      }
      result.push(selected);
    }
    console.log("Window colors generated:", result); // Debug
    return result;
  }, []);
  const reflectionLineIndexRef = useRef(-1);
  const reflectionCooldownRef = useRef(false);
  const reflectionWheelAccumRef = useRef(0);
  const reflectionLastStepAtRef = useRef(0);
  const reflectionTimerRef = useRef<number | null>(null);
  
  const lineIndexRef = useRef(-1);
  const cooldownRef = useRef(false);
  const wheelAccumRef = useRef(0);
  const lastStepAtRef = useRef(0);

  const reflectionAnimStartedRef = useRef(false);
  const reflectionRafRef = useRef<number | null>(null);

  // Activate copy after title appears
  useEffect(() => {
    if (!showTitle) return;
    const id = setTimeout(() => setCopyActive(true), 400);
    return () => clearTimeout(id);
  }, [showTitle]);

  // Trigger container fade-in
  useEffect(() => {
    if (!copyActive) {
      setCopyShow(false);
      return;
    }
    setCopyShow(false);
    const id = requestAnimationFrame(() => setCopyShow(true));
    return () => cancelAnimationFrame(id);
  }, [copyActive]);

  // Phase 1: Copy lines (wheel to switch lines)
  useEffect(() => {
    if (!copyActive || phase !== 'copy') return;
    
    setLineIndex(0);
    setLineVisible(false);
    const id0 = requestAnimationFrame(() => setLineVisible(true));
    lineIndexRef.current = 0;
    cooldownRef.current = false;
    wheelAccumRef.current = 0;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (cooldownRef.current) return;
      
      wheelAccumRef.current += e.deltaY;
      if (Math.abs(wheelAccumRef.current) < 50) return;
      
      const dir = wheelAccumRef.current > 0 ? 1 : -1;
      wheelAccumRef.current = 0;
      
      const now = performance.now();
      if (now - lastStepAtRef.current < 200) return;
      
      // If at last line and scrolling down, fade out text and enter drop phase
      if (dir > 0 && lineIndexRef.current >= LINES.length - 1) {
        cooldownRef.current = true;
        setCopyShow(false);
        setTimeout(() => {
          setPhase('drop');
          setDropProgress(0);
          cooldownRef.current = false;
        }, 400);
        return;
      }
      
      // Otherwise, switch lines
      const next = Math.max(0, Math.min(LINES.length - 1, lineIndexRef.current + dir));
      if (next === lineIndexRef.current) return;
      
      cooldownRef.current = true;
      setLineVisible(false);
      setTimeout(() => {
        lineIndexRef.current = next;
        setLineIndex(next);
        requestAnimationFrame(() => setLineVisible(true));
        lastStepAtRef.current = performance.now();
        setTimeout(() => {
          cooldownRef.current = false;
        }, 100);
      }, 150);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(id0);
      window.removeEventListener("wheel", onWheel as any);
    };
  }, [copyActive, phase]);

  // Phase 2: Drop phase (wheel controls drop progress)
  useEffect(() => {
    if (phase !== 'drop') return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = e.deltaY > 0 ? 0.03 : -0.03;
      setDropProgress((p) => {
        const np = Math.max(0, Math.min(1, p + step));
        // If scrolling back to 0, return to copy phase
        if (np <= 0 && step < 0) {
          setCopyShow(true);
          setPhase('copy');
          lineIndexRef.current = LINES.length - 1;
          setLineIndex(LINES.length - 1);
          setLineVisible(true);
        }
        // When dropProgress reaches 1, enter zoning phase
        if (np >= 1 && step > 0) {
          setTimeout(() => {
            setPhase('zoning');
            setZoningActive(true);
            // 開始自動依序浮現第一句話
            setZoningLineIndex(0);
            setZoningLineVisible(false);
            requestAnimationFrame(() => setZoningLineVisible(true));
          }, 200);
        }
        return np;
      });
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel as any);
  }, [phase]);

  // Phase 3: Zoning lines (自動依序浮現)
  useEffect(() => {
    if (!zoningActive || phase !== 'zoning') {
      // 清理定時器
      if (zoningTimerRef.current) {
        clearTimeout(zoningTimerRef.current);
        zoningTimerRef.current = null;
      }
      return;
    }

    // 當當前句子顯示後，延遲一段時間自動顯示下一句
    if (zoningLineIndex >= 0 && zoningLineVisible && zoningLineIndex < ZONING_LINES.length - 1) {
      zoningTimerRef.current = window.setTimeout(() => {
        setZoningLineVisible(false);
        setTimeout(() => {
          const next = zoningLineIndex + 1;
          setZoningLineIndex(next);
          requestAnimationFrame(() => setZoningLineVisible(true));
        }, 150);
      }, 2000); // 每句話顯示 2 秒後自動切換到下一句
    }

    return () => {
      if (zoningTimerRef.current) {
        clearTimeout(zoningTimerRef.current);
        zoningTimerRef.current = null;
      }
    };
  }, [zoningActive, phase, zoningLineIndex, zoningLineVisible]);

  // Phase 4: Density phase (滾動讓三句話消失，顯示小叉叉)
  useEffect(() => {
    if (phase !== 'zoning' && phase !== 'density') return;
    
    // 只有在三句話都顯示完後才能進入 density phase
    if (phase === 'zoning' && zoningLineIndex < ZONING_LINES.length - 1) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      if (phase === 'zoning' && e.deltaY > 0) {
        // 向下滾動，進入 density phase
        setPhase('density');
        setZoningTextOpacity(0);
        setKeepTileOpacity(0.08); // 變得更透明
        setDensitySymbolsVisible(true);
        setAllowInteraction(false); // 禁用推擠互動
        setDensityAnimationComplete(false); // 重置動畫完成狀態
        // 延遲顯示標題和統計信息，錯落淡入
        setDensityTitleVisible(false);
        setDensityStatsVisible(false);
        setTimeout(() => {
          setDensityTitleVisible(true);
        }, 400);
        setTimeout(() => {
          setDensityStatsVisible(true);
        }, 900);
        // 等待叉叉動畫完成（最長延遲 12000ms + 動畫 1200ms = 13200ms）
        setTimeout(() => {
          setDensityAnimationComplete(true);
        }, 13500); // 稍微延長一點確保動畫完全完成
      } else if (phase === 'density' && e.deltaY < 0) {
        // 向上滾動，返回 zoning phase
        setPhase('zoning');
        setZoningTextOpacity(1);
        setKeepTileOpacity(0.6);
        setDensitySymbolsVisible(false);
        setAllowInteraction(true); // 恢復推擠互動
        setDensityTitleVisible(false);
        setDensityStatsVisible(false);
        setDensityAnimationComplete(false);
      } else if (phase === 'density' && e.deltaY > 0) {
        // 向下滾動，但只有當動畫完成後才能進入 reflection phase
        if (!densityAnimationComplete) return;
        // 先設置 phase，然後再設置 reflectionProgress，確保組件知道已經進入 reflection 階段
        setPhase('reflection');
        setReflectionTextActive(false);
        setReflectionLineIndex(-1);
        // 其他內容淡出
        setDensitySymbolsVisible(false);
        setDensityTitleVisible(false);
        setDensityStatsVisible(false);
        setDensityAnimationComplete(false);
        
        
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel as any);
  }, [phase, zoningLineIndex, densityAnimationComplete]);

  // Phase 5: Reflection phase（自動逐句浮現；無需滾輪）
useEffect(() => {
  if (phase !== 'reflection') {
    // 離開反思階段：清理動畫旗標與計時器
    reflectionAnimStartedRef.current = false;
    if (reflectionRafRef.current != null) {
      cancelAnimationFrame(reflectionRafRef.current);
      reflectionRafRef.current = null;
    }
    if (reflectionTimerRef.current) {
      clearTimeout(reflectionTimerRef.current);
      reflectionTimerRef.current = null;
    }
    return;
  }

  // 防 StrictMode：只啟動一次
  if (reflectionAnimStartedRef.current) return;
  reflectionAnimStartedRef.current = true;

  // 參數：一行展示多久、空行間隔、淡入前的切換延遲
  const LINE_SHOW_MS = 2000; // 每句停留時間
  const BLANK_MS = 800;      // 空行較短的間隔
  const SWITCH_FADE_MS = 150;

  // 進入反思階段：先做單圖 2s 動畫
  setReflectionProgress(0);
  const duration = 2000;
  const startTime = performance.now();

  const advanceLine = () => {
    // 決定下一次切換的等待時間（空行短一些）
    const curr = reflectionLineIndexRef.current;
    const wait =
      REFLECTION_LINES[curr] === '' ? BLANK_MS : LINE_SHOW_MS;

      reflectionTimerRef.current = window.setTimeout(() => {
        // 已經是最後一句就不再前進，標記文字完成
        if (reflectionLineIndexRef.current >= REFLECTION_LINES.length - 1) {
          setReflectionTextComplete(true);
          return;
        }

        // 做一下淡出→切換→淡入
        setReflectionLineVisible(false);
        setTimeout(() => {
          const next = reflectionLineIndexRef.current + 1;
          reflectionLineIndexRef.current = next;
          setReflectionLineIndex(next);
          requestAnimationFrame(() => setReflectionLineVisible(true));
          // 排下一次
          advanceLine();
        }, SWITCH_FADE_MS);
      }, wait);
  };

  const animate = () => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(1, elapsed / duration);
    setReflectionProgress(progress);

    if (progress < 1) {
      reflectionRafRef.current = requestAnimationFrame(animate);
    } else {
      // 動畫完成後開始顯示第一句，並啟動自動前進
      setReflectionTextActive(true);
      setReflectionLineIndex(0);
      setReflectionLineVisible(false);
      requestAnimationFrame(() => setReflectionLineVisible(true));
      reflectionLineIndexRef.current = 0;
      advanceLine();
    }
  };

  reflectionRafRef.current = requestAnimationFrame(animate);

  return () => {
    if (reflectionRafRef.current != null) {
      cancelAnimationFrame(reflectionRafRef.current);
      reflectionRafRef.current = null;
    }
    if (reflectionTimerRef.current) {
      clearTimeout(reflectionTimerRef.current);
      reflectionTimerRef.current = null;
    }
  };
}, [phase]);

  // Track mouse for interaction
  useEffect(() => {
    const onMove = (e: MouseEvent) => setMousePx({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // 檢測圖形與鼠標碰撞，讓圖形跟隨鼠標
  useEffect(() => {
    if (!reflectionTextComplete || phase !== 'reflection' || shapeFollowingMouse) return;

    const checkCollision = () => {
      if (!mousePx || !shapeScreenPos) return;

      // 檢查鼠標是否在圖形附近（假設圖形大小約為80px）
      const dist = Math.hypot(
        mousePx.x - shapeScreenPos.x,
        mousePx.y - shapeScreenPos.y
      );
      const threshold = 100; // 碰撞檢測半徑（增加一些方便觸發）

      if (dist < threshold) {
        setShapeFollowingMouse(true);
        setTextFadeOut(true);
        setTimeout(() => {
          setLonelinessTextVisible(true);
        }, 500); // 文字淡出後顯示新文字
      }
    };

    const interval = setInterval(checkCollision, 50);
    return () => clearInterval(interval);
  }, [reflectionTextComplete, phase, mousePx, shapeScreenPos, shapeFollowingMouse]);

  // 檢測小圖形的hover（使用鼠標位置）
  useEffect(() => {
    if (!lonelinessTextVisible || transitionToWindows || !mousePx) {
      if (!transitionToWindows) setSmallShapeHover(false);
      return;
    }

    // 小圖形在屏幕中央下方，文字中心 + 文字高度/2 + margin
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2 + 100; // 文字中心大約在屏幕中央，小圖形在下方約100px
    const shapeSize = 20; // 圖形半徑

    const dist = Math.hypot(mousePx.x - centerX, mousePx.y - centerY);
    setSmallShapeHover(dist < 30); // 30px觸發範圍
  }, [lonelinessTextVisible, transitionToWindows, mousePx]);

  // 窗戶場景的時間軸滾動控制
  useEffect(() => {
    if (!windowsSceneActive) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setCurrentTime((prev) => {
        const step = e.deltaY > 0 ? 0.5 : -0.5; // 每次滾動0.5小時
        let newTime = prev + step;
        // 7:00am 到 5:00am (即 7 到 29，29表示第二天的5:00am)
        if (newTime < 7) newTime = 7;
        if (newTime > 29) newTime = 29;
        return newTime;
      });
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel as any);
  }, [windowsSceneActive]);

  // 注入融球淡入動畫樣式
  useEffect(() => {
    const styleId = 'fadeInBlobs-animation';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes fadeInBlobs {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
    console.log("fadeInBlobs animation style injected"); // Debug

    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

  return (
    <div style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
          <div
            style={{
              opacity: (transitionToWindows || windowsSceneActive) ? 0 : 1,
              transition: "opacity 1000ms ease-out",
            }}
          >
          <SceneCanvas>
              <QuatrefoilGrid
                rows={ROWS}
                cols={COLS}
                spacing={0.84}
                fadeInDuration={3}
                buildings={BUILDINGS}
                setHoverInfo={setHoverInfo}
                onComplete={() => setShowTitle(true)}
                keepIndices={KEPT}
                dropProgress={dropProgress}
                mousePx={windowsSceneActive || transitionToWindows ? null : (phase === 'reflection' && shapeFollowingMouse && !shapeFadeOut ? mousePx : (allowInteraction && phase !== 'reflection' ? mousePx : null))}
                keepTileOpacity={(shapeFadeOut || transitionToWindows || windowsSceneActive) ? 0 : keepTileOpacity}
                reflectionProgress={(phase === 'reflection' && !shapeFadeOut && !transitionToWindows && !windowsSceneActive) ? reflectionProgress : 0}
                phase={phase}
                shapeFollowingMouse={shapeFollowingMouse && !shapeFadeOut && !transitionToWindows && !windowsSceneActive}
                onShapeScreenPosChange={setShapeScreenPos}
              />
          </SceneCanvas>
          </div>
      <HUDTooltip hoverInfo={hoverInfo} />
      {/* 網頁標題：只在非 reflection 階段顯示，reflection 階段保留，窗戶場景也保留 */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          pointerEvents: "none",
          userSelect: "none",
          opacity: (showTitle && phase !== 'reflection') || phase === 'reflection' || windowsSceneActive ? 1 : 0,
          transition: phase === 'reflection' ? "none" : "opacity 0.8s ease-in",
          textShadow: "0 2px 24px rgba(0,0,0,0.45)",
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: 0.5 }}>Glass Microorganism</div>
      </div>
      {copyActive && (
        <div
          style={{
            position: "absolute",
            top: 120,
            right: 56,
            maxWidth: "46vw",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 10,
            lineHeight: 1.4,
            textAlign: "right",
            whiteSpace: "pre-line",
            overflow: "hidden",
            opacity: copyShow ? 1 : 0,
            transform: `translateY(${copyShow ? 0 : 12}px)`,
            transition: "opacity 800ms cubic-bezier(.2,.8,.2,1), transform 800ms cubic-bezier(.2,.8,.2,1)",
          }}
        >
          <div
            style={{
              opacity: lineVisible ? 1 : 0,
              transform: `translateY(${lineVisible ? 0 : 12}px)`,
              transition: "opacity 800ms cubic-bezier(.2,.8,.2,1), transform 800ms cubic-bezier(.2,.8,.2,1)",
              color: "#e6eef9",
            }}
          >
            {LINES[lineIndex >= 0 ? lineIndex : 0]}
          </div>
        </div>
      )}
      {/* 推擠階段的三句話（自動依序浮現） */}
      {zoningActive && (
        <>
          {/* 第一句話：左上標題下面 */}
          {zoningLineIndex >= 0 && (
            <div
              style={{
                position: "absolute",
                top: 120,
                left: 24,
                maxWidth: "25vw",
                pointerEvents: "none",
                userSelect: "none",
                zIndex: 10,
                lineHeight: 1.6,
                opacity: (zoningLineIndex === 0 && zoningLineVisible ? 1 : zoningLineIndex > 0 ? 1 : 0) * zoningTextOpacity,
                transform: `translateY(${zoningLineIndex === 0 && zoningLineVisible ? 0 : zoningLineIndex > 0 ? 0 : 12}px)`,
                transition: "opacity 1400ms cubic-bezier(.2,.8,.2,1), transform 1400ms cubic-bezier(.2,.8,.2,1)",
                color: "#e6eef9",
              }}
            >
              {ZONING_LINES[0].text}
            </div>
          )}
          {/* 第二句話：右上 */}
          {zoningLineIndex >= 1 && (
            <div
              style={{
                position: "absolute",
                top: 160,
                right: 56,
                maxWidth: "25vw",
                pointerEvents: "none",
                userSelect: "none",
                zIndex: 10,
                lineHeight: 1.6,
                textAlign: "right",
                opacity: (zoningLineIndex === 1 && zoningLineVisible ? 1 : zoningLineIndex > 1 ? 1 : 0) * zoningTextOpacity,
                transform: `translateY(${zoningLineIndex === 1 && zoningLineVisible ? 0 : zoningLineIndex > 1 ? 0 : 12}px)`,
                transition: "opacity 1400ms cubic-bezier(.2,.8,.2,1), transform 1400ms cubic-bezier(.2,.8,.2,1)",
                color: "#e6eef9",
              }}
            >
              {ZONING_LINES[1].text}
            </div>
          )}
          {/* 第三句話：中下 */}
          {zoningLineIndex >= 2 && (
            <div
              style={{
                position: "absolute",
                bottom: "20%",
                left: "45%",
                maxWidth: "35vw",
                pointerEvents: "none",
                userSelect: "none",
                zIndex: 10,
                lineHeight: 1.6,
                textAlign: "center",
                opacity: (zoningLineIndex === 2 && zoningLineVisible ? 1 : 1) * zoningTextOpacity,
                transform: `translate(-50%, ${zoningLineIndex === 2 && zoningLineVisible ? 0 : 0}px)`,
                transition: "opacity 1400ms cubic-bezier(.2,.8,.2,1), transform 1400ms cubic-bezier(.2,.8,.2,1)",
                color: "#e6eef9",
              }}
            >
              {ZONING_LINES[2].text}
            </div>
          )}
        </>
      )}
      {/* 人口密度小叉叉符號 */}
      {densitySymbolsVisible && phase !== 'reflection' && (
        <>
          <DensitySymbols />
          {/* 標題：左上角 */}
          <div
            style={{
              position: "absolute",
              top: 120,
              left: 32,
              pointerEvents: "none",
              userSelect: "none",
              zIndex: 10,
              opacity: densityTitleVisible ? 1 : 0,
              transform: `translateY(${densityTitleVisible ? 0 : 12}px)`,
              transition: "opacity 1400ms cubic-bezier(.2,.8,.2,1), transform 1400ms cubic-bezier(.2,.8,.2,1)",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 600, color: "#ffffff", letterSpacing: 0.3, textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}>
              Manhattan Land Area & Population Density
            </div>
            <div style={{ fontSize: 13, fontWeight: 400, color: "#e6eef9", marginTop: 4, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
              (Each × ≈ 10,000 people)
            </div>
          </div>
          {/* 統計信息：右上角 */}
          <div
            style={{
              position: "absolute",
              top: 140,
              right: 56,
              pointerEvents: "none",
              userSelect: "none",
              zIndex: 10,
              textAlign: "right",
              lineHeight: 1.8,
              opacity: densityStatsVisible ? 1 : 0,
              transform: `translateY(${densityStatsVisible ? 0 : 12}px)`,
              transition: "opacity 1400ms cubic-bezier(.2,.8,.2,1), transform 1400ms cubic-bezier(.2,.8,.2,1)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500, color: "#ffffff", textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>Land Area: 22.83 sq mi</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#ffffff", textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>Population: 1,629,153</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#ffffff", textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>Density: 71,360 people/sq mi</div>
          </div>
        </>
      )}
      {/* 反思階段文字 */}
      {phase === 'reflection' && reflectionTextActive && !textFadeOut && (
        <div
          style={{
            position: "absolute",
            bottom: "15%",
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "60vw",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 10,
            lineHeight: 1.6,
            textAlign: "center",
            opacity: textFadeOut ? 0 : 1,
            transition: "opacity 800ms ease-out",
          }}
        >
          {REFLECTION_LINES.map((line, idx) => {
            if (idx > reflectionLineIndex) return null;
            const isCurrent = idx === reflectionLineIndex;
            const isVisible = isCurrent && reflectionLineVisible;
            
            if (line === "") {
              // 空行
              return <div key={idx} style={{ height: "1.5em" }} />;
            }
            
            return (
              <div
                key={idx}
                style={{
                  opacity: isCurrent ? (isVisible ? 1 : 0) : 1,
                  transform: `translateY(${isCurrent ? (isVisible ? 0 : 12) : 0}px)`,
                  transition: isCurrent ? "opacity 800ms cubic-bezier(.2,.8,.2,1), transform 800ms cubic-bezier(.2,.8,.2,1)" : "none",
                  color: "#ffffff",
                  fontSize: "16px",
                  marginBottom: "0.8em",
                  textShadow: "0 2px 16px rgba(0,0,0,0.6)",
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      )}
      {/* 孤獨文字 - 只能通過圖形區域看到 */}
      {phase === 'reflection' && lonelinessTextVisible && !transitionToWindows && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            WebkitMaskImage: (shapeFollowingMouse && mousePx)
              ? `radial-gradient(circle 65px at ${mousePx.x}px ${mousePx.y}px, black 0%, black 98%, transparent 100%)`
              : shapeScreenPos 
              ? `radial-gradient(circle 65px at ${shapeScreenPos.x}px ${shapeScreenPos.y}px, black 0%, black 98%, transparent 100%)`
              : undefined,
            maskImage: (shapeFollowingMouse && mousePx)
              ? `radial-gradient(circle 65px at ${mousePx.x}px ${mousePx.y}px, black 0%, black 98%, transparent 100%)`
              : shapeScreenPos
              ? `radial-gradient(circle 65px at ${shapeScreenPos.x}px ${shapeScreenPos.y}px, black 0%, black 98%, transparent 100%)`
              : undefined,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            opacity: transitionToWindows ? 0 : 1,
            transition: "opacity 1000ms ease-out",
          }}
          key={shapeFollowingMouse && mousePx ? `${mousePx.x}-${mousePx.y}` : 'static'}
        >
          <div
            style={{
              maxWidth: "60vw",
              lineHeight: 1.8,
              textAlign: "center",
              color: "#ffffff",
              fontSize: "18px",
              textShadow: "0 2px 20px rgba(0,0,0,0.8)",
              opacity: lonelinessTextVisible ? 1 : 0,
              transition: "opacity 1000ms ease-in",
            }}
          >
            {LONELINESS_LINES.map((line, idx) => (
              <div key={idx} style={{ marginBottom: "1em" }}>
                {line}
              </div>
            ))}
          </div>
          {/* 小圖形 - 文字下方，穩定顯示 */}
          <div
            style={{
              marginTop: "60px",
              width: "40px",
              height: "40px",
              pointerEvents: "auto",
              cursor: "pointer",
              position: "relative",
              opacity: smallShapeHover ? 1 : 0.3,
              transform: smallShapeHover ? "scale(1.15)" : "scale(1)",
              transition: "transform 300ms ease-out, opacity 300ms ease-out",
            }}
            onClick={() => {
              setSmallShapeClick(true);
              setTransitionToWindows(true);
              setTimeout(() => {
                setWindowsSceneActive(true);
              }, 1000);
            }}
          >
            {/* 使用SVG繪製小quatrefoil - 完全複製Quatrefoil的形狀 */}
            <svg
              width="40"
              height="40"
              viewBox="-0.4 -0.4 0.8 0.8"
              style={{ width: "100%", height: "100%" }}
              preserveAspectRatio="xMidYMid meet"
            >
              <path
                d="M 0.2 -0.2 A 0.2 0.2 0 0 1 0.2 0.2 A 0.2 0.2 0 0 1 -0.2 0.2 A 0.2 0.2 0 0 1 -0.2 -0.2 A 0.2 0.2 0 0 1 0.2 -0.2 Z"
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.03"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}
      {/* 窗戶場景 */}
      {windowsSceneActive && (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 30,
              opacity: windowsSceneActive ? 1 : 0,
              transition: "opacity 1000ms ease-in",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              paddingLeft: "20%",
              paddingRight: "80px", // 為時間軸留空間
              gap: "60px",
            }}
          >
        {/* 左側：15個窗戶圖形 (3x5) - 使用四葉草形狀 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(5, 1fr)",
              gap: "30px",
              width: "450px",
              height: "750px",
            }}
          >
            {Array.from({ length: 15 }).map((_, idx) => {
              const colors = windowColors[idx] || [];
              console.log(`Window ${idx}: colors =`, colors, "length =", colors.length); // Debug
              return (
                <div
                  key={idx}
                  style={{
                    width: "120px",
                    height: "120px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0.6,
                    transition: "opacity 200ms ease",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* 四葉草形狀的SVG線框 - 完全複製Quatrefoil的形狀 (radius=0.4, petalRadius=0.2) */}
                  <svg
                    width="120"
                    height="120"
                    viewBox="-0.4 -0.4 0.8 0.8"
                    style={{ width: "100%", height: "100%", position: "relative", zIndex: 2, pointerEvents: "none" }}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      <clipPath id={`quatrefoil-clip-${idx}`}>
                        <path
                          d="M 0.2 -0.2 A 0.2 0.2 0 0 1 0.2 0.2 A 0.2 0.2 0 0 1 -0.2 0.2 A 0.2 0.2 0 0 1 -0.2 -0.2 A 0.2 0.2 0 0 1 0.2 -0.2 Z"
                        />
                      </clipPath>
                    </defs>
                    <path
                      d="M 0.2 -0.2 A 0.2 0.2 0 0 1 0.2 0.2 A 0.2 0.2 0 0 1 -0.2 0.2 A 0.2 0.2 0 0 1 -0.2 -0.2 A 0.2 0.2 0 0 1 0.2 -0.2 Z"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="0.03"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {/* 融球動畫 - 進入畫面後漸漸浮現 */}
                  {colors.length > 0 ? (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        opacity: 0,
                        animation: `fadeInBlobs 2s ease-in forwards ${idx * 0.15}s`,
                        pointerEvents: "none",
                        zIndex: 1,
                      }}
                      key={`blobs-wrapper-${idx}`}
                    >
                      <WindowBlobs colors={colors} index={idx} />
                    </div>
                  ) : null}
    </div>
  );
            })}
          </div>
          {/* 中間：顏色圖例 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              paddingTop: "40px",
              marginLeft: "100px", // 往右移動更多
            }}
          >
            {/* Cold light - 淡藍色 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#B0E0E6",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "14px",
                  fontFamily: "sans-serif",
                }}
              >
                Cold light
              </span>
            </div>
            {/* Warm light - 淡黃色 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#FFF8DC",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "14px",
                  fontFamily: "sans-serif",
                }}
              >
                Warm light
              </span>
            </div>
            {/* See someone - 淡棕色 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#D2B48C",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "14px",
                  fontFamily: "sans-serif",
                }}
              >
                See someone
              </span>
            </div>
            {/* See plants - 淡綠色 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#98FB98",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "14px",
                  fontFamily: "sans-serif",
                }}
              >
                See plants
              </span>
            </div>
            {/* TV light - 淡紫色 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#E6E6FA",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "14px",
                  fontFamily: "sans-serif",
                }}
              >
                TV light
              </span>
            </div>
            {/* Eye contact - 淡紅色 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: "#FFB6C1",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "14px",
                  fontFamily: "sans-serif",
                }}
              >
                Eye contact
              </span>
            </div>
          </div>
          {/* 右側：時間軸 - 在畫面右邊緣 */}
          <div
            style={{
              position: "absolute",
              right: "0",
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              height: "80vh",
              justifyContent: "space-between",
              paddingTop: "60px",
              paddingBottom: "60px",
              paddingRight: "20px",
            }}
          >
            {/* 時間軸線 */}
            <div
              style={{
                position: "absolute",
                right: "0",
                top: "60px",
                bottom: "60px",
                width: "2px",
                background: "#ffffff",
                opacity: 0.4,
              }}
            />
            {/* 時間刻度 - 每小時一個刻度 */}
            {(() => {
              const times = [];
              // 從 7:00 AM 到 5:00 AM (第二天，即29小時)
              for (let h = 7; h <= 29; h++) {
                times.push(h);
              }
              return times.map((h) => {
                const position = ((h - 7) / 22) * 100;
                let displayHour: number;
                let period: string;
                
                if (h < 12) {
                  displayHour = h;
                  period = "AM";
                } else if (h === 12) {
                  displayHour = 12;
                  period = "PM";
                } else if (h < 24) {
                  displayHour = h - 12;
                  period = "PM";
                } else if (h === 24) {
                  displayHour = 12;
                  period = "AM";
                } else {
                  displayHour = h - 24;
                  period = "AM";
                }
                
  return (
                  <div
                    key={h}
        style={{
                      position: "absolute",
                      right: "8px",
                      top: `${position}%`,
                      transform: "translateY(-50%)",
                      fontSize: "11px",
                      color: "#ffffff",
                      whiteSpace: "nowrap",
                      opacity: 0.7,
                      fontFamily: "monospace",
                    }}
                  >
                    {`${displayHour}:00 ${period}`}
                  </div>
                );
              });
            })()}
            {/* 當前時間指示器 */}
            <div
              style={{
                position: "absolute",
                right: "-6px",
                top: `${((currentTime - 7) / 22) * 100}%`,
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                background: "#ffffff",
                transform: "translateY(-50%)",
                boxShadow: "0 0 10px rgba(255,255,255,0.8)",
                transition: "top 100ms ease-out",
              }}
            />
          </div>
      </div>
        </>
      )}
    </div>
  );
}
