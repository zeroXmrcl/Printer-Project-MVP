"use client";

import { Component, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { artGalleryIndex } from "../../lib/art-gallery-hit";

/** ObsidianUI Art Gallery. Shader, drag, and the 28rem black stage match the published component. */

const defaultConfig = {
  cellSize: 0.75,
  zoomLevel: 1.25,
  lerpFactor: 0.075,
  borderColor: "rgba(255, 255, 255, 0.15)",
  backgroundColor: "rgba(0, 0, 0, 1)",
  textColor: "rgba(128, 128, 128, 1)",
  hoverColor: "rgba(255, 255, 255, 0)",
};

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform vec2 uOffset;
  uniform vec2 uResolution;
  uniform vec4 uBorderColor;
  uniform vec4 uHoverColor;
  uniform vec4 uBackgroundColor;
  uniform vec2 uMousePos;
  uniform float uZoom;
  uniform float uCellSize;
  uniform float uTextureCount;
  uniform sampler2D uImageAtlas;
  uniform sampler2D uTextAtlas;
  varying vec2 vUv;

  void main() {
    vec2 screenUV = (vUv - 0.5) * 2.0;
    float radius = length(screenUV);
    float distortion = 1.0 - 0.08 * radius * radius;
    vec2 distortedUV = screenUV * distortion;
    vec2 aspectRatio = vec2(uResolution.x / uResolution.y, 1.0);
    vec2 worldCoord = distortedUV * aspectRatio;
    worldCoord *= uZoom;
    worldCoord += uOffset;
    vec2 cellPos = worldCoord / uCellSize;
    vec2 cellId = floor(cellPos);
    vec2 cellUV = fract(cellPos);
    vec2 mouseScreenUV = (uMousePos / uResolution) * 2.0 - 1.0;
    mouseScreenUV.y = -mouseScreenUV.y;
    float mouseRadius = length(mouseScreenUV);
    float mouseDistortion = 1.0 - 0.08 * mouseRadius * mouseRadius;
    vec2 mouseDistortedUV = mouseScreenUV * mouseDistortion;
    vec2 mouseWorldCoord = mouseDistortedUV * aspectRatio;
    mouseWorldCoord *= uZoom;
    mouseWorldCoord += uOffset;
    vec2 mouseCellPos = mouseWorldCoord / uCellSize;
    vec2 mouseCellId = floor(mouseCellPos);
    vec2 cellCenter = cellId + 0.5;
    vec2 mouseCellCenter = mouseCellId + 0.5;
    float cellDistance = length(cellCenter - mouseCellCenter);
    float hoverIntensity = 1.0 - smoothstep(0.4, 0.7, cellDistance);
    bool isHovered = hoverIntensity > 0.0 && uMousePos.x >= 0.0;
    vec3 backgroundColor = uBackgroundColor.rgb;
    if (isHovered) {
      backgroundColor = mix(uBackgroundColor.rgb, uHoverColor.rgb, hoverIntensity * uHoverColor.a);
    }
    float lineWidth = 0.005;
    float gridX = smoothstep(0.0, lineWidth, cellUV.x) * smoothstep(0.0, lineWidth, 1.0 - cellUV.x);
    float gridY = smoothstep(0.0, lineWidth, cellUV.y) * smoothstep(0.0, lineWidth, 1.0 - cellUV.y);
    float gridMask = gridX * gridY;
    float imageSize = 0.6;
    float imageBorder = (1.0 - imageSize) * 0.5;
    vec2 imageUV = (cellUV - imageBorder) / imageSize;
    float edgeSmooth = 0.01;
    vec2 imageMask = smoothstep(-edgeSmooth, edgeSmooth, imageUV) *
                    smoothstep(-edgeSmooth, edgeSmooth, 1.0 - imageUV);
    float imageAlpha = imageMask.x * imageMask.y;
    bool inImageArea = imageUV.x >= 0.0 && imageUV.x <= 1.0 && imageUV.y >= 0.0 && imageUV.y <= 1.0;
    float textHeight = 0.08;
    float textY = 0.88;
    bool inTextArea = cellUV.x >= 0.05 && cellUV.x <= 0.95 && cellUV.y >= textY && cellUV.y <= (textY + textHeight);
    float texIndex = mod(cellId.x + cellId.y * 3.0, uTextureCount);
    vec3 color = backgroundColor;
    if (inImageArea && imageAlpha > 0.0) {
      float atlasSize = ceil(sqrt(uTextureCount));
      vec2 atlasPos = vec2(mod(texIndex, atlasSize), floor(texIndex / atlasSize));
      vec2 atlasUV = (atlasPos + imageUV) / atlasSize;
      atlasUV.y = 1.0 - atlasUV.y;
      vec3 imageColor = texture2D(uImageAtlas, atlasUV).rgb;
      color = mix(color, imageColor, imageAlpha);
    }
    if (inTextArea) {
      vec2 textCoord = vec2((cellUV.x - 0.05) / 0.9, (cellUV.y - textY) / textHeight);
      textCoord.y = 1.0 - textCoord.y;
      float atlasSize = ceil(sqrt(uTextureCount));
      vec2 atlasPos = vec2(mod(texIndex, atlasSize), floor(texIndex / atlasSize));
      vec2 atlasUV = (atlasPos + textCoord) / atlasSize;
      vec4 textColor = texture2D(uTextAtlas, atlasUV);
      color = mix(backgroundColor, textColor.rgb, textColor.a);
    }
    vec3 borderRGB = uBorderColor.rgb;
    float borderAlpha = uBorderColor.a;
    color = mix(color, borderRGB, (1.0 - gridMask) * borderAlpha);
    float fade = 1.0 - smoothstep(1.2, 1.8, radius);
    gl_FragColor = vec4(color * fade, 1.0);
  }
`;

type ThreeNS = typeof import("three");
type GalleryItem = { title: string; year: string | number };

function rgbaToArray(rgba: string): [number, number, number, number] {
  const match = rgba.match(/rgba?\(([^)]+)\)/);
  if (!match?.[1]) return [1, 1, 1, 1];
  const parts = match[1].split(",");
  return [
    Number.parseFloat(parts[0] ?? "255") / 255,
    Number.parseFloat(parts[1] ?? "255") / 255,
    Number.parseFloat(parts[2] ?? "255") / 255,
    Number.parseFloat(parts[3] ?? "1"),
  ];
}

function createTextTexture(THREE: ThreeNS, title: string, year: string | number, textColor: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 2048, 256);
    ctx.font = "80px monospace";
    ctx.fillStyle = textColor;
    ctx.textBaseline = "middle";
    ctx.imageSmoothingEnabled = false;
    ctx.textAlign = "left";
    ctx.fillText(String(title).toUpperCase(), 30, 128);
    ctx.textAlign = "right";
    ctx.fillText(String(year), 2048 - 30, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function blankTexture(THREE: ThreeNS) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, 512, 512);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function loadImageTexture(THREE: ThreeNS, src: string): Promise<InstanceType<ThreeNS["Texture"]> | null> {
  return new Promise((resolve) => {
    const image = new Image();
    let retries = 0;
    if (/^https?:\/\//.test(src)) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      image.decode().catch(() => undefined).then(() => {
        const texture = new THREE.Texture(image);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        resolve(texture);
      });
    };
    image.onerror = () => {
      if (retries === 0) {
        retries = 1;
        image.src = `${src}${src.includes("?") ? "&" : "?"}retry=1`;
        return;
      }
      resolve(null);
    };
    image.src = src;
  });
}

function createTextureAtlas(THREE: ThreeNS, textures: InstanceType<ThreeNS["Texture"]>[], isText = false) {
  const atlasSize = Math.ceil(Math.sqrt(textures.length));
  const textureSize = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = atlasSize * textureSize;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    if (isText) ctx.clearRect(0, 0, canvas.width, canvas.height);
    else {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const fallback = textures.find((texture) => texture.image);
    const fallbackSource = fallback?.image as CanvasImageSource | undefined;
    textures.forEach((texture, index) => {
      const x = (index % atlasSize) * textureSize;
      const y = Math.floor(index / atlasSize) * textureSize;
      const src = texture.image as CanvasImageSource | undefined;
      if (!src) return;
      try {
        ctx.drawImage(src, x, y, textureSize, textureSize);
      } catch {
        if (fallbackSource) ctx.drawImage(fallbackSource, x, y, textureSize, textureSize);
      }
    });
  }
  const atlasTexture = new THREE.CanvasTexture(canvas);
  atlasTexture.wrapS = THREE.ClampToEdgeWrapping;
  atlasTexture.wrapT = THREE.ClampToEdgeWrapping;
  atlasTexture.minFilter = THREE.LinearFilter;
  atlasTexture.magFilter = THREE.LinearFilter;
  atlasTexture.flipY = false;
  atlasTexture.colorSpace = THREE.SRGBColorSpace;
  return atlasTexture;
}

type SceneProps = {
  images: string[];
  items: GalleryItem[];
  cellSize: number;
  zoomLevel: number;
  showHint: boolean;
  reducedMotion: boolean;
  onSelect?: (index: number) => void;
};

function ArtGalleryScene({ images, items, cellSize, zoomLevel, showHint, reducedMotion, onSelect }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const imagesRef = useRef(images);
  const itemsRef = useRef(items);
  imagesRef.current = images;
  itemsRef.current = items;
  const signature = images.map((src, index) => `${src}\n${items[index]?.title ?? ""}\n${items[index]?.year ?? ""}`).join("\n");

  useEffect(() => {
    const container = containerRef.current;
    const imagesNow = imagesRef.current;
    const itemsNow = itemsRef.current;
    if (!container || imagesNow.length === 0) return;
    setReady(false);
    setFailed(false);

    let cancelled = false;
    let animFrameId = 0;
    let renderer: InstanceType<ThreeNS["WebGLRenderer"]> | undefined;
    let geometry: InstanceType<ThreeNS["PlaneGeometry"]> | undefined;
    let material: InstanceType<ThreeNS["ShaderMaterial"]> | undefined;
    let imageAtlas: InstanceType<ThreeNS["Texture"]> | undefined;
    let textAtlas: InstanceType<ThreeNS["Texture"]> | undefined;
    const loadedTextures: InstanceType<ThreeNS["Texture"]>[] = [];
    let uniforms: {
      uOffset: { value: InstanceType<ThreeNS["Vector2"]> };
      uResolution: { value: InstanceType<ThreeNS["Vector2"]> };
      uBorderColor: { value: InstanceType<ThreeNS["Vector4"]> };
      uHoverColor: { value: InstanceType<ThreeNS["Vector4"]> };
      uBackgroundColor: { value: InstanceType<ThreeNS["Vector4"]> };
      uMousePos: { value: InstanceType<ThreeNS["Vector2"]> };
      uZoom: { value: number };
      uCellSize: { value: number };
      uTextureCount: { value: number };
      uImageAtlas: { value: InstanceType<ThreeNS["Texture"]> };
      uTextAtlas: { value: InstanceType<ThreeNS["Texture"]> };
    } | null = null;

    const state = {
      isDragging: false,
      previousPointer: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
      targetOffset: { x: 0, y: 0 },
      mousePosition: { x: -1, y: -1 },
      zoom: 1,
      targetZoom: 1,
    };
    let downX = 0;
    let downY = 0;

    let detach = () => {};

    const boot = async () => {
      const THREE = await import("three");
      if (cancelled) return;

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 1;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const bgColor = rgbaToArray(defaultConfig.backgroundColor);
      renderer.setClearColor(new THREE.Color(bgColor[0], bgColor[1], bgColor[2]), bgColor[3]);
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.touchAction = "none";
      container.appendChild(renderer.domElement);

      const lerpFactor = reducedMotion ? 1 : defaultConfig.lerpFactor;
      const dragZoom = reducedMotion ? 1 : zoomLevel;

      const animate = () => {
        animFrameId = requestAnimationFrame(animate);
        state.offset.x += (state.targetOffset.x - state.offset.x) * lerpFactor;
        state.offset.y += (state.targetOffset.y - state.offset.y) * lerpFactor;
        state.zoom += (state.targetZoom - state.zoom) * lerpFactor;
        if (uniforms) {
          uniforms.uOffset.value.set(state.offset.x, state.offset.y);
          uniforms.uZoom.value = state.zoom;
        }
        renderer?.render(scene, camera);
      };

      const updateMousePosition = (event: PointerEvent) => {
        if (!renderer) return;
        const rect = renderer.domElement.getBoundingClientRect();
        state.mousePosition.x = event.clientX - rect.left;
        state.mousePosition.y = event.clientY - rect.top;
        uniforms?.uMousePos.value.set(state.mousePosition.x, state.mousePosition.y);
      };

      const startDrag = (x: number, y: number) => {
        state.isDragging = true;
        state.previousPointer.x = x;
        state.previousPointer.y = y;
        container.classList.add("is-dragging");
      };

      const handleMove = (x: number, y: number) => {
        if (!state.isDragging) return;
        const deltaX = x - state.previousPointer.x;
        const deltaY = y - state.previousPointer.y;
        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
          if (state.targetZoom === 1) state.targetZoom = dragZoom;
        }
        state.targetOffset.x -= deltaX * 0.003;
        state.targetOffset.y += deltaY * 0.003;
        state.previousPointer.x = x;
        state.previousPointer.y = y;
      };

      const endDrag = () => {
        state.isDragging = false;
        state.targetZoom = 1;
        container.classList.remove("is-dragging");
      };

      const onPointerDown = (event: PointerEvent) => {
        event.preventDefault();
        downX = event.clientX;
        downY = event.clientY;
        container.setPointerCapture?.(event.pointerId);
        startDrag(event.clientX, event.clientY);
      };
      const onPointerMove = (event: PointerEvent) => {
        updateMousePosition(event);
        handleMove(event.clientX, event.clientY);
      };
      const finishPointer = (event: PointerEvent, click: boolean) => {
        if (container.hasPointerCapture?.(event.pointerId)) container.releasePointerCapture(event.pointerId);
        const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
        endDrag();
        if (!click || moved > 5 || !renderer) return;
        const rect = renderer.domElement.getBoundingClientRect();
        const index = artGalleryIndex(
          { x: event.clientX - rect.left, y: event.clientY - rect.top },
          { width: rect.width, height: rect.height },
          state.offset,
          state.zoom,
          cellSize,
          imagesNow.length,
        );
        if (index !== null) onSelectRef.current?.(index);
      };
      const onPointerUp = (event: PointerEvent) => finishPointer(event, true);
      const onPointerCancel = (event: PointerEvent) => finishPointer(event, false);
      const onPointerLeave = () => {
        state.mousePosition.x = -1;
        state.mousePosition.y = -1;
        uniforms?.uMousePos.value.set(-1, -1);
        endDrag();
      };
      const onResize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (!width || !height || !renderer) return;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        uniforms?.uResolution.value.set(width, height);
      };

      const loadedImages = await Promise.all(imagesNow.map((src) => loadImageTexture(THREE, src)));
      if (cancelled) {
        loadedImages.forEach((texture) => texture?.dispose());
        return;
      }
      const replacement = loadedImages.find((texture) => texture) ?? blankTexture(THREE);
      const imageTiles = loadedImages.map((texture) => texture ?? replacement);
      loadedTextures.push(...new Set(imageTiles));
      const textTextures = itemsNow.map((item) => createTextTexture(THREE, item.title, item.year, defaultConfig.textColor));
      loadedTextures.push(...textTextures);
      imageAtlas = createTextureAtlas(THREE, imageTiles, false);
      textAtlas = createTextureAtlas(THREE, textTextures, true);
      if (cancelled) return;

      const border = rgbaToArray(defaultConfig.borderColor);
      const hover = rgbaToArray(defaultConfig.hoverColor);
      const background = rgbaToArray(defaultConfig.backgroundColor);
      uniforms = {
        uOffset: { value: new THREE.Vector2(0, 0) },
        uResolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
        uBorderColor: { value: new THREE.Vector4(border[0], border[1], border[2], border[3]) },
        uHoverColor: { value: new THREE.Vector4(hover[0], hover[1], hover[2], hover[3]) },
        uBackgroundColor: { value: new THREE.Vector4(background[0], background[1], background[2], background[3]) },
        uMousePos: { value: new THREE.Vector2(-1, -1) },
        uZoom: { value: 1 },
        uCellSize: { value: cellSize },
        uTextureCount: { value: imagesNow.length },
        uImageAtlas: { value: imageAtlas },
        uTextAtlas: { value: textAtlas },
      };
      geometry = new THREE.PlaneGeometry(2, 2);
      material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });
      scene.add(new THREE.Mesh(geometry, material));

      container.addEventListener("pointerdown", onPointerDown);
      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerup", onPointerUp);
      container.addEventListener("pointercancel", onPointerCancel);
      container.addEventListener("pointerleave", onPointerLeave);
      const observer = new ResizeObserver(onResize);
      observer.observe(container);
      detach = () => {
        container.removeEventListener("pointerdown", onPointerDown);
        container.removeEventListener("pointermove", onPointerMove);
        container.removeEventListener("pointerup", onPointerUp);
        container.removeEventListener("pointercancel", onPointerCancel);
        container.removeEventListener("pointerleave", onPointerLeave);
        observer.disconnect();
      };
      animate();
      setReady(true);
    };

    boot().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameId);
      detach();
      container.classList.remove("is-dragging");
      loadedTextures.forEach((texture) => texture.dispose());
      imageAtlas?.dispose();
      textAtlas?.dispose();
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
      if (renderer?.domElement.parentNode === container) container.removeChild(renderer.domElement);
    };
  }, [signature, cellSize, zoomLevel, reducedMotion]);

  return (
    <div className={ready ? "art-gallery-scene is-ready" : "art-gallery-scene"}>
      <div ref={containerRef} className="art-gallery-stage" />
      {ready || failed ? null : (
        <div className="art-gallery-loader" role="status" aria-live="polite">
          <GooeyLoader />
        </div>
      )}
      {ready && showHint ? <div className="art-gallery-hint">drag to explore</div> : null}
    </div>
  );
}

function GooeyLoader() {
  const filterId = `gooey-${useId().replace(/:/g, "")}`;
  const reduced = useReducedMotion();
  return (
    <div className="gooey" role="status" aria-label="Loading">
      <svg aria-hidden="true" focusable="false" className="gooey-svg">
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="gooey" />
            <feBlend in="SourceGraphic" in2="gooey" />
          </filter>
        </defs>
      </svg>
      <span aria-hidden="true" className="gooey-dots" style={{ filter: `url(#${filterId})` }}>
        {[0, 1, 2].map((index) => (
          <span key={index} className={reduced ? "gooey-dot" : "gooey-dot gooey-dot-move"} style={{ animationDelay: `${index * 0.2}s` }} />
        ))}
      </span>
    </div>
  );
}

