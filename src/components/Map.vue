<!-- 
<template>
  <div>
    <div class="title-bar">
      <h1>SMALL SCALE MAPPING</h1>
    </div>

    <div class="footer">
      <button @click="triggerFileInput" class="upload-btn">Upload KML</button>
    </div>

    <input ref="fileInput" type="file" accept=".kml" style="display: none" @change="handleFileUpload" />

    <div id="map" style="height: 87.5vh;"></div>
  </div>
</template>

<script setup lang="ts">
import leaflet from "leaflet";
import { onMounted, ref, reactive, nextTick } from "vue";
import * as toGeoJSON from "@tmcw/togeojson";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useSessionStorage } from "@vueuse/core";
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";


const layerData = useSessionStorage("layers", {
  geojson: [] as Array<FeatureCollection<Geometry | null, GeoJsonProperties>>,
  geoJSONNames: [] as string[],
});

let map: leaflet.Map;
const kmlLayers = reactive<Record<string, leaflet.Layer>>({});
const fileInput = ref<HTMLInputElement | null>(null);
let overlayLayersControl: leaflet.Control.Layers | null = null;

const basemaps: Record<string, leaflet.TileLayer> = {};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file && file.name.endsWith(".kml")) {
    const kmlText = await readFile(file);
    await uploadFileToServer(file); // ✅ Save file to backend
    await loadKML(file.name, kmlText);
    input.value = "";
  } else {
    alert("Please upload a valid KML file.");
  }
};

const readFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

const uploadFileToServer = async (file: File) => {
  const formData = new FormData();
  formData.append("files", file);
  try {
    await fetch("http://localhost:3000/upload", {
      method: "POST",
      body: formData,
    });
    console.log("File uploaded to server.");
  } catch (err) {
    console.error("Upload failed:", err);
  }
};

const loadKML = async (kmlName: string, kmlText: string) => {
  try {
    const parser = new DOMParser();
    const kml = parser.parseFromString(kmlText, "text/xml");
    const geojson = toGeoJSON.kml(kml);

    if (kmlLayers[kmlName]) {
      map.removeLayer(kmlLayers[kmlName]);
      removeFromLayerData(kmlName);
      delete kmlLayers[kmlName];
    }

    const layer = leaflet.geoJSON(geojson, {
      style: {
        color: "blue",
        weight: 2,
      },
    });

    kmlLayers[kmlName] = layer;
    map.addLayer(layer);

    layerData.value.geojson.push(geojson);
    layerData.value.geoJSONNames.push(kmlName);

    refreshLayerControl();
  } catch (error) {
    console.error(`Error loading KML ${kmlName}:`, error);
  }
};

const removeFromLayerData = (name: string) => {
  const index = layerData.value.geoJSONNames.indexOf(name);
  if (index !== -1) {
    layerData.value.geojson.splice(index, 1);
    layerData.value.geoJSONNames.splice(index, 1);
  }
};

const removeKMLLayer = (name: string) => {
  const layer = kmlLayers[name];
  if (layer) {
    map.removeLayer(layer);
    delete kmlLayers[name];
    removeFromLayerData(name);
    refreshLayerControl();
  }
};

const refreshLayerControl = () => {
  if (overlayLayersControl) {
    map.removeControl(overlayLayersControl);
  }

  const overlays: Record<string, leaflet.Layer> = {};
  for (const name in kmlLayers) {
    overlays[name] = kmlLayers[name];
  }

  overlayLayersControl = leaflet.control.layers(basemaps, overlays, { collapsed: false }).addTo(map);

  nextTick(() => {
    addDeleteButtonsToLayerControl();
  });
};

const addDeleteButtonsToLayerControl = () => {
  if (!overlayLayersControl) return;

  const container = overlayLayersControl.getContainer();
  if (!container) return;

  const overlaysList = container.querySelectorAll<HTMLLabelElement>(".leaflet-control-layers-overlays label");

  overlaysList.forEach(label => {
    if (label.querySelector(".delete-btn-layer")) return;

    const overlayName = label.textContent?.trim() || "";

    if (overlayName && kmlLayers[overlayName]) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn-layer";
      deleteBtn.textContent = "🗑️";
      deleteBtn.title = `Remove ${overlayName}`;
      deleteBtn.style.marginLeft = "8px";
      deleteBtn.style.border = "none";
      deleteBtn.style.background = "transparent";
      deleteBtn.style.cursor = "pointer";
      deleteBtn.style.color = "red";
      deleteBtn.style.fontSize = "14px";
      deleteBtn.style.padding = "0";

      deleteBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeKMLLayer(overlayName);
      });

      label.appendChild(deleteBtn);
    }
  });
};

