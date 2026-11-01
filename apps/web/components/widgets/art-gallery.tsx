"use client";

import { Component, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { artGalleryIndex, GALLERY_IMAGE_SPAN, galleryCenter, galleryLayout } from "../../lib/art-gallery-hit";

/** ObsidianUI Art Gallery lens, on a finite print grid. Vertical swipes scroll the page. */

const defaultConfig = {
  cellSize: 0.75,
  zoomLevel: 1.25,
  lerpFactor: 0.075,
  borderColor: "rgba(255, 255, 255, 0.15)",
  backgroundColor: "rgba(0, 0, 0, 1)",
  textColor: "rgba(161, 161, 170, 1)",
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
  uniform float uGridCols;
  uniform float uGridRows;
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
    float col = cellId.x;
    float row = (uGridRows - 1.0) - cellId.y;
    float texIndex = col + row * uGridCols;
    bool hasPrint = col >= 0.0 && row >= 0.0 && col < uGridCols && row < uGridRows && texIndex < uTextureCount;
    float lineWidth = 0.005;
    float gridX = smoothstep(0.0, lineWidth, cellUV.x) * smoothstep(0.0, lineWidth, 1.0 - cellUV.x);
    float gridY = smoothstep(0.0, lineWidth, cellUV.y) * smoothstep(0.0, lineWidth, 1.0 - cellUV.y);
    float gridMask = hasPrint ? gridX * gridY : 1.0;
    float imageSize = ${GALLERY_IMAGE_SPAN.toFixed(1)};
    float imageBorder = (1.0 - imageSize) * 0.5;
    vec2 imageUV = (cellUV - imageBorder) / imageSize;
    float edgeSmooth = 0.01;
    vec2 imageMask = smoothstep(-edgeSmooth, edgeSmooth, imageUV) *
                    smoothstep(-edgeSmooth, edgeSmooth, 1.0 - imageUV);
    float imageAlpha = imageMask.x * imageMask.y;
    bool inImageArea = imageUV.x >= 0.0 && imageUV.x <= 1.0 && imageUV.y >= 0.0 && imageUV.y <= 1.0;
    float textHeight = 0.16;
    float textY = 0.82;
    bool inTextArea = cellUV.x >= 0.05 && cellUV.x <= 0.95 && cellUV.y >= textY && cellUV.y <= (textY + textHeight);
    vec3 color = backgroundColor;
    if (hasPrint && inImageArea && imageAlpha > 0.0) {
      float atlasSize = ceil(sqrt(uTextureCount));
      vec2 atlasPos = vec2(mod(texIndex, atlasSize), floor(texIndex / atlasSize));
      vec2 atlasUV = vec2(atlasPos.x + imageUV.x, atlasPos.y + (1.0 - imageUV.y)) / atlasSize;
      vec3 imageColor = texture2D(uImageAtlas, atlasUV).rgb;
      color = mix(color, imageColor, imageAlpha);
    }
    if (hasPrint && inTextArea) {
      vec2 textCoord = vec2((cellUV.x - 0.05) / 0.9, (cellUV.y - textY) / textHeight);
      float atlasSize = ceil(sqrt(uTextureCount));
      vec2 atlasPos = vec2(mod(texIndex, atlasSize), floor(texIndex / atlasSize));
      vec2 atlasUV = vec2(atlasPos.x + textCoord.x, atlasPos.y + (1.0 - textCoord.y)) / atlasSize;
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
type GalleryItem = { title: string; detail: string };

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

function fitLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) end -= 1;
  return `${text.slice(0, end).trimEnd()}…`;
}

function createTextTexture(THREE: ThreeNS, title: string, detail: string, textColor: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 2048, 256);
    ctx.fillStyle = textColor;
    ctx.textBaseline = "middle";
    ctx.imageSmoothingEnabled = true;
    const font = "150px \"IBM Plex Mono\", ui-monospace, monospace";
    ctx.font = font;
    const pad = 36;
    const gap = 48;
    const label = detail.trim();
    const labelWidth = label ? ctx.measureText(label).width : 0;
    const nameWidth = 2048 - pad * 2 - (label ? labelWidth + gap : 0);
    ctx.textAlign = "left";
    ctx.fillText(fitLine(ctx, title, nameWidth), pad, 128);
    if (label) {
      ctx.textAlign = "right";
      ctx.fillText(label, 2048 - pad, 128);
    }
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

function sourceSize(src: CanvasImageSource): { width: number; height: number } | null {
  if (src instanceof HTMLImageElement) {
    return src.naturalWidth > 0 ? { width: src.naturalWidth, height: src.naturalHeight } : null;
  }
  if (src instanceof HTMLCanvasElement || (typeof HTMLVideoElement !== "undefined" && src instanceof HTMLVideoElement)) {
    const width = src instanceof HTMLVideoElement ? src.videoWidth : src.width;
    const height = src instanceof HTMLVideoElement ? src.videoHeight : src.height;
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (typeof ImageBitmap !== "undefined" && src instanceof ImageBitmap) {
    return src.width > 0 && src.height > 0 ? { width: src.width, height: src.height } : null;
  }
  return null;
}

function paintTile(ctx: CanvasRenderingContext2D, src: CanvasImageSource, x: number, y: number, size: number, cover: boolean) {
  const measured = cover ? sourceSize(src) : null;
  if (!measured) {
    ctx.drawImage(src, x, y, size, size);
    return;
  }
  const scale = Math.max(size / measured.width, size / measured.height);
  const dw = measured.width * scale;
  const dh = measured.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.drawImage(src, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
  ctx.restore();
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
        paintTile(ctx, src, x, y, textureSize, !isText);
      } catch {
        if (fallbackSource) paintTile(ctx, fallbackSource, x, y, textureSize, !isText);
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
  const [canPan, setCanPan] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const imagesRef = useRef(images);
  const itemsRef = useRef(items);
  imagesRef.current = images;
  itemsRef.current = items;
  const signature = images.map((src, index) => `${src}\n${items[index]?.title ?? ""}\n${items[index]?.detail ?? ""}`).join("\n");

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
      uGridCols: { value: number };
      uGridRows: { value: number };
      uImageAtlas: { value: InstanceType<ThreeNS["Texture"]> };
      uTextAtlas: { value: InstanceType<ThreeNS["Texture"]> };
    } | null = null;

    const grid = galleryLayout(imagesNow.length);
    const fitted = galleryCenter(grid, cellSize);
    const stageWidth = container.clientWidth || 1;
    const stageHeight = container.clientHeight || 1;
    const restHalfX = stageWidth / stageHeight;
    const gridWidth = grid.cols * cellSize;
    const origin = {
      x: gridWidth <= restHalfX * 2 + 0.01 ? fitted.x : restHalfX,
      y: fitted.y,
    };
    const state = {
      isDragging: false,
      previousPointer: { x: 0, y: 0 },
      offset: { x: origin.x, y: origin.y },
      targetOffset: { x: origin.x, y: origin.y },
      mousePosition: { x: -1, y: -1 },
      zoom: 1,
      targetZoom: 1,
      cols: grid.cols,
      rows: grid.rows,
    };
    let downX = 0;
    let downY = 0;
    let gesture: "idle" | "pending" | "pan" | "scroll" = "idle";

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
      container.appendChild(renderer.domElement);

      const lerpFactor = reducedMotion ? 1 : defaultConfig.lerpFactor;
      const dragZoom = reducedMotion ? 1 : zoomLevel;
      const tapSlop = 8;

      const viewHalfX = (zoom: number) => {
        const width = container.clientWidth || 1;
        const height = container.clientHeight || 1;
        return (width / height) * zoom;
      };
      const gridOverflows = () => state.cols * cellSize > viewHalfX(1) * 2 + 0.01;
      const clampTarget = () => {
        const halfX = viewHalfX(state.targetZoom);
        const gridW = state.cols * cellSize;
        state.targetOffset.y = (state.rows * cellSize) / 2;
        if (gridW <= halfX * 2) state.targetOffset.x = gridW / 2;
        else state.targetOffset.x = Math.min(Math.max(state.targetOffset.x, halfX), gridW - halfX);
      };
      const syncPan = () => {
        const can = gridOverflows();
        container.classList.toggle("can-pan", can);
        if (!cancelled) setCanPan(can);
      };

      const animate = () => {
        animFrameId = requestAnimationFrame(animate);
        clampTarget();
        state.offset.x += (state.targetOffset.x - state.offset.x) * lerpFactor;
        state.offset.y += (state.targetOffset.y - state.offset.y) * lerpFactor;
        state.zoom += (state.targetZoom - state.zoom) * lerpFactor;
        if (uniforms) {
          uniforms.uOffset.value.set(state.offset.x, state.offset.y);
          uniforms.uZoom.value = state.zoom;
        }
        renderer?.render(scene, camera);
      };

      const surfacePoint = (event: PointerEvent) => {
        const rect = container.getBoundingClientRect();
        const width = container.clientWidth;
        const height = container.clientHeight;
        return {
          x: rect.width ? ((event.clientX - rect.left) / rect.width) * width : 0,
          y: rect.height ? ((event.clientY - rect.top) / rect.height) * height : 0,
          width,
          height,
        };
      };

      const updateMousePosition = (event: PointerEvent) => {
        const point = surfacePoint(event);
        state.mousePosition.x = point.x;
        state.mousePosition.y = point.y;
        uniforms?.uMousePos.value.set(point.x, point.y);
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
        if (Math.abs(deltaX) > 2 && state.targetZoom === 1 && gridOverflows()) state.targetZoom = dragZoom;
        state.targetOffset.x -= deltaX * 0.003;
        state.previousPointer.x = x;
        state.previousPointer.y = y;
      };

      const endDrag = () => {
        state.isDragging = false;
        state.targetZoom = 1;
        container.classList.remove("is-dragging");
      };

      const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        downX = event.clientX;
        downY = event.clientY;
        gesture = "pending";
      };
      const onPointerMove = (event: PointerEvent) => {
        updateMousePosition(event);
        if (gesture === "idle" || gesture === "scroll") return;
        const deltaX = event.clientX - downX;
        const deltaY = event.clientY - downY;
        if (gesture === "pending") {
          if (Math.hypot(deltaX, deltaY) < tapSlop) return;
          if (Math.abs(deltaY) > Math.abs(deltaX) || !gridOverflows()) {
            gesture = "scroll";
            return;
          }
          gesture = "pan";
          try {
            container.setPointerCapture?.(event.pointerId);
          } catch {
            // The browser may already own this pointer for a scroll.
          }
          startDrag(downX, downY);
        }
        if (gesture === "pan") handleMove(event.clientX, event.clientY);
      };
      const finishPointer = (event: PointerEvent, click: boolean) => {
        if (container.hasPointerCapture?.(event.pointerId)) container.releasePointerCapture(event.pointerId);
        const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
        const panned = gesture === "pan";
        gesture = "idle";
        if (panned) endDrag();
        if (!click || moved > tapSlop) return;
        const point = surfacePoint(event);
        const index = artGalleryIndex(
          point,
          { width: point.width, height: point.height },
          state.offset,
          state.zoom,
          cellSize,
          imagesNow.length,
          { cols: state.cols, rows: state.rows },
        );
        if (index !== null) onSelectRef.current?.(index);
      };
      const onPointerUp = (event: PointerEvent) => finishPointer(event, true);
      const onPointerCancel = (event: PointerEvent) => finishPointer(event, false);
      const onPointerLeave = () => {
        state.mousePosition.x = -1;
        state.mousePosition.y = -1;
        uniforms?.uMousePos.value.set(-1, -1);
        if (gesture !== "pan") gesture = "idle";
      };
      const onResize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (!width || !height || !renderer) return;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        uniforms?.uResolution.value.set(width, height);
        syncPan();
      };

      const loadedImages = await Promise.all(imagesNow.map((src) => loadImageTexture(THREE, src)));
      if (cancelled) {
        loadedImages.forEach((texture) => texture?.dispose());
        return;
      }
      const replacement = loadedImages.find((texture) => texture) ?? blankTexture(THREE);
      const imageTiles = loadedImages.map((texture) => texture ?? replacement);
      loadedTextures.push(...new Set(imageTiles));
      const textTextures = itemsNow.map((item) => createTextTexture(THREE, item.title, item.detail, defaultConfig.textColor));
      loadedTextures.push(...textTextures);
      imageAtlas = createTextureAtlas(THREE, imageTiles, false);
      textAtlas = createTextureAtlas(THREE, textTextures, true);
      if (cancelled) return;

      const border = rgbaToArray(defaultConfig.borderColor);
      const hover = rgbaToArray(defaultConfig.hoverColor);
      const background = rgbaToArray(defaultConfig.backgroundColor);
      uniforms = {
        uOffset: { value: new THREE.Vector2(origin.x, origin.y) },
        uResolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
        uBorderColor: { value: new THREE.Vector4(border[0], border[1], border[2], border[3]) },
        uHoverColor: { value: new THREE.Vector4(hover[0], hover[1], hover[2], hover[3]) },
        uBackgroundColor: { value: new THREE.Vector4(background[0], background[1], background[2], background[3]) },
        uMousePos: { value: new THREE.Vector2(-1, -1) },
        uZoom: { value: 1 },
        uCellSize: { value: cellSize },
        uTextureCount: { value: imagesNow.length },
        uGridCols: { value: grid.cols },
        uGridRows: { value: grid.rows },
        uImageAtlas: { value: imageAtlas },
        uTextAtlas: { value: textAtlas },
      };
      syncPan();
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
      container.classList.remove("is-dragging", "can-pan");
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
      {ready && showHint && canPan ? <div className="art-gallery-hint">drag to explore</div> : null}
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
  const captions = images.map((_, index) => items[index] ?? { title: `Print ${index + 1}`, detail: "" });
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
