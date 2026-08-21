import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const PATH_3D = [
  { x: -3.5, z: 7.0 },  // Start on 3D Dock
  { x: -3.5, z: 2.0 },  // Walk up dock path
  { x: 0.0,  z: 2.0 },  // Turn right toward center
  { x: 0.0,  z: -4.5 }  // Walk up to 3D Gym Entrance
];

export default function Pokemon3DReveal({ onComplete }) {
  const containerRef = useRef(null);
  const [irisClose, setIrisClose] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c16);
    scene.fog = new THREE.FogExp2(0x0a0c16, 0.035);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 8, 14);
    camera.lookAt(0, 0, 0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(8, 16, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    scene.add(sun);

    // 4. Water & Dock
    const waterGeo = new THREE.PlaneGeometry(30, 8);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x0f3460, roughness: 0.1, metalness: 0.5 });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.1, 8.5);
    scene.add(water);

    // Wooden Dock
    const dockGeo = new THREE.BoxGeometry(2, 0.3, 4);
    const dockMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8 });
    const dock = new THREE.Mesh(dockGeo, dockMat);
    dock.position.set(-3.5, 0.1, 7.5);
    dock.castShadow = true;
    dock.receiveShadow = true;
    scene.add(dock);

    // 5. Grass Ground
    const groundGeo = new THREE.PlaneGeometry(30, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e3a1e, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -1.5);
    ground.receiveShadow = true;
    scene.add(ground);

    // 6. 3D Cobblestone Path
    function createPathSegment(x, z, w, h) {
      const geo = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.MeshStandardMaterial({ color: 0x3d3a4e, roughness: 0.8 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.01, z);
      mesh.receiveShadow = true;
      return mesh;
    }
    scene.add(createPathSegment(-3.5, 4.25, 1.8, 5.5)); // Vertical Segment 1
    scene.add(createPathSegment(-1.75, 2.0, 3.5, 1.8)); // Horizontal Segment 2
    scene.add(createPathSegment(0.0, -1.25, 1.8, 6.5)); // Vertical Segment 3

    // 7. 3D Low-Poly Pine Trees
    function createTree(x, z) {
      const treeGroup = new THREE.Group();
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2314 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 1.0, 8), trunkMat);
      trunk.position.y = 0.5;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      const leafMat = new THREE.MeshStandardMaterial({ color: 0x255c27, roughness: 0.7 });
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9 - i * 0.2, 1.1, 7), leafMat);
        cone.position.y = 1.0 + i * 0.6;
        cone.castShadow = true;
        treeGroup.add(cone);
      }

      treeGroup.position.set(x, 0, z);
      return treeGroup;
    }

    const trees = [
      [-6, 6], [-6, 3], [-6, 0], [-6, -3], [-6, -6],
      [6, 6], [6, 3], [6, 0], [6, -3], [6, -6],
      [-2, -5], [2, -5], [-2, 5], [2, 5],
      [-5, -1], [5, -1]
    ];
    trees.forEach(([x, z]) => scene.add(createTree(x, z)));

    // 8. 3D Arcade Gym Building Entrance
    const gymGroup = new THREE.Group();
    gymGroup.position.set(0, 0, -6.5);

    // Main Building
    const buildingGeo = new THREE.BoxGeometry(6, 4, 4);
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x161b2e, roughness: 0.5, metalness: 0.2 });
    const building = new THREE.Mesh(buildingGeo, buildingMat);
    building.position.y = 2;
    building.castShadow = true;
    building.receiveShadow = true;
    gymGroup.add(building);

    // Roof Accent
    const roofGeo = new THREE.ConeGeometry(4.5, 2, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xe94560, roughness: 0.3 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 5;
    roof.castShadow = true;
    gymGroup.add(roof);

    // Entrance Portal Archway (Glowing Cyan)
    const doorGeo = new THREE.BoxGeometry(2, 2.5, 0.2);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x00ffff, emissiveIntensity: 0.6 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, 1.25, 2.01);
    gymGroup.add(door);

    const doorLight = new THREE.PointLight(0x00ffff, 3, 8);
    doorLight.position.set(0, 2, 2.5);
    gymGroup.add(doorLight);

    scene.add(gymGroup);

    // 9. 3D Trainer Character (Sprite Billboard / Animated Texture)
    const textureLoader = new THREE.TextureLoader();
    const trainerTexture = textureLoader.load('/pokemon-trainer.png');
    trainerTexture.magFilter = THREE.NearestFilter;
    trainerTexture.minFilter = THREE.NearestFilter;

    // Sprite Sheet setup: 4 columns x 4 rows
    trainerTexture.repeat.set(1 / 4, 1 / 4);

    const spriteMat = new THREE.SpriteMaterial({ map: trainerTexture, transparent: true });
    const trainerSprite = new THREE.Sprite(spriteMat);
    trainerSprite.scale.set(1.6, 1.6, 1);
    trainerSprite.position.set(PATH_3D[0].x, 0.8, PATH_3D[0].z);
    scene.add(trainerSprite);

    // 3D Pixel Shadow beneath Trainer
    const shadowGeo = new THREE.PlaneGeometry(1.0, 0.5);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
    const trainerShadow = new THREE.Mesh(shadowGeo, shadowMat);
    trainerShadow.rotation.x = -Math.PI / 2;
    trainerShadow.position.set(PATH_3D[0].x, 0.02, PATH_3D[0].z);
    scene.add(trainerShadow);

    // 10. Trainer Movement & Animation Loop
    let currentWaypoint = 0;
    let trainerPos = { x: PATH_3D[0].x, z: PATH_3D[0].z };
    let moveSpeed = 0.045;
    let animFrame = 0;
    let dirRow = 3; // Up = 3, Right = 1, Down = 0, Left = 2
    let isMoving = true;
    let triggerIris = false;

    // Leg anim interval
    const animInterval = setInterval(() => {
      if (isMoving) {
        animFrame = (animFrame + 1) % 4;
      } else {
        animFrame = 0;
      }
      trainerTexture.offset.x = animFrame / 4;
      trainerTexture.offset.y = (3 - dirRow) / 4;
    }, 120);

    let animId;
    function renderLoop() {
      animId = requestAnimationFrame(renderLoop);

      if (isMoving && currentWaypoint < PATH_3D.length - 1) {
        const target = PATH_3D[currentWaypoint + 1];
        const dx = target.x - trainerPos.x;
        const dz = target.z - trainerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Update direction row
        if (Math.abs(dz) > Math.abs(dx)) {
          dirRow = dz < 0 ? 3 : 0; // 3 = Up, 0 = Down
        } else {
          dirRow = dx > 0 ? 1 : 2; // 1 = Right, 2 = Left
        }

        if (dist < moveSpeed) {
          trainerPos.x = target.x;
          trainerPos.z = target.z;
          currentWaypoint++;

          if (currentWaypoint >= PATH_3D.length - 1) {
            isMoving = false;
            // Trigger Iris Close when reaching Gym Door
            if (!triggerIris) {
              triggerIris = true;
              setIrisClose(true);
              setTimeout(() => {
                if (onComplete) onComplete();
              }, 2000);
            }
          }
        } else {
          trainerPos.x += (dx / dist) * moveSpeed;
          trainerPos.z += (dz / dist) * moveSpeed;
        }

        // Update Trainer & Shadow
        trainerSprite.position.x = trainerPos.x;
        trainerSprite.position.z = trainerPos.z;
        trainerShadow.position.x = trainerPos.x;
        trainerShadow.position.z = trainerPos.z;

        // Smooth Camera Follow
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, trainerPos.x * 0.4, 0.05);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, trainerPos.z + 7.5, 0.05);
        camera.lookAt(trainerPos.x * 0.4, 1.2, trainerPos.z - 2.0);
      }

      renderer.render(scene, camera);
    }

    renderLoop();

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(animInterval);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [onComplete]);

  return (
    <div 
      className={`pokemon-game-container ${irisClose ? 'iris-close' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: '#0a0c16',
        overflow: 'hidden'
      }}
    >
      <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />

      {/* Skip Button */}
      <button 
        onClick={() => { setIrisClose(true); setTimeout(onComplete, 1000); }}
        style={{
          position: 'absolute',
          bottom: '30px',
          right: '30px',
          padding: '12px 24px',
          borderRadius: '9999px',
          border: '1px solid rgba(255,255,255,0.3)',
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(10px)',
          color: '#ffffff',
          fontFamily: 'var(--body-font)',
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.15em',
          cursor: 'pointer',
          zIndex: 3001
        }}
      >
        SKIP INTRO ➔
      </button>
    </div>
  );
}