// let sanitationLayer = null;

const loadGeoJSON = async () => {
  try {
    const response = await fetch("data/SSSP2 (2).geojson");
    const data = await response.json();

    const markers = leaflet.markerClusterGroup();
    const geoJsonLayer = leaflet.geoJSON(data, {
      pointToLayer: (feature, latlng) => leaflet.marker(latlng),
      onEachFeature: (feature, layer) => {
        if (feature.properties) {
          layer.bindPopup(
            Object.keys(feature.properties)
              .map(key => `<strong>${key}:</strong> ${feature.properties[key]}`)
              .join("<br>")
          );
        }
      },
    });
   
    markers.addLayer(geoJsonLayer);
    map.addLayer(markers);
    overlayLayersControl?.addOverlay(markers, "SSSPS ");

  } catch (error) {
    console.error("Error loading GeoJSON:", error);
  }
};


const loadStoredLayers = async () => {
  try {
    const response = await fetch("http://localhost:3000/layers");
    const data = await response.json();

    const layer = leaflet.geoJSON(data, {
      style: { color: "blue", weight: 2 },
      onEachFeature: (feature, layer) => {
        if (feature.properties) {
          layer.bindPopup(
            Object.keys(feature.properties)
              .map(key => `<strong>${key}:</strong> ${feature.properties[key]}`)
              .join("<br>")
          );
        }
      }
    });

    map.addLayer(layer);
    kmlLayers["Saved KML Layers"] = layer;
    refreshLayerControl();
  } catch (error) {
    console.error("Failed to load stored KML layers:", error);
  }
};


onMounted(() => {
  // initialize map...


  const loadStoredKMLsFromServer = async () => {
  try {
    const response = await fetch("http://localhost:3000/kml-files");
    const kmlFiles: string[] = await response.json();

    for (const fileName of kmlFiles) {
      const kmlURL = `http://localhost:3000/uploads/${fileName}`;
      const kmlText = await fetch(kmlURL).then(res => res.text());
      await loadKML(fileName, kmlText);
    }
  

  } catch (error) {
    console.error("Failed to load stored KMLs:", error);
  }
};


  loadGeoJSON();       // Optional if you use another GeoJSON source
  loadStoredKMLsFromServer();
  loadStoredLayers();  // Load KML data from PostGIS here
});


onMounted(async () => {
  map = leaflet.map("map").setView([-0.84666, 36.45511], 11);

  const osm = leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  });

  const satellite = leaflet.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Tiles © Esri",
    }
  );

  const googleSat = leaflet.tileLayer(
    "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    {
      attribution: "&copy; Google",
      maxZoom: 20,
    }
  );

  const maptilerStreets = leaflet.tileLayer(
    "https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=pkofjgt6Yd5z6PF380jI",
    {
      tileSize: 512,
      zoomOffset: -1,
      minZoom: 0,
      maxZoom: 22,
      attribution:
        '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
    }
  );

  googleSat.addTo(map);
  basemaps["Google sat"] = googleSat;
  basemaps["OpenStreetMap"] = osm;
  basemaps["maptilerStreets"] = maptilerStreets;
  

  // Initialize overlay control AFTER map and base layers
  overlayLayersControl = leaflet.control.layers(basemaps, {}, { collapsed: false }).addTo(map);

  // ✅ Now safe to call functions that rely on overlayLayersControl
  await loadGeoJSON();             // Add GeoJSON layer
  // await loadStoredKMLsFromServer(); // Add saved KMLs if any

  const storedLayers = layerData.value.geojson;
  const storedNames = layerData.value.geoJSONNames;

  if (storedLayers && storedNames.length) {
    for (let i = 0; i < storedLayers.length; i++) {
      const layer = leaflet.geoJSON(storedLayers[i], {
        style: {
          color: "blue",
          weight: 2,
        },
      });
      kmlLayers[storedNames[i]] = layer;
      map.addLayer(layer);
    }
    refreshLayerControl();
  
  }
});

