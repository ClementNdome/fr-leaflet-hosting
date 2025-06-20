// const express = require("express");
// const multer = require("multer");
// const fs = require("fs");
// const path = require("path");
// const { DOMParser } = require("xmldom");
// const { kml } = require("@tmcw/togeojson");
// const cors = require("cors");
// const { Pool } = require("pg");

// const app = express();
// const port = 3000;

// app.use(cors());
// app.use(express.json());
// app.use(express.static("public"));

// // PostgreSQL connection
// const pool = new Pool({
//   user: "postgres",           // replace with your DB user
//   host: "localhost",          // your DB host
//   database: "Vue",            // your DB name
//   password: "GIS DATABASE",   // your DB password
//   port: 5432,
// });

// // File storage setup
// const uploadFolder = "./uploads";
// if (!fs.existsSync(uploadFolder)) {
//   fs.mkdirSync(uploadFolder);
// }
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadFolder);
//   },
//   filename: (req, file, cb) => {
//     cb(null, file.originalname);
//   },
// });
// const upload = multer({ storage });

// // Upload endpoint
// app.post("/upload", upload.array("files"), async (req, res) => {
//   try {
//     for (let file of req.files) {
//       console.log("File received:", file.originalname);

//       // Convert KML to GeoJSON
//       const kmlData = fs.readFileSync(file.path, "utf8");
//       const dom = new DOMParser().parseFromString(kmlData, "text/xml");
//       const geojson = kml(dom);

//       // Insert features into PostgreSQL
//       for (let feature of geojson.features) {
//         await pool.query(
//           `INSERT INTO geo_data (name, geometry) 
//            VALUES ($1, ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON($2)), 4326))`,
//           [file.originalname, JSON.stringify(feature.geometry)]
//         );
//       }
//     }

//     res.status(200).json({ message: "All files uploaded and saved to PostgreSQL!" });
//   } catch (err) {
//     console.error("Upload error:", err);
//     res.status(500).json({ error: "Server error during file upload" });
//   }
// });


// app.get('/layers', async (req, res) => {
//   try {
//     const result = await pool.query(`
//       SELECT name, ST_AsGeoJSON(geometry) AS geometry
//       FROM geo_data
//     `);

//     const layers = {};

//     result.rows.forEach(row => {
//       if (!layers[row.name]) {
//         layers[row.name] = {
//           type: "FeatureCollection",
//           features: [],
//         };
//       }

//       layers[row.name].features.push({
//         type: "Feature",
//         geometry: JSON.parse(row.geometry),
//         properties: {}, // optionally include more attributes
//       });
//     });

//     res.json(layers); // returns each uploaded file as its own GeoJSON layer
//   } catch (err) {
//     console.error("Layers fetch error:", err);
//     res.status(500).json({ error: "Server error fetching layers" });
//   }
// });


// // Serve saved GeoJSON from geo_data table
// app.get("/data", async (req, res) => {
//   try {
//     const result = await pool.query("SELECT name, ST_AsGeoJSON(geometry) AS geojson FROM geo_data");
//     const features = result.rows.map(row => ({
//       type: "Feature",
//       geometry: JSON.parse(row.geojson),
//       properties: { name: row.name },
//     }));

//     res.json({ type: "FeatureCollection", features });
//   } catch (err) {
//     console.error("Database fetch error:", err);
//     res.status(500).json({ error: "Database error fetching geo data" });
//   }
// });


// app.use(cors());
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// // Endpoint to list uploaded KML files
// app.get("/kml-files", (req, res) => {
//   const uploadsDir = path.join(__dirname, "uploads");
//   fs.readdir(uploadsDir, (err, files) => {
//     if (err) {
//       return res.status(500).json({ error: "Failed to list files." });
//     }
//     const kmlFiles = files.filter(file => file.endsWith(".kml"));
//     res.json(kmlFiles);
//   });
// });

// app.listen(3000, () => {
//   console.log("Server started on http://localhost:3000");
// });












const express = require("express");
const multer = require("multer");
const { DOMParser } = require("xmldom");
const { kml } = require("@tmcw/togeojson");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "Vue",
  password: "GIS DATABASE",
  port: 5432,
});

// Use memory storage instead of disk
const storage = multer.memoryStorage();
const upload = multer({ storage });





app.post("/upload", upload.array("files"), async (req, res) => {
  try {
    console.log("Received files:", req.files.length);

    for (let file of req.files) {
      console.log("Processing file:", file.originalname);

      const content = file.buffer.toString("utf8");
      let geojson;

      if (file.originalname.endsWith(".kml")) {
        const dom = new DOMParser().parseFromString(content, "text/xml");
        geojson = kml(dom);
        console.log("Parsed KML file:", file.originalname);
      } else if (file.originalname.endsWith(".geojson") || file.originalname.endsWith(".json")) {
        geojson = JSON.parse(content);
        console.log("Parsed GeoJSON file:", file.originalname);
      } else {
        console.log("Unsupported file type:", file.originalname);
        continue;
      }

      if (!geojson.features) {
        console.log("No features found in:", file.originalname);
        continue;
      }

      for (let feature of geojson.features) {
        await pool.query(
          `INSERT INTO geo_data (name, geometry)
           VALUES ($1, ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON($2)), 4326))`,
          [file.originalname, JSON.stringify(feature.geometry)]
        );
      }

      console.log("Finished saving:", file.originalname);
    }

    res.status(200).json({ message: "Files processed and saved!" });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Server error uploading files" });
  }
});



