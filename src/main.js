

import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// import { createClient } from "@supabase/supabase-js";

// const SUPABASE_URL = "https://zxietxwfjlcfhtiygxhe.supabase.co";
// const SUPABASE_KEY =
//   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4aWV0eHdmamxjZmh0aXlneGhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE3NTUzMzUsImV4cCI6MjA0NzMzMTMzNX0.XTeIR13UCRlT4elaeiKiDll1XRD1WoVnLsPd3QVVGDU";
// export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let container, camera, scene, renderer, reticle, controller;
let currentObject = null;
let currentModelData = null;
let placedObject = null;
let hitTestSource = null;
let hitTestSourceRequested = false;
let touchDown, touchX, touchY, deltaX, deltaY;
let isInfoPanelFullView = false;
let selectedObject = null;
let bounceInterval = null;
let initialPinchDistance = null;
let pinchScaling = false;
let isRotating = false;
let lastTouchX = null;

const placeButton = document.getElementById("place-button");
const infoPanel = document.getElementById("infoPanel");

const modelId = document.body.dataset.modelId;
const relatedModelsContainer = document.getElementById("relatedModels");



const fetchModelData = async (modelId) => {
  try {
    const response = await fetch(`/api/models/${modelId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch model with ID ${modelId}`);
    }

    const data = await response.json();
    currentModelData = data;
    console.log("Fetched model data:", currentModelData);
    await loadModel(currentModelData.glb_url);
  } catch (error) {
    console.error("Error fetching model data:", error);
  }
};

const fetchRelatedModels = async () => {
  try {
    const response = await fetch(`/api/models/related/${modelId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch related model for ID ${modelId}`);
    }

    const data = await response.json();

    const relatedPage = modelId === "2" ? "/dome.html" : "/marius.html";

    relatedModelsContainer.innerHTML = `
      <div class="related-model-card" onclick="window.location='${relatedPage}'">
        <img src="${data.model_image}" alt="${data.name}">
        <h4>${data.name}</h4>
        <p>${data.material}</p>
      </div>`;
  } catch (error) {
    console.error("Error fetching related model:", error);
    relatedModelsContainer.innerHTML = "<p>Error loading related model.</p>";
  }
};

const populateModelDetails = (data) => {
  document.getElementById("modelTitle").textContent = data.name || "N/A";
  document.getElementById(
    "modelCompany"
  ).innerHTML = `<strong>Company:</strong> ${data.company || "N/A"}`;
  document.getElementById(
    "modelCategory"
  ).innerHTML = `<strong>Category:</strong> ${data.category || "N/A"}`;
  document.getElementById(
    "modelMaterial"
  ).innerHTML = `<strong>Material:</strong> ${data.material || "N/A"}`;
};

const showHelperBlock = () => {
  const helperBlock = document.getElementById("helper-block");
  helperBlock.classList.remove("hidden");
};

const hideHelperBlock = () => {
  const helperBlock = document.getElementById("helper-block");
  helperBlock.classList.add("hidden");
};

const loadModel = async (modelUrl) => {
  const loader = new GLTFLoader();
  loader.load(
    modelUrl,
    (gltf) => {
      currentObject = gltf.scene;
      currentObject.visible = false;
      const areaLightIntensity = 2;
      const areaLight = new THREE.RectAreaLight(
        0xffffff,
        areaLightIntensity,
        10,
        10
      );
      areaLight.position.set(0, 5, 0);
      areaLight.lookAt(0, 0, 0);
      currentObject.add(areaLight);

      scene.add(currentObject);
      console.log("Model loaded:", modelUrl);
    },
    undefined,
    (error) => console.error("Error loading model:", error)
  );
};

const onSelect = () => {
  if (reticle.visible && !placedObject && currentObject) {
    placeModel();
  }
}

const placeModel = () => {
  if (reticle.visible && !placedObject && currentObject) {
    placedObject = currentObject.clone();
    placedObject.position.setFromMatrixPosition(reticle.matrix);
    placedObject.rotation.setFromRotationMatrix(reticle.matrix);
    placedObject.visible = true;
    scene.add(placedObject);

    console.log("Placed object:", placedObject);
    hideHelperBlock();
    showInfoPanel(currentModelData);
  }
}