</script>;

<style scoped>
.title-bar {
  background-color: #4CAF50;
  color: white;
  padding: 17px;
  text-align: center;
  /* font-weight: bold; */
  font-family: serif

}
.footer {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background-color: #f4f4f4;
  text-align: center;
  padding: 10px;
  border-top: 2px solid #ccc;
}
.upload-btn {
  margin: 10px;
  padding: 10px 20px;
  background-color: #4c7aaf;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 16px;
  border-radius: 5px;
}
.upload-btn:hover {
  background-color: #45a049;
}
#map {
  width: 100%;
  position: relative;
}
.delete-btn-layer {
  margin-left: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: red;
  font-size: 14px;
  padding: 0;
}
</style> 


 -->












<template>
  <div>
    <div class="title-bar">
      <h1>CLSG METER VERIFICATION MAPPING</h1>
    </div>
        <div class="footer">
      <button @click="triggerFileInput" class="upload-btn">Upload KML</button>
    </div>
    <input ref="fileInput" type="file" accept=".kml" style="display: none" @change="handleFileUpload" />
    <div id="map" style="height: 100vh;"></div>
  </div>
</template>

<script setup lang="ts">
import leaflet from "leaflet";
import { onMounted, reactive, nextTick, ref } from "vue";
import * as toGeoJSON from "@tmcw/togeojson";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useSessionStorage } from "@vueuse/core";
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";

const layerData = useSessionStorage("layers", {
  geojson: [] as Array<FeatureCollection<Geometry | null, GeoJsonProperties>>,
  geoJSONNames: [] as string[],
});

let map: leaflet.Map;
const kmlLayers = reactive<Record<string, leaflet.Layer>>({});
const basemaps: Record<string, leaflet.TileLayer> = {};
const fileInput = ref<HTMLInputElement | null>(null);
let overlayLayersControl: leaflet.Control.Layers | null = null;

const refreshLayerControl = () => {
  if (overlayLayersControl) {
    map.removeControl(overlayLayersControl);
  }

  const overlays: Record<string, leaflet.Layer> = {};
  for (const name in kmlLayers) {
    overlays[name] = kmlLayers[name];
  }

  overlayLayersControl = leaflet.control.layers(basemaps, overlays, { collapsed: false }).addTo(map);
};

const loadGeoJSON = async () => {
  try {
    // const response = await fetch("data/Meter Reading.geojson");
    const response = await fetch("data/CLSG.geojson");
    const data = await response.json();

    const markers = leaflet.markerClusterGroup();
    const geoJsonLayer = leaflet.geoJSON(data, {
      pointToLayer: (feature, latlng) => leaflet.marker(latlng),
      onEachFeature: (feature, layer) => {
        if (feature.properties) {
          layer.bindPopup(
            Object.keys(feature.properties)
              .map(key => `<strong>${key}:</strong> ${feature.properties[key]}`)
              .join("<br>")
          );
        }
      },
    });

    markers.addLayer(geoJsonLayer);
    map.addLayer(markers);
    overlayLayersControl?.addOverlay(markers, "SSSPS");
  } catch (error) {
    console.error("Error loading GeoJSON:", error);
  }
};


const triggerFileInput = () => {
  fileInput.value?.click();
};


import JSZip from "jszip"; // Install via `npm install jszip`

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const filename = file.name.toLowerCase();

  try {
    let geojson;

    if (filename.endsWith(".kml")) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result?.toString() || "";
        const parser = new DOMParser();
        const kml = parser.parseFromString(content, "text/xml");
        geojson = toGeoJSON.kml(kml);
        await handleLayerAndUpload(geojson, file);
      };
      reader.readAsText(file);

    } else if (filename.endsWith(".kmz")) {
      const zip = await JSZip.loadAsync(file);
      let found = false;

      for (const fileName in zip.files) {
        if (fileName.toLowerCase().endsWith(".kml")) {
          const kmlText = await zip.files[fileName].async("text");
          const parser = new DOMParser();
          const kml = parser.parseFromString(kmlText, "text/xml");
          geojson = toGeoJSON.kml(kml);
          await handleLayerAndUpload(geojson, file);
          found = true;
          break;
        }
      }

      if (!found) {
        alert("KMZ file does not contain a KML.");
      }

    } else {
      alert("Only .kml or .kmz files are supported.");
    }

  } catch (err) {
    console.error("File processing error:", err);
    alert("Invalid KML/KMZ file.");
  }
};