// Upload endpoint - now processes file in memory
app.post("/upload", upload.array("files"), async (req, res) => {
  try {
    for (let file of req.files) {
      console.log("Processing file:", file.originalname);

      const kmlData = file.buffer.toString("utf8");
      const dom = new DOMParser().parseFromString(kmlData, "text/xml");
      const geojson = kml(dom);

      for (let feature of geojson.features) {
        await pool.query(
          `INSERT INTO geo_data (name, geometry) 
           VALUES ($1, ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON($2)), 4326))`,
          [file.originalname, JSON.stringify(feature.geometry)]
        );
      }
    }

    res.status(200).json({ message: "Files processed and saved to PostgreSQL!" });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Error during file upload" });
  }
});

// Endpoint to get layers as separate GeoJSON groups by name
app.get("/layers", async (req, res) => {
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
        properties: {},
      });
    });

    res.json(layers);
  } catch (err) {
    console.error("Layers fetch error:", err);
    res.status(500).json({ error: "Error fetching layers" });
  }
});

// Single FeatureCollection of all features
app.get("/data", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT name, ST_AsGeoJSON(geometry) AS geojson
      FROM geo_data
    `);

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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});




















// const express = require("express");
// const multer = require("multer");
// const { DOMParser } = require("xmldom");
// const { kml } = require("@tmcw/togeojson");
// const cors = require("cors");
// const { Pool } = require("pg");

// const app = express();
// const port = 3000;

// app.use(cors());
// app.use(express.json());

// // PostgreSQL connection
// const pool = new Pool({
//   user: "postgres",
//   host: "localhost",
//   database: "Vue",
//   password: "GIS DATABASE", // Make sure your password is correctly set
//   port: 5432,
// });

// // Use memory storage for file uploads
// // const storage = multer.memoryStorage();
// const upload = multer({ storage });

// /**
//  * Upload endpoint for KML/GeoJSON
//  */
// app.post("/upload", upload.array("files"), async (req, res) => {
//   try {
//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({ error: "No files uploaded" });
//     }

//     console.log(`Received ${req.files.length} files`);

//     for (let file of req.files) {
//       console.log("Processing file:", file.originalname);

//       const content = file.buffer.toString("utf8");
//       let geojson;

//       // Parse file content based on type
//       if (file.originalname.endsWith(".kml")) {
//         const dom = new DOMParser().parseFromString(content, "text/xml");
//         geojson = kml(dom);
//         console.log("Parsed KML file:", file.originalname);
//       } else if (file.originalname.endsWith(".geojson") || file.originalname.endsWith(".json")) {
//         geojson = JSON.parse(content);
//         console.log("Parsed GeoJSON file:", file.originalname);
//       } else {
//         console.warn("Unsupported file type:", file.originalname);
//         continue;
//       }

//       if (!geojson.features || geojson.features.length === 0) {
//         console.warn("No features found in:", file.originalname);
//         continue;
//       }

//       for (let feature of geojson.features) {
//         if (!feature.geometry) {
//           console.warn("Skipping feature with no geometry in:", file.originalname);
//           continue;
//         }

//         const geometryString = JSON.stringify(feature.geometry);

//         try {
//           await pool.query(
//             `INSERT INTO geo_data (name, geometry)
//              VALUES ($1, ST_SetSRID(ST_Force2D(ST_GeomFromGeoJSON($2)), 4326))`,
//             [file.originalname, geometryString]
//           );
//           console.log("Saved feature:", geometryString);
//         } catch (queryErr) {
//           console.error("Insert error:", queryErr.message);
//         }
//       }

//       console.log("Finished saving:", file.originalname);
//     }

//     res.status(200).json({ message: "Files processed and saved!" });
//   } catch (err) {
//     console.error("Upload error:", err);
//     res.status(500).json({ error: "Server error uploading files" });
//   }
// });







// /**
//  * Endpoint to get data grouped by file name
//  */
// app.get("/layers", async (req, res) => {
//   try {
//     const result = await pool.query(`
//       SELECT name, ST_AsGeoJSON(geometry) AS geometry
//       FROM geo_data
//     `);

//     const layers = {};
//     result.rows.forEach(row => {
//       if (!layers[row.name]) {
//         layers[row.name] = {
//           type: "FeatureCollection",
//           features: [],
//         };
//       }

//       layers[row.name.features.push({
//         type: "Feature",
//         geometry: JSON.parse(row.geometry),
//         properties: {},
//       })];
//     });

//     res.json(layers);
//   } catch (err) {
//     console.error("Layers fetch error:", err);
//     res.status(500).json({ error: "Error fetching layers" });
//   }
// });

// /**
//  * Endpoint to return all features in one collection
//  */
// app.get("/data", async (req, res) => {
//   try {
//     const result = await pool.query(`
//       SELECT name, ST_AsGeoJSON(geometry) AS geojson
//       FROM geo_data
//     `);

//     const features = result.rows.map(row => ({
//       type: "Feature",
//       geometry: JSON.parse(row.geojson),
//       properties: { name: row.name },
//     }));

//     res.json({ type: "FeatureCollection", features });
//   } catch (err) {
//     console.error("Database fetch error:", err);
//     res.status(500).json({ error: "Database error fetching geo data" });
//   }
// });

// // Start the server
// app.listen(port, () => {
//   console.log(`Server running at http://localhost:${port}`);
// });
