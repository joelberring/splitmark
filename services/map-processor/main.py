
import os
import logging
import subprocess
import json
import numpy as np
from flask import Flask, request
from google.cloud import storage

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
UPLOAD_BUCKET = os.environ.get('UPLOAD_BUCKET', 'antigravity-maps-upload')
TILES_BUCKET = os.environ.get('TILES_BUCKET', 'antigravity-maps-tiles')

def solve_affine(pixel_points, gps_points):
    """
    Solves for Affine Transformation Matrix given 3 point pairs.
    pixel_points: [[x1, y1], [x2, y2], [x3, y3]]
    gps_points:   [[lat1, lon1], [lat2, lon2], [lat3, lon3]]
    """
    try:
        # System of equations for X (Longitude) = Ax + By + C
        # System of equations for Y (Latitude)  = Dx + Ey + F
        
        # P matrix construction
        # We need to solve P * coeffs = Target
        # Where P is constructed from pixel coordinates [x, y, 1]
        
        # Ensure we have at least 3 points
        if len(pixel_points) < 3 or len(gps_points) < 3:
            raise ValueError("At least 3 points required")

        P = np.array([
            [p[0], p[1], 1] for p in pixel_points
        ])
        
        Target_Lon = np.array([p[1] for p in gps_points]) # Longitude (X)
        Target_Lat = np.array([p[0] for p in gps_points]) # Latitude (Y)
        
        # Solve least squares if > 3 points, or exact if == 3
        # numpy.linalg.lstsq returns (solution, residuals, rank, s)
        coeffs_lon, _, _, _ = np.linalg.lstsq(P, Target_Lon, rcond=None)
        coeffs_lat, _, _, _ = np.linalg.lstsq(P, Target_Lat, rcond=None)
        
        # Unpack coefficients
        # coeffs_lon = [A, B, C] -> Lon = Ax + By + C
        # coeffs_lat = [D, E, F] -> Lat = Dx + Ey + F
        
        return {
            'A': coeffs_lon[0], 'B': coeffs_lon[1], 'C': coeffs_lon[2],
            'D': coeffs_lat[0], 'E': coeffs_lat[1], 'F': coeffs_lat[2]
        }
    except np.linalg.LinAlgError as e:
        logger.error(f"Linear Algebra Error: {e}")
        return None
    except Exception as e:
        logger.error(f"Error solving affine: {e}")
        return None

def run_gdal_pipeline(input_path, output_dir, gcps):
    """
    Executes the GDAL pipeline:
    1. gdal_translate (add GCPs) -> VRT
    2. gdalwarp (VRT -> GeoTIFF EPSG:3857)
    3. gdal2tiles (GeoTIFF -> Tiles)
    """
    try:
        # 1. Create VRT with GCPs
        vrt_path = os.path.join(output_dir, "temp.vrt")
        
        # Construct gdal_translate command
        cmd_translate = ['gdal_translate', '-of', 'VRT']
        for gcp in gcps:
            # -gcp <pixel_column> <pixel_line> <easting> <northing> [elevation]
            # pixel_x (column), pixel_y (line), lon (easting), lat (northing)
            cmd_translate.extend(['-gcp', str(gcp['pixel'][0]), str(gcp['pixel'][1]), str(gcp['geo'][1]), str(gcp['geo'][0])])
        
        cmd_translate.extend([input_path, vrt_path])
        
        logger.info(f"Running gdal_translate: {' '.join(cmd_translate)}")
        subprocess.check_call(cmd_translate)
        
        # 2. Warp to GeoTIFF (Web Mercator)
        warped_tif = os.path.join(output_dir, "warped.tif")
        cmd_warp = [
            'gdalwarp', 
            '-t_srs', 'EPSG:3857', 
            '-r', 'lanczos',
            '-co', 'COMPRESS=DEFLATE',
            '-co', 'TILED=YES',
            '-dstalpha', # Add alpha channel for transparency
            vrt_path, warped_tif
        ]
        
        logger.info(f"Running gdalwarp: {' '.join(cmd_warp)}")
        subprocess.check_call(cmd_warp)
        
        # 3. Generate Tiles
        tiles_dir = os.path.join(output_dir, "tiles")
        cmd_tiles = [
            'gdal2tiles.py',
            '--profile=mercator',
            '-z', '10-18',
            '--processes=4',
            warped_tif,
            tiles_dir
        ]
        
        logger.info(f"Running gdal2tiles: {' '.join(cmd_tiles)}")
        subprocess.check_call(cmd_tiles)
        
        return tiles_dir

    except subprocess.CalledProcessError as e:
        logger.error(f"GDAL subprocess failed: {e}")
        raise

@app.route("/", methods=["POST"])
def index():
    """Receive Eventarc events."""
    event = request.get_json()
    if not event:
        return "Bad Request: no JSON", 400
    
    logger.info(f"Received event: {json.dumps(event)}")
    
    # Check if this is a GCS finalized event
    if event.get("kind") == "storage#object":
        bucket = event["bucket"]
        name = event["name"]
        
        # Only process raw uploads (ignore processed files if they trigger events)
        if bucket == UPLOAD_BUCKET and not name.endswith(".json"):
             # In a real scenario, we would download the file and its metadata (containing GCPs)
             # For this artifact, we assume the GCPs are side-loaded or in metadata
             pass
             
    return "OK", 200

# Verification Endpoint for Artifact Testing
@app.route("/verify-pipeline", methods=["POST"])
def verify_pipeline():
    """
    Expects JSON:
    {
        "image_path": "/local/path/to/image.jpg",
        "output_dir": "/local/path/to/output",
        "gcps": [
            {"pixel": [x, y], "geo": [lat, lon]}, ...
        ]
    }
    """
    data = request.get_json()
    input_path = data.get("image_path")
    output_dir = data.get("output_dir")
    gcps = data.get("gcps")
    
    if not all([input_path, output_dir, gcps]):
        return "Missing arguments", 400
        
    try:
        # Also test the Affine Solver (Pure Math)
        pixel_points = [g['pixel'] for g in gcps]
        gps_points = [g['geo'] for g in gcps]
        affine_matrix = solve_affine(pixel_points, gps_points)
        
        # Run GDAL Pipeline
        run_gdal_pipeline(input_path, output_dir, gcps)
        
        return {
            "status": "success",
            "affine_matrix": affine_matrix
        }, 200
    except Exception as e:
        logger.error(f"Verification failed: {e}")
        return f"Failed: {e}", 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
