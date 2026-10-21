variable "name_prefix" {
  description = "Prefix for resources"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_db_subnet_ids" {
  description = "List of private database subnet IDs"
  type        = list(string)
}

variable "authorized_security_group_ids" {
  description = "Security group IDs authorized to connect to Redis"
  type        = list(string)
  default     = []
}

variable "app_security_group_id" {
  description = "Legacy app security group ID for backward compatibility"
  type        = string
  default     = ""
}

variable "node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.micro"
}

variable "transit_encryption_enabled" {
  description = "Enable transit encryption (TLS)"
  type        = bool
  default     = true
}

variable "at_rest_encryption_enabled" {
  description = "Enable at-rest encryption"
  type        = bool
  default     = true
}

variable "auth_token" {
  description = "Redis AUTH password token"
  type        = string
  default     = ""
  sensitive   = true
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