const showInfoPanel = (data) => {
  const panel = document.getElementById("infoPanel");

  document.getElementById("modelTitle").textContent = data.name || "N/A";
  document.getElementById(
    "modelCompany"
  ).innerHTML = `<strong>Company:</strong> ${data.company || "N/A"}`;
  document.getElementById(
    "modelCategory"
  ).innerHTML = `<strong>Material:</strong> ${data.material || "N/A"}`;
  document.getElementById(
    "modelMaterial"
  ).innerHTML = `<strong>Produced in:</strong> ${data.company_location || "N/A"}`;

  document.getElementById("fullModelTitle").textContent = data.name || "N/A";
  document.getElementById("fullModelCompany").textContent =
    data.company || "N/A";
  document.getElementById("fullModelCategory").textContent =
    data.category || "N/A";
  document.getElementById("fullModelMaterial").textContent =
    data.material || "N/A";
  document.getElementById("fullModelCountry").textContent =
    data.company_location || "N/A";

  document.getElementById("fullModelDescription").textContent =
    data.description || "Description not available.";
  document.getElementById("fullModelSustainability").textContent =
    data.sustainability_info || "Sustainability information not available.";
  document.getElementById("fullModelImage").src = data.model_image || "";

  panel.classList.remove("full-view");
  panel.style.bottom = "0";
  panel.style.height = "41vh";
  isInfoPanelFullView = false;
  panel.style.display = "block";
  panel.style.marginBottom = "-2rem";

  panel.addEventListener("click", toggleInfoPanelFullView);

  startBounceAnimation(panel);
};

const toggleInfoPanelFullView = (event) => {
  event.stopPropagation();

  const panel = document.getElementById("infoPanel");
  const fullView = document.getElementById("fullView");
  const smallView = document.getElementById("smallView");

  if (isInfoPanelFullView) {

    panel.classList.remove("full-view");
    fullView.style.display = "none";
    smallView.style.display = "block";
    panel.style.height = "41vh";
    panel.style.bottom = "0";
    panel.style.marginBottom = "-2rem";
    startBounceAnimation(panel);
  } else {

    panel.classList.add("full-view");
    fullView.style.display = "flex"; 
    fullView.style.flexDirection = "column";
    smallView.style.display = "none"; 
    panel.style.height = "85vh";
    panel.style.bottom = "5%";
    stopBounceAnimation(panel);
  }

  isInfoPanelFullView = !isInfoPanelFullView;
};

const startBounceAnimation = (panel) => {
  stopBounceAnimation(panel);

  bounceInterval = setInterval(() => {
    panel.classList.add("bounce");
    setTimeout(() => panel.classList.remove("bounce"), 600);
  }, 2000);
};

const stopBounceAnimation = (panel) => {
  clearInterval(bounceInterval);
  bounceInterval = null;
  panel.classList.remove("bounce");
};

const animate = (timestamp, frame) => {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (!hitTestSourceRequested) {
      session.requestReferenceSpace("viewer").then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace }).then((source) => {
          hitTestSource = source;
        });
      });

      session.addEventListener("end", () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
        placeButton.style.display = "block";
      } else {
        reticle.visible = false;
        placeButton.style.display = "none";
      }
    }
  }

  renderer.render(scene, camera);
}

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

