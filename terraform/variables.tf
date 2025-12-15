variable "project_id" {
  description = "The Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud Region"
  type        = string
  default     = "europe-north1"
}

variable "service_account_email" {
  description = "Service account for Eventarc triggers"
  type        = string
}