// Helper function to upload and add to map
const handleLayerAndUpload = async (geojson: any, file: File) => {
  await uploadFileToServer(file); // Your existing upload function

  const layer = leaflet.geoJSON(geojson, {
    style: { color: "blue", weight: 2 },
    onEachFeature: (feature, layer) => {
      if (feature.properties) {
        layer.bindPopup(
          Object.entries(feature.properties)
            .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
            .join("<br>")
        );
      }
    },
  });

  map.addLayer(layer);
  kmlLayers[file.name] = layer;
  refreshLayerControl();
};

const uploadFileToServer = async (file: File) => {
  const formData = new FormData();
  formData.append("files", file);
  try {
    await fetch("http://localhost:3000/upload", {
      method: "POST",
      body: formData,
    });
    console.log("File uploaded to server.");
  } catch (err) {
    console.error("Upload failed:", err);
  }
};



const loadStoredLayers = async () => {
  try {
    const response = await fetch("http://localhost:3000/layers");
    const data = await response.json(); // data = { "Layer1.kml": FeatureCollection, ... }

    for (const [fileName, geojson] of Object.entries(data)) {
      // Type guard: check for valid FeatureCollection
      if (
        !geojson ||
        typeof geojson !== "object" ||
        geojson === null ||
        (geojson as FeatureCollection).type !== "FeatureCollection" ||
        !Array.isArray((geojson as any).features)
      ) {
        continue;
      }

      const layer = leaflet.geoJSON(geojson as FeatureCollection, {
        style: { color: "blue", weight: 2 },
        onEachFeature: (feature, layer) => {
          const props = feature.properties || {};
          const popupContent = Object.keys(props).length
            ? Object.entries(props).map(([key, val]) => `<strong>${key}:</strong> ${val}`).join("<br>")
            : `<strong>${fileName}</strong>`;
          layer.bindPopup(popupContent);
        }
      });

      kmlLayers[fileName] = layer;
      map.addLayer(layer);
    }

    refreshLayerControl();
  } catch (error) {
    console.error("Failed to load stored KML layers:", error);
  }
};


onMounted(async () => {
  map = leaflet.map("map").setView([-0.84666, 36.45511], 11);

  const osm = leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  });

  const googleSat = leaflet.tileLayer(
    "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    {
      attribution: "&copy; Google",
      maxZoom: 20,
    }
  );

  const maptilerStreets = leaflet.tileLayer(
    "https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=pkofjgt6Yd5z6PF380jI",
    {
      tileSize: 512,
      zoomOffset: -1,
      minZoom: 0,
      maxZoom: 22,
      attribution:
        '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
    }
  );

  googleSat.addTo(map);
  basemaps["Google sat"] = googleSat;
  basemaps["OpenStreetMap"] = osm;
  basemaps["MapTiler Streets"] = maptilerStreets;

  overlayLayersControl = leaflet.control.layers(basemaps, {}, { collapsed: false }).addTo(map);

  await loadGeoJSON();       // Optional
  await loadStoredLayers();  // Main PostGIS KML loading
});
</script>

<style scoped>
.title-bar {
  background-color: #4CAF50;
  color: white;
  padding: 17px;
  text-align: center;
  font-family: serif;
}
.footer {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background-color: #f4f4f4;
  text-align: center;
  padding: 10px;
  border-top: 2px solid #ccc;
}

.upload-btn {
  margin: 10px;
  padding: 10px 20px;
  background-color: #4c7aaf;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 16px;
  border-radius: 5px;
}
.upload-btn:hover {
  background-color: #45a049;
}
#map {
  width: 100%;
  position: relative;
}
</style> 
