const init = async () => {
  container = document.createElement("div");
  document.getElementById("container").appendChild(container);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );
  scene.add(camera);

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  light.position.set(0.5, 1, 0.25);
  scene.add(light);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  const options = {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay"],
    domOverlay: { root: document.getElementById("content") },
  };

  const arButton = ARButton.createButton(renderer, options);
  document.querySelector(".buttons-container").appendChild(arButton);
  arButton.classList.add("styled-ar-button");

  setTimeout(() => {
    if (arButton.textContent === "START AR") {
      arButton.textContent = "START EXPERIENCE";
    }
  }, 100);

  arButton.addEventListener("click", () => {
    if (arButton.textContent === "STOP AR") {
      arButton.textContent = "Stop Experience";
      window.location.href = "/index.html";
    }
  });

  const createGradientTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "#BA543B");
    gradient.addColorStop(0.5, "#F19F40");
    gradient.addColorStop(1, "#D98A71");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  };

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.1, 0.12, 64, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: createGradientTexture(),
      opacity: 1,
      transparent: true,
      side: THREE.DoubleSide,
    })
  );

  const centerDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.015, 32),
    new THREE.MeshBasicMaterial({
      map: createGradientTexture(),
      opacity: 1,
      transparent: true,
    })
  );
  centerDot.rotateX(-Math.PI / 2);
  reticle.add(centerDot);

  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  scene.add(controller);

  placeButton.addEventListener("click", placeModel);

  if (placedObject) {
    hideHelperBlock();
    reticle.visible = false;
    placeButton.style.display = "none";
  }

  window.addEventListener("resize", onWindowResize);

  renderer.domElement.addEventListener("pointerdown", (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length > 0) {
      let clickedObject = intersects[0].object;

      while (clickedObject.parent && clickedObject.parent !== scene) {
        clickedObject = clickedObject.parent;
      }

      selectedObject = clickedObject;
      console.log("Selected object:", selectedObject);

      if (clickedObject === placedObject) {
        console.log("Placed object selected for manipulation.");
        infoPanel.style.display = "block";
      } else {
        console.warn("Clicked object is not the placed object.");
      }
    }
  });

  renderer.domElement.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].pageX - e.touches[1].pageX;
      const dy = e.touches[0].pageY - e.touches[1].pageY;
      initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
      pinchScaling = true;
    } else if (e.touches.length === 1) {
      lastTouchX = e.touches[0].pageX;
      isRotating = true;
    }
  });

  renderer.domElement.addEventListener("touchmove", (e) => {
    if (pinchScaling && e.touches.length === 2 && selectedObject) {
      const dx = e.touches[0].pageX - e.touches[1].pageX;
      const dy = e.touches[0].pageY - e.touches[1].pageY;
      const newPinchDistance = Math.sqrt(dx * dx + dy * dy);

      if (initialPinchDistance) {
        const scaleFactor = newPinchDistance / initialPinchDistance;
        const maxScale = 2;
        const minScale = 0.5;
        selectedObject.scale.setScalar(
          Math.min(
            maxScale,
            Math.max(minScale, selectedObject.scale.x * scaleFactor)
          )
        );
      }

      initialPinchDistance = newPinchDistance;
    } else if (isRotating && e.touches.length === 1 && selectedObject) {
      const currentTouchX = e.touches[0].pageX;
      const rotationSpeed = 0.005;
      const deltaX = currentTouchX - lastTouchX;
      selectedObject.rotation.y += deltaX * rotationSpeed;
      lastTouchX = currentTouchX;
    }
  });

  renderer.domElement.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
      initialPinchDistance = null;
      pinchScaling = false;
    }
    if (e.touches.length === 0) {
      isRotating = false;
      lastTouchX = null;
    }
  });

  if (renderer.xr) {
    renderer.xr.addEventListener("sessionstart", () => {
      console.log("XR session started.");
      arButton.classList.remove("styled-ar-button");
      arButton.classList.add("stop-ar-button-centered");
      showHelperBlock();
    });

    renderer.xr.addEventListener("sessionend", () => {
      console.log("XR session ended.");
      arButton.classList.remove("stop-ar-button-centered");
      arButton.classList.add("styled-ar-button");
      hideHelperBlock();
    });
  }

  await fetchModelData(modelId);
  await fetchRelatedModels();
  renderer.setAnimationLoop(animate);
};

const isWebXRSupported = async () => {
  if (!navigator.xr) return false;
  try {
    return await navigator.xr.isSessionSupported("immersive-ar");
  } catch {
    return false;
  }
};

const initApp = async () => {
  const webxrSupported = await isWebXRSupported();

  if (webxrSupported) {
    console.log("WebXR is supported. Initializing WebXR.");
    init();
  } else if (window.LAUNCHAR && window.LAUNCHAR.isSupported) {
    console.log("WebXR not supported. Using LaunchXR for AR support.");
    window.LAUNCHAR.initialize({
      key: "ZcTXRYA2TKLnlhJKtoKRfr9UDWFLLFNx",
      redirect: true,
    }).then(() => {
      window.LAUNCHAR.on("arSessionStarted", () => {
        console.log("LaunchXR AR session started.");
        init();
      });
    });
  } else {
    console.log(
      "Neither WebXR nor LaunchXR is supported. Using AR.js as fallback."
    );
  }
};

initApp();