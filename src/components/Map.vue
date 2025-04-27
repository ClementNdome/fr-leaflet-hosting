
<template>
  <div>
    <div class="title-bar">
      <h1>SSWP MAPPING WITH VUE Js</h1>
    </div>
   
  <div class="footer">
      <button @click="triggerFileInput" class="upload-btn">Upload KML</button>
    </div>

    <input ref="fileInput" type="file" accept=".kml" style="display:none" @change="handleFileChange" />
  </div>

    <div id="map" style="height: 600px;"></div>
</template>

<script setup lang="ts">
import leaflet from "leaflet";
import { onMounted, ref } from "vue";
import * as toGeoJSON from "@tmcw/togeojson";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
// Types

type GeoJSONFeature = {
  type: string;
  geometry: {
    type: string;
    coordinates: number[];
  };
  properties?: Record<string, any>;
};

let map: leaflet.Map;
let kmlLayers: Record<string, leaflet.Layer> = {}; // Store KMLs here

// Reference to file input element
const fileInput = ref<HTMLInputElement | null>(null);

// Function to trigger the file input
const triggerFileInput = () => {
  fileInput.value?.click();
};

// Function to handle the file change (KML upload)
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
const loadKML = async (name: string, kmlText: string) => {
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

    kmlLayers[name] = layer; // Store by name
    map.addLayer(layer); // Add to map

    // Optionally, you can also add this layer to the layer control
    addToLayerControl(name, layer);
  } catch (error) {
    console.error(`Error loading KML ${name}:`, error);
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

  // Function to load GeoJSON data
  const loadGeoJSON = async () => {
  try {
    const response = await fetch('src/data/SSSP2 (2).geojson');
    const data = await response.json();

    // Create a Marker Cluster Group
    const markers = leaflet.markerClusterGroup();

    // Parse each feature into a marker and add to cluster group
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
  
   // Load GeoJSON here after map initialization
   loadGeoJSON();
 
});
</script>

<style scoped>

.title-bar {
  background-color: #4CAF50; /* Green background */
  color: white; /* White text */
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
  margin: 5px;
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
  margin: 20px 0;
  font-size: 8;
  font-family: 'Times New Roman', Times, serif;
  color: hsla(0, 28%, 93%, 0.989);
}

/* Map styling */
#map {
  height: 600px;
  width: 100%;
  position: relative;
}
</style> 