const subscribeMotion = (notify: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
}

let webglAvailable: boolean | undefined;
function supportsWebGL() {
  if (webglAvailable !== undefined) return webglAvailable;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    webglAvailable = Boolean(context);
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglAvailable = false;
  }
  return webglAvailable;
}

class SurfaceBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ArtGallery({
  images,
  items,
  cellSize = defaultConfig.cellSize,
  zoomLevel = defaultConfig.zoomLevel,
  showHint = true,
  onSelect,
}: {
  images: string[];
  items: GalleryItem[];
  cellSize?: number;
  zoomLevel?: number;
  showHint?: boolean;
  onSelect?: (index: number) => void;
}) {
  const reducedMotion = useReducedMotion();
  const supported = useSyncExternalStore(() => () => {}, supportsWebGL, () => false);
  const captions = images.map((_, index) => items[index] ?? { title: `Print ${index + 1}`, year: "" });
  const fallback = <div className="art-gallery-fallback" role="img" aria-label="Print gallery" />;
  if (images.length === 0) return fallback;

  return (
    <div className="art-gallery">
      {fallback}
      {supported ? (
        <SurfaceBoundary fallback={fallback}>
          <ArtGalleryScene
            images={images}
            items={captions}
            cellSize={cellSize}
            zoomLevel={zoomLevel}
            showHint={showHint}
            reducedMotion={reducedMotion}
            onSelect={onSelect}
          />
        </SurfaceBoundary>
      ) : null}
    </div>
  );
}
