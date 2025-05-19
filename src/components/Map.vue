<template>
  <div>
    <div class="title-bar">
      <h1> Sanitataion Baseline Mapping </h1>
    </div>

    <div class="footer">
      <button @click="triggerFileInput" class="upload-btn">Upload KML</button>
    </div>

    <input ref="fileInput" type="file" accept=".kml" style="display:none" @change="handleFileChange" />
  </div>

  <div id="map" style="height: 80vh;"></div>
</template>

<script setup lang="ts">
import leaflet from "leaflet";
import { onMounted, ref } from "vue";
import * as toGeoJSON from "@tmcw/togeojson";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useSessionStorage } from "@vueuse/core";
import { Session } from "node:inspector";
import type { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import { GeoJSON } from "geojson";
import type { Layer } from "leaflet";
// import { FileSessionVariableComponent } from "./MapSession.vue";
// Types

type GeoJSONFeature = {
  type: string;
  geometry: {
    type: string;
    coordinates: number[];
  };
  properties?: Record<string, any>;
};

const layerData = useSessionStorage("layers", {
  geojson: [] as Array<FeatureCollection<Geometry | null, GeoJsonProperties>>,
  geoJSONNames: [] as string[],
});


let map: leaflet.Map;
let kmlLayers: Record<string, leaflet.Layer> = {}; // Store KMLs here

const fileInput = ref<HTMLInputElement | null>(null);
const sessionData = ref<{ [key: string]: any } | null>(null);

// Function to trigger the file input
const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file && file.name.endsWith(".kml")) {
    const kmlText = await readFile(file);
    await loadKML(file.name, kmlText);
  } else {
    alert("Please upload a valid KML file.");
  }
};

// Function to read the KML file
const readFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

// Function to load the KML file
const loadKML = async (kmlName: string, kmlText: string) => {
  try {
    const parser = new DOMParser();
    const kml = parser.parseFromString(kmlText, "text/xml");
    const geojson = toGeoJSON.kml(kml);

    const layer = leaflet.geoJSON(geojson, {
      style: {
        color: 'blue',
        weight: 2
      }
    });

    kmlLayers[kmlName] = layer; // Store by name
    // send geojson to mobile app
    console.log("KML Layers: ", layer);
    map.addLayer(layer); // Add to map

    // Store the layer in session storage
    console.log("Geo Type:", layerData.value.geojson)
    layerData.value.geojson.push(geojson);
    layerData.value.geoJSONNames.push(kmlName);
    // layerData.value.kmlLayers = layerData.value.kmlLayers;

    console.log("Session Storage: ", layerData.value.geojson);

    addToLayerControl(kmlName, layer);
  } catch (error) {
    console.error(`Error loading KML ${kmlName}:`, error);
  }
};

// Function to add the layer to the layer control
const addToLayerControl = (name: string, layer: leaflet.Layer) => {
  leaflet.control.layers(
    {},
    { [name]: layer },
    { collapsed: false }
  ).addTo(map);
};

let userGeoMarker: leaflet.Marker;

const loadGeoJSON = async () => {
  try {
    const response = await fetch('src/data/Sanitation Baseline (6).geojson');
    const data = await response.json();

    // Create a Marker Cluster Group
    const markers = leaflet.markerClusterGroup();


    const geoJsonLayer = leaflet.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        return leaflet.marker(latlng);
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties) {
          layer.bindPopup(
            Object.keys(feature.properties)
              .map(key => `<strong>${key}:</strong> ${feature.properties[key]}`)
              .join('<br>')
          );
        }
      }
    });

    markers.addLayer(geoJsonLayer); // Add the GeoJSON layer to the marker cluster group
    //  console.log("GeoJSON Layer: ", geoJsonLayer); // send this to mobile server
    map.addLayer(markers); // Add the cluster group to the map
  } catch (error) {
    console.error('Error loading GeoJSON:', error);
  }
}

onMounted(() => {
  map = leaflet
    .map("map")
    .setView([-0.84666, 36.45511], 11);

  // Base maps
  const osm = leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  });
  // Satellite basemap (from Esri)
  const satellite = leaflet.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution: "Tiles © Esri"
    }
  );

  // Add the default layer to map
  osm.addTo(map);

  // Add the Layer Control
  leaflet.control.layers(
    {
      "OpenStreetMap": osm,
      "Satellite": satellite,
    }
  ).addTo(map);


  loadGeoJSON();

  // Autoloads  
  const storedKmlLayers = layerData.value.geojson;
  const kmlName = layerData.value.geoJSONNames;

  if (storedKmlLayers) {
    console.log("Storage Layers: ", layerData.value.geojson.length, " KML Name: ", kmlName[0]);
    for (let i = 0; i < storedKmlLayers.length; i++) {
      console.log("Stored KML Layers: ", storedKmlLayers[i]);

      // construct a random rgb color
      // const randomColor = Math.random()*255

      const layer = leaflet.geoJSON(storedKmlLayers[i], {
        style: {
          color: "blue",
          weight: 2
        }
      });


      console.log("KML Layers: ", layer);
      map.addLayer(layer); // Add to map
      addToLayerControl(kmlName[i], layer);
    }
  }

});
</script>

<style scoped>
.title-bar {
  background-color: #4CAF50;
  /* Green background */
  color: white;
  /* White text */
  padding: 20px;
  text-align: center;
  font-size: 10px;
  font-weight: bold;
}

/* Footer styling for the button */
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

h1 {
  text-align: center;
  margin: 15px;
  font-size: 8;
  font-family: sans-serif;
  color: hsla(0, 28%, 93%, 0.989);
}

/* Map styling */
#map {
  /* height: 650px; */
  width: 100%;
  position: relative;
}
</style>
