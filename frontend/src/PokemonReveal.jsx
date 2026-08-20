import React, { useEffect, useRef } from 'react';

const BASE_FRAME_WIDTH = 96;
const BASE_FRAME_HEIGHT = 96;
const BASE_TREE_WIDTH = 120;
const BASE_TREE_HEIGHT = 200;

const FRAME_SEQUENCE = [0, 1, 2, 3];
const DIRECTIONS = { down: 0, right: 1, left: 2, up: 3 };

const PATH_PERCENT = [
  { x: 24.5, y: 82 },
  { x: 24.5, y: 75 },
  { x: 24.5, y: 65 },
  { x: 24.5, y: 55 },
  { x: 24.5, y: 47 },
  { x: 35, y: 47 },
  { x: 50, y: 47 },
  { x: 50, y: 35 },
  { x: 50, y: 22 }, // Trigger Fade
  { x: 50, y: 15 },
];

const BORDER_TREES = [
  { x: -15, y: -30 }, { x: -8, y: -28 }, { x: -1, y: -30 },
  { x: 6, y: -28 }, { x: 13, y: -30 }, { x: 20, y: -28 },
  { x: -12, y: -20 }, { x: -5, y: -18 }, { x: 2, y: -20 },
  { x: 9, y: -18 }, { x: 16, y: -20 },
  { x: 68, y: -30 }, { x: 75, y: -28 }, { x: 82, y: -30 },
  { x: 89, y: -28 }, { x: 96, y: -30 }, { x: 103, y: -28 },
  { x: 71, y: -20 }, { x: 78, y: -18 }, { x: 85, y: -20 },
  { x: 92, y: -18 }, { x: 99, y: -20 },
  { x: -20, y: -25 }, { x: -20, y: -15 }, { x: -20, y: -5 },
  { x: -20, y: 5 }, { x: -20, y: 15 }, { x: -20, y: 25 },
  { x: 96, y: -25 }, { x: 96, y: -15 }, { x: 96, y: -5 },
  { x: 96, y: 5 }, { x: 96, y: 15 }, { x: 96, y: 25 }
];

const PROMINENT_TREES = [
  { x: 35, y: 34 }, { x: 43, y: 32 }, { x: 51, y: 34 },
  { x: 59, y: 32 }, { x: 67, y: 34 }, { x: 75, y: 32 },
  { x: -2, y: 5 }, { x: 97, y: 5 }, { x: 95, y: 18 }, { x: 5, y: 25 }
];

const SHADOW_PATTERN = [
  [0, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 0],
];

