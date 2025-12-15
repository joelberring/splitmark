terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ==============================================================================
# Storage
# ==============================================================================

resource "google_storage_bucket" "maps_upload" {
  name          = "${var.project_id}-maps-upload"
  location      = var.region
  force_destroy = false
  
  uniform_bucket_level_access = true
  
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }
}

resource "google_storage_bucket" "maps_tiles" {
  name          = "${var.project_id}-maps-tiles"
  location      = var.region
  
  # Enable CDN
  website {
    main_page_suffix = "index.html"
  }
  
  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket" "traces" {
  name     = "${var.project_id}-traces"
  location = var.region
}

# ==============================================================================
# Networking & Redis
# ==============================================================================

resource "google_compute_network" "vpc_network" {
  name = "antigravity-vpc"
}

resource "google_vpc_access_connector" "connector" {
  name          = "vpc-conn"
  region        = var.region
  network       = google_compute_network.vpc_network.name
  ip_cidr_range = "10.8.0.0/28"
}

resource "google_redis_instance" "cache" {
  name           = "race-cache"
  memory_size_gb = 1
  region         = var.region
  authorized_network = google_compute_network.vpc_network.id
}

# ==============================================================================
# Services (Cloud Run)
# ==============================================================================

# Note: In a real flow, we build and push images first. 
# Here we define the service shells.

resource "google_cloud_run_service" "map_processor" {
  name     = "map-processor"
  location = var.region

  template {
    spec {
      containers {
        image = "gcr.io/${var.project_id}/map-processor:latest"
        env {
            name = "UPLOAD_BUCKET"
            value = google_storage_bucket.maps_upload.name
        }
        env {
            name = "TILES_BUCKET"
            value = google_storage_bucket.maps_tiles.name
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

resource "google_cloud_run_service" "competitor_ingest" {
  name     = "competitor-ingest"
  location = var.region

  template {
    spec {
      containers {
        image = "gcr.io/${var.project_id}/competitor-ingest:latest"
        env {
            name = "REDIS_ADDR"
            value = "${google_redis_instance.cache.host}:${google_redis_instance.cache.port}"
        }
      }
    }
  }
}

# ==============================================================================
# Eventarc Triggers
# ==============================================================================

# Trigger map-processor when file uploaded to upload bucket
resource "google_eventarc_trigger" "map_upload_trigger" {
  name     = "trigger-map-upload"
  location = var.region
  
  matching_criteria {
    attribute = "type"
    value     = "google.cloud.storage.object.v1.finalized"
  }
  
  matching_criteria {
    attribute = "bucket"
    value     = google_storage_bucket.maps_upload.name
  }
  
  destination {
    cloud_run_service {
      service = google_cloud_run_service.map_processor.name
      region  = var.region
    }
  }
  
  service_account = var.service_account_email
}
