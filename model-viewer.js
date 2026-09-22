/ model-viewer.js
// Loads .3mf and .stl files into interactive, rotatable Three.js viewers.
// Requires the import map in projects.html's <head> (defines "three" and "three/addons/").

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

// ---------------------------------------------------------------------------
// CONFIG — one entry per <div class="model-canvas" id="..."> in the HTML.
// containerId must match the div's id exactly.
// modelPath is the path to the model file (same file the download link points to).
// format must be '3mf' or 'stl'.
// ---------------------------------------------------------------------------
const MODEL_CONFIGS = [
    { containerId: 'bunny-pencil-holder', modelPath: 'models/Bunny_Pencil_Holder_w_shelf.stl', format: 'stl' },
    { containerId: 'emergency-pendant', modelPath: 'models/Emergency_Pendant.3mf', format: '3mf' },
];

function initViewer({ containerId, modelPath, format }) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`model-viewer.js: no element found with id "${containerId}"`);
        return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    // --- Scene / camera / renderer -----------------------------------------
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 60, 160);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // --- Lights --------------------------------------------------------------
    // .3mf/.stl files carry geometry (and sometimes color, for .3mf), but no
    // lighting of their own, so the scene needs its own lights or the model
    // will render black.
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(1, 1, 1);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-1, -0.5, -1);
    scene.add(fill);

    // --- Controls: drag to orbit, scroll to zoom ------------------------------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 20;
    controls.maxDistance = 600;

    // --- Loading indicator -----------------------------------------------------
    const loadingEl = document.createElement('div');
    loadingEl.className = 'model-loading';
    loadingEl.textContent = 'Loading model...';
    container.appendChild(loadingEl);

    // --- Pick the right loader for this file's format ---------------------------
    const loader = format === 'stl' ? new STLLoader() : new ThreeMFLoader();

    loader.load(
        modelPath,
        (result) => {
            // STLLoader resolves with a BufferGeometry (just triangles, no
            // color), while ThreeMFLoader resolves with a full Object3D/Group.
            // Box3 and scene.add both need an Object3D, so wrap raw geometry
            // in a Mesh first.
            const object = result.isBufferGeometry
                ? new THREE.Mesh(result, new THREE.MeshStandardMaterial({ color: 0xd9c3f7 }))
                : result;

            // 3MF/STL files can be modeled at any scale/position, so normalize
            // the model to sit centered in view regardless of its original units.
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            object.position.sub(center);

            const maxDimension = Math.max(size.x, size.y, size.z) || 1;
            const targetSize = 100;
            object.scale.setScalar(targetSize / maxDimension);

            scene.add(object);
            loadingEl.remove();
        },
        (progressEvent) => {
            if (progressEvent.lengthComputable) {
                const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                loadingEl.textContent = `Loading model... ${percent}%`;
            }
        },
        (error) => {
            console.error(`model-viewer.js: failed to load ${modelPath}`, error);
            loadingEl.textContent = 'Could not load model.';
        }
    );

    // --- Resize handling ---------------------------------------------------------
    const resizeObserver = new ResizeObserver(() => {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        if (newWidth === 0 || newHeight === 0) return;

        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
    });
    resizeObserver.observe(container);

    // --- Render loop ----------------------------------------------------------
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MODEL_CONFIGS.forEach(initViewer));
} else {
    MODEL_CONFIGS.forEach(initViewer);
}
