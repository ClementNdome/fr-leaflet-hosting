const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { DOMParser } = require("xmldom");
const { kml } = require("@tmcw/togeojson");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// PostgreSQL connection
const pool = new Pool({
  user: "postgres",           // replace with your DB user
  host: "localhost",          // your DB host
  database: "Vue",            // your DB name
  password: "GIS DATABASE",   // your DB password
  port: 5432,
});

// File storage setup
const uploadFolder = "./uploads";
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder);
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

// Upload endpoint
app.post("/upload", upload.array("files"), async (req, res) => {
  try {
    for (let file of req.files) {
      console.log("File received:", file.originalname);

      // Convert KML to GeoJSON
      const kmlData = fs.readFileSync(file.path, "utf8");
      const dom = new DOMParser().parseFromString(kmlData, "text/xml");
      const geojson = kml(dom);

      // Insert features into PostgreSQL
      for (let feature of geojson.features) {
        await pool.query(
          `INSERT INTO geo_data (name, geometry) 
           VALUES ($1, ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON($2)), 4326))`,
          [file.originalname, JSON.stringify(feature.geometry)]
        );
      }
    }

    res.status(200).json({ message: "All files uploaded and saved to PostgreSQL!" });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Server error during file upload" });
  }
});

// Serve layers (assuming table kml_layers has 'geometry' column)
// app.get('/layers', async (req, res) => {
//   try {
//     const result = await pool.query(`
//       SELECT name, properties, ST_AsGeoJSON(geometry) AS geometry
//       FROM kml_layers
//     `);

//     const geojson = {
//       type: "FeatureCollection",
//       features: result.rows.map(row => ({
//         type: "Feature",
//         geometry: JSON.parse(row.geometry),
//         properties: row.properties,
//       })),
//     };

//     res.json(geojson);
//   } catch (err) {
//     console.error("Layers fetch error:", err);
//     res.status(500).json({ error: "Server error fetching layers" });
//   }
// });


app.get('/layers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT name, ST_AsGeoJSON(geometry) AS geometry
      FROM geo_data
    `);

    const layers = {};

    result.rows.forEach(row => {
      if (!layers[row.name]) {
        layers[row.name] = {
          type: "FeatureCollection",
          features: [],
        };
      }

      layers[row.name].features.push({
        type: "Feature",
        geometry: JSON.parse(row.geometry),
        properties: {}, // optionally include more attributes
      });
    });

    res.json(layers); // returns each uploaded file as its own GeoJSON layer
  } catch (err) {
    console.error("Layers fetch error:", err);
    res.status(500).json({ error: "Server error fetching layers" });
  }
});






// app.get('/layers', async (req, res) => {
//   try {
//     const result = await pool.query(`
//       SELECT name, NULL AS properties, ST_AsGeoJSON(geometry) AS geometry
//       FROM geo_data
//     `);

//     const geojson = {
//       type: "FeatureCollection",
//       features: result.rows.map(row => ({
//         type: "Feature",
//         geometry: JSON.parse(row.geometry),
//         properties: { name: row.name },
//       })),
//     };

//     res.json(geojson);
//   } catch (err) {
//     console.error("Layers fetch error:", err);
//     res.status(500).send("Server Error");
//   }
// });







// Serve saved GeoJSON from geo_data table
app.get("/data", async (req, res) => {
  try {
    const result = await pool.query("SELECT name, ST_AsGeoJSON(geometry) AS geojson FROM geo_data");
    const features = result.rows.map(row => ({
      type: "Feature",
      geometry: JSON.parse(row.geojson),
      properties: { name: row.name },
    }));

    res.json({ type: "FeatureCollection", features });
  } catch (err) {
    console.error("Database fetch error:", err);
    res.status(500).json({ error: "Database error fetching geo data" });
  }
});


app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Endpoint to list uploaded KML files
app.get("/kml-files", (req, res) => {
  const uploadsDir = path.join(__dirname, "uploads");
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Failed to list files." });
    }
    const kmlFiles = files.filter(file => file.endsWith(".kml"));
    res.json(kmlFiles);
  });
});

app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});


