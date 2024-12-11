

import * as THREE from "three";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zxietxwfjlcfhtiygxhe.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4aWV0eHdmamxjZmh0aXlneGhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE3NTUzMzUsImV4cCI6MjA0NzMzMTMzNX0.XTeIR13UCRlT4elaeiKiDll1XRD1WoVnLsPd3QVVGDU";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let container, camera, scene, renderer, reticle, controller;
let currentObject = null;
let currentModelData = null;
let placedObject = null;
let hitTestSource = null;
let hitTestSourceRequested = false;
let touchDown, touchX, touchY, deltaX, deltaY;
let isInfoPanelFullView = false;
let bounceInterval = null;
let pointer;

const placeButton = document.getElementById("place-button");
const infoPanel = document.getElementById("infoPanel");


const init = async () => {

  container = document.createElement("div");
  document.getElementById("container").appendChild(container);

  // Create scene and camera
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

      if (clickedObject === placedObject) {
        console.log("Placed object selected for manipulation.");
      } else {
        console.warn("Clicked object is not the placed object.");
      }
    }
  });

  renderer.domElement.addEventListener("touchstart", (e) => {
    e.preventDefault();
    touchDown = true;
    touchX = e.touches[0].pageX;
    touchY = e.touches[0].pageY;
  });

  renderer.domElement.addEventListener("touchend", (e) => {
    e.preventDefault();
    touchDown = false;
  });

  renderer.domElement.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!touchDown || !placedObject) return;

    deltaX = e.touches[0].pageX - touchX;
    deltaY = e.touches[0].pageY - touchY;
    touchX = e.touches[0].pageX;
    touchY = e.touches[0].pageY;

    placedObject.rotation.y += deltaX * 0.005;

    const scaleFactor = 1 - deltaY / 1000;
    placedObject.scale.multiplyScalar(scaleFactor);

    console.log(
      `Updated object: rotation=${placedObject.rotation.y}, scale=${placedObject.scale.x}`
    );
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



  await fetchModelData(2);
  renderer.setAnimationLoop(animate);
}

async function fetchModelData(modelId) {
  const { data, error } = await supabase
    .from("models")
    .select("*")
    .eq("id", modelId)
    .single();

  if (error) {
    console.error("Error fetching model data:", error);
    return;
  }

  currentModelData = data;
  console.log("Fetched model data:", currentModelData);
  await loadModel(currentModelData.glb_url);
}

const showHelperBlock = () => {
  const helperBlock = document.getElementById("helper-block");
  helperBlock.classList.remove("hidden");
};

const hideHelperBlock = () => {
  const helperBlock = document.getElementById("helper-block");
  helperBlock.classList.add("hidden");
};


async function loadModel(modelUrl) {
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
}

function onSelect() {
  if (reticle.visible && !placedObject && currentObject) {
    placeModel();
  }
}

function placeModel() {
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

  // Small View Content
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

  // Full View Content
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


const hideInfoPanel = () => {
  const panel = document.getElementById("infoPanel");

  panel.style.bottom = "-100%";
  setTimeout(() => {
    panel.style.display = "none";
  }, 300);

  isInfoPanelFullView = false;
  panel.removeEventListener("click", toggleInfoPanelFullView);

  stopBounceAnimation(panel);
};

const toggleInfoPanelFullView = (event) => {
  event.stopPropagation();

  const panel = document.getElementById("infoPanel");
  const fullView = document.getElementById("fullView");
  const smallView = document.getElementById("smallView");

  if (isInfoPanelFullView) {
    // Back to Small View
    panel.classList.remove("full-view");
    fullView.style.display = "none"; // Hide full view
    smallView.style.display = "block"; // Show small view
    panel.style.height = "41vh";
    panel.style.bottom = "0";
    panel.style.marginBottom = "-2rem";
    startBounceAnimation(panel);
  } else {
    // Expand to Full View
    panel.classList.add("full-view");
    fullView.style.display = "flex"; // Show full view
    fullView.style.flexDirection = "column";
    smallView.style.display = "none"; // Hide small view
    panel.style.height = "85vh"; // Full view height
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

function animate(timestamp, frame) {
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

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

init();

// function setupTouchEvents() {
//   renderer.domElement.addEventListener("touchstart", (e) => {
//     e.preventDefault();
//     touchDown = true;
//     touchX = e.touches[0].pageX;
//     touchY = e.touches[0].pageY;
//   });

//   renderer.domElement.addEventListener("touchend", (e) => {
//     e.preventDefault();
//     touchDown = false;
//   });

//   renderer.domElement.addEventListener("touchmove", (e) => {
//     e.preventDefault();
//     if (!touchDown || !placedObject) return;

//     deltaX = e.touches[0].pageX - touchX;
//     deltaY = e.touches[0].pageY - touchY;
//     touchX = e.touches[0].pageX;
//     touchY = e.touches[0].pageY;

//     placedObject.rotation.y += deltaX / 100;

//     const scaleFactor = 1 - deltaY / 1000;
//     placedObject.scale.multiplyScalar(scaleFactor);
//   });

//   console.log("Touch events setup");

// }