export default function PokemonReveal({ onComplete }) {
  const containerRef = useRef(null);
  const trainerRef = useRef(null);
  const shadowRef = useRef(null);

  useEffect(() => {
    const gameContainer = containerRef.current;
    const trainer = trainerRef.current;
    const shadow = shadowRef.current;
    if (!gameContainer || !trainer || !shadow) return;

    const initialWidth = window.innerWidth;
    const initialHeight = window.innerHeight;
    const initialScale = Math.min(initialWidth / 800, initialHeight / 533);

    let scale = 1;
    let containerWidth = initialWidth;
    let containerHeight = initialHeight;

    function calculateDimensions() {
      containerWidth = window.innerWidth;
      containerHeight = window.innerHeight;
      scale = Math.min(containerWidth / 800, containerHeight / 533);
    }

    function percentToPixel(xPercent, yPercent) {
      return {
        x: (xPercent / 100) * containerWidth,
        y: (yPercent / 100) * containerHeight
      };
    }

    function getScaledTreeDimensions() {
      const width = BASE_TREE_WIDTH * initialScale * (containerWidth / initialWidth);
      const height = BASE_TREE_HEIGHT * initialScale * (containerHeight / initialHeight);
      return { width, height };
    }

    function getScaledSpriteDimensions() {
      return {
        width: BASE_FRAME_WIDTH * scale,
        height: BASE_FRAME_HEIGHT * scale
      };
    }

    // Shadow
    shadow.innerHTML = '';
    SHADOW_PATTERN.forEach(row => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'pokemon-shadow-row';
      row.forEach(pixel => {
        const pixelDiv = document.createElement('div');
        pixelDiv.className = 'pokemon-shadow-pixel' + (pixel ? ' filled' : '');
        rowDiv.appendChild(pixelDiv);
      });
      shadow.appendChild(rowDiv);
    });

    // Trees
    const treeElements = [];
    [...BORDER_TREES, ...PROMINENT_TREES].forEach((pos, idx) => {
      const tree = document.createElement('div');
      tree.className = 'pokemon-tree';
      tree.dataset.x = pos.x;
      tree.dataset.y = pos.y;
      tree.dataset.anim = idx >= BORDER_TREES.length ? 'true' : 'false';
      tree.dataset.frame = Math.floor(Math.random() * 4);
      gameContainer.appendChild(tree);
      treeElements.push(tree);
    });

    function updateTreePositions() {
      const treeDims = getScaledTreeDimensions();
      treeElements.forEach(tree => {
        const pos = percentToPixel(parseFloat(tree.dataset.x), parseFloat(tree.dataset.y));
        tree.style.width = treeDims.width + 'px';
        tree.style.height = treeDims.height + 'px';
        tree.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        tree.style.backgroundSize = `${treeDims.width * 4}px ${treeDims.height}px`;
      });
    }

    // Motion State
    let pathIndex = 1;
    let currentX = PATH_PERCENT[0].x;
    let currentY = PATH_PERCENT[0].y;
    let direction = 'down';
    let isMoving = false;
    let startDelay = 40;
    let fadeTriggered = false;

    function updateTrainerVisuals() {
      const pixelPos = percentToPixel(currentX, currentY);
      const dims = getScaledSpriteDimensions();

      trainer.style.width = dims.width + 'px';
      trainer.style.height = dims.height + 'px';
      trainer.style.backgroundSize = `${dims.width * 4}px ${dims.height * 4}px`;
      trainer.style.transform = `translate(${pixelPos.x - dims.width / 2}px, ${pixelPos.y - dims.height}px)`;

      const walkCol = isMoving ? FRAME_SEQUENCE[Math.floor(Date.now() / 100) % 4] : 0;
      const dirRow = DIRECTIONS[direction];
      trainer.style.backgroundPosition = `-${walkCol * dims.width}px -${dirRow * dims.height}px`;

      const pixelSize = Math.max(2, Math.floor(dims.width / 16));
      const shadowWidth = pixelSize * 8;
      const shadowHeight = pixelSize * 3;
      shadow.style.transform = `translate(${pixelPos.x - shadowWidth / 2}px, ${pixelPos.y - shadowHeight / 2}px)`;

      shadow.querySelectorAll('.pokemon-shadow-pixel').forEach(p => {
        p.style.width = pixelSize + 'px';
        p.style.height = pixelSize + 'px';
      });
    }

    function triggerGymEntrance() {
      fadeTriggered = true;
      trainer.classList.add('fade-out');
      shadow.classList.add('fade-out');
      treeElements.forEach(t => t.classList.add('fade-out'));

      setTimeout(() => {
        gameContainer.classList.add('iris-close');
      }, 400);

      setTimeout(() => {
        if (onComplete) onComplete();
      }, 2400);
    }

    function move() {
      if (startDelay > 0) {
        startDelay--;
        if (startDelay === 0) isMoving = true;
        return;
      }

      if (pathIndex >= PATH_PERCENT.length) {
        isMoving = false;
        updateTrainerVisuals();
        return;
      }

      if (pathIndex === 8 && !fadeTriggered) {
        triggerGymEntrance();
      }

      const target = PATH_PERCENT[pathIndex];
      const dx = target.x - currentX;
      const dy = target.y - currentY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const speed = 0.25;

      if (dist < speed) {
        currentX = target.x;
        currentY = target.y;
        pathIndex++;
        if (pathIndex < PATH_PERCENT.length) {
          const next = PATH_PERCENT[pathIndex];
          const adx = Math.abs(next.x - currentX);
          const ady = Math.abs(next.y - currentY);
          if (ady > adx) direction = next.y > currentY ? 'down' : 'up';
          else direction = next.x > currentX ? 'right' : 'left';
        }
      } else {
        currentX += (dx / dist) * speed;
        currentY += (dy / dist) * speed;
        if (Math.abs(dy) > Math.abs(dx)) direction = dy > 0 ? 'down' : 'up';
        else direction = dx > 0 ? 'right' : 'left';
      }

      updateTrainerVisuals();
    }

    calculateDimensions();
    updateTreePositions();
    updateTrainerVisuals();

    const moveInterval = setInterval(move, 16);
    const treeAnimInterval = setInterval(() => {
      const treeDims = getScaledTreeDimensions();
      const globalFrame = Math.floor(Date.now() / 350) % 4;
      treeElements.forEach(tree => {
        const f = tree.dataset.anim === 'true' ? globalFrame : parseInt(tree.dataset.frame);
        tree.style.backgroundPosition = `-${f * treeDims.width}px 0`;
      });
    }, 16);

    const handleResize = () => {
      calculateDimensions();
      updateTreePositions();
      updateTrainerVisuals();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearInterval(moveInterval);
      clearInterval(treeAnimInterval);
      window.removeEventListener('resize', handleResize);
      treeElements.forEach(t => t.remove());
    };
  }, [onComplete]);

  return (
    <div className="pokemon-game-container" ref={containerRef}>
      <img src="/pokemon-bg.png" className="pokemon-bg" alt="Pokemon Town Background" />
      <div className="pokemon-shadow" ref={shadowRef} />
      <div className="pokemon-sprite" ref={trainerRef} />
    </div>
  );
}
