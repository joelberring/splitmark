import requests
import json
import os
import sys

# Configuration
SERVICE_URL = "http://localhost:8080/verify-pipeline"
IMAGE_PATH = "/tmp/test_map.jpg"
OUTPUT_DIR = "/tmp/output"

def main():
    print("--- Map Processor Verification Artifact ---")
    
    # Check if we have a dummy image, if not create a simple one (if PIL available) or warn
    if not os.path.exists(IMAGE_PATH):
        print(f"Creating dummy image at {IMAGE_PATH}")
        try:
            # Try to create a simple red image using pure python if no PIL
            with open(IMAGE_PATH, "wb") as f:
                # Minimal JPEG header + some data (invalid image but might pass if only file existence checked? 
                # No, GDAL needs real image.
                # Use PIL if possible, otherwise rely on user providing one.
                pass 
            print("WARNING: Created empty file. GDAL will fail. Please provide a real JPEG at /tmp/test_map.jpg")
        except:
            pass

    # Dummy GCPs (Pixel -> Lat/Lon)
    # Stockholm Area: 
    # Top Left: 18.0, 59.4
    # Top Right: 18.2, 59.4
    # Bottom Left: 18.0, 59.2
    
    # Assume 1000x1000 pixel image
    gcps = [
        {"pixel": [0, 0],       "geo": [59.4, 18.0]}, # Top Left (Lat, Lon)
        {"pixel": [1000, 0],    "geo": [59.4, 18.2]}, # Top Right
        {"pixel": [0, 1000],    "geo": [59.2, 18.0]}, # Bottom Left
    ]
    
    payload = {
        "image_path": IMAGE_PATH,
        "output_dir": OUTPUT_DIR,
        "gcps": gcps
    }
    
    print(f"Sending request to {SERVICE_URL}...")
    try:
        response = requests.post(SERVICE_URL, json=payload)
        
        if response.status_code == 200:
            print("SUCCESS: Service returned 200 OK")
            print("Response:", json.dumps(response.json(), indent=2))
        else:
            print(f"FAILURE: Service returned {response.status_code}")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("ERROR: Could not connect to service. Is it running?")
        print("Run: docker build -t map-processor ./services/map-processor && docker run -p 8080:8080 -v /tmp:/tmp map-processor")

if __name__ == "__main__":
    main()
