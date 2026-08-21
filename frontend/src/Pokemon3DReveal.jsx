import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function Pokemon3DReveal({ onComplete }) {
  const mountRef = useRef(null);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);
    scene.fog = new THREE.FogExp2(0x050508, 0.04);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 4, 12);
    camera.lookAt(0, 1, 0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const cyanPoint = new THREE.PointLight(0x00ffff, 2, 10);
    cyanPoint.position.set(0, 2, 0);
    scene.add(cyanPoint);

    // 4. Ground / Island
    const islandGeo = new THREE.CylinderGeometry(8, 9, 1, 32);
    const islandMat = new THREE.MeshStandardMaterial({ color: 0x1a2e1a, roughness: 0.8 });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = -0.5;
    island.receiveShadow = true;
    scene.add(island);

    // Cobblestone Path
    const pathGeo = new THREE.PlaneGeometry(2.5, 12);
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x3a3a4a, roughness: 0.9 });
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.01, 2);
    path.receiveShadow = true;
    scene.add(path);

    // 5. 3D Trees
    function createTree(x, z) {
      const treeGroup = new THREE.Group();
      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 1.2, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.6;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Leaves (Low poly cones)
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.6 });
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1 - i * 0.2, 1.2, 7), leafMat);
        cone.position.y = 1.2 + i * 0.7;
        cone.castShadow = true;
        treeGroup.add(cone);
      }

      treeGroup.position.set(x, 0, z);
      return treeGroup;
    }

    const treePositions = [
      [-5, -2], [-6, 1], [-4, 4], [-5, -5],
      [5, -2], [6, 1], [4, 4], [5, -5],
      [-3, -6], [3, -6], [-6, -4], [6, -4]
    ];
    treePositions.forEach(([x, z]) => scene.add(createTree(x, z)));

    // 6. Procedural 3D Pokéball
    const pokeballGroup = new THREE.Group();
    pokeballGroup.position.set(0, 1.5, 0);
    scene.add(pokeballGroup);

    const radius = 1.2;

    // Top Shell (Red)
    const topGeo = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const topMat = new THREE.MeshStandardMaterial({ color: 0xff1133, roughness: 0.2, metalness: 0.2 });
    const topShell = new THREE.Mesh(topGeo, topMat);
    topShell.castShadow = true;

    // Bottom Shell (White)
    const bottomGeo = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const bottomMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.2, metalness: 0.1 });
    const bottomShell = new THREE.Mesh(bottomGeo, bottomMat);
    bottomShell.castShadow = true;

    // Center Band (Black)
    const bandGeo = new THREE.CylinderGeometry(radius + 0.01, radius + 0.01, 0.15, 32);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
    const band = new THREE.Mesh(bandGeo, bandMat);

    // Button Outer Ring (Black)
    const buttonRingGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 32);
    const buttonRing = new THREE.Mesh(buttonRingGeo, bandMat);
    buttonRing.rotation.x = Math.PI / 2;
    buttonRing.position.z = radius + 0.02;

    // Button Inner Core (Glowing Cyan/White)
    const buttonCoreGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 32);
    const buttonCoreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x00ffff, emissiveIntensity: 0.8 });
    const buttonCore = new THREE.Mesh(buttonCoreGeo, buttonCoreMat);
    buttonCore.rotation.x = Math.PI / 2;
    buttonCore.position.z = radius + 0.03;

    // Assemble Pokéball
    const topGroup = new THREE.Group();
    topGroup.add(topShell);
    pokeballGroup.add(topGroup);
    pokeballGroup.add(bottomShell);
    pokeballGroup.add(band);
    pokeballGroup.add(buttonRing);
    pokeballGroup.add(buttonCore);

    // 7. Light Beam Effect (Hidden initially)
    const beamGeo = new THREE.CylinderGeometry(0.1, 3, 20, 32, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(0, 10, 0);
    scene.add(beam);

    // 8. Particle System
    const particleCount = 250;
    const particleGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      posArray[i] = (Math.random() - 0.5) * 12;
      posArray[i + 1] = Math.random() * 8;
      posArray[i + 2] = (Math.random() - 0.5) * 12;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.08,
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 9. Animation State Loop
    let startTime = Date.now();
    let animId;
    let completed = false;

    function animate() {
      animId = requestAnimationFrame(animate);

      const elapsed = (Date.now() - startTime) / 1000;

      // Float & Spin
      if (elapsed < 3.0) {
        pokeballGroup.position.y = 1.5 + Math.sin(elapsed * 3) * 0.15;
        pokeballGroup.rotation.y = elapsed * 1.2;
        camera.position.x = Math.sin(elapsed * 0.5) * 3;
      } else if (elapsed < 4.0) {
        // Charge / Pulse Button
        const p = (elapsed - 3.0);
        buttonCoreMat.emissiveIntensity = 1.0 + Math.sin(p * 20) * 2.0;
        cyanPoint.intensity = 2 + p * 5;
        topGroup.rotation.x = -p * 0.8; // Open Pokéball top shell
      } else if (elapsed < 5.2) {
        // Energy Beam & Zoom
        const p = (elapsed - 4.0) / 1.2;
        beamMat.opacity = Math.min(1.0, p * 2.0);
        beam.scale.set(1 + p * 3, 1, 1 + p * 3);
        camera.position.z = 12 - p * 11;
        camera.position.y = 4 - p * 3;
        buttonCoreMat.emissiveIntensity = 10;
        
        if (p > 0.7 && !fading) {
          setFading(true);
        }
      } else if (!completed) {
        completed = true;
        if (onComplete) onComplete();
      }

      // Rotate Particles
      particles.rotation.y = elapsed * 0.1;

      renderer.render(scene, camera);
    }

    animate();

    // 10. Resize Handler
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
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [onComplete]);

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        zIndex: 3000, 
        background: '#050508', 
        opacity: fading ? 0 : 1, 
        transition: 'opacity 0.8s ease-out' 
      }}
    >
      <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />

      {/* Title Overlay */}
      <div style={{ position: 'absolute', top: '10%', width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
        <h2 style={{ fontFamily: 'var(--display-font)', fontSize: '2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.2em', textShadow: '0 0 20px rgba(0,255,255,0.8)' }}>
          POKÉMON ARENA 3D
        </h2>
        <p style={{ fontFamily: 'var(--body-font)', fontSize: '0.85rem', color: '#9ca3af', letterSpacing: '0.15em', marginTop: '8px' }}>
          INITIALIZING WEBGL EXPERIENCE...
        </p>
      </div>

      {/* Skip Button */}
      <button 
        onClick={() => { setFading(true); setTimeout(onComplete, 500); }}
        style={{
          position: 'absolute',
          bottom: '30px',
          right: '30px',
          padding: '12px 24px',
          borderRadius: '9999px',
          border: '1px solid rgba(255,255,255,0.3)',
          background: 'rgba(255,255,255,0.05)',
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
