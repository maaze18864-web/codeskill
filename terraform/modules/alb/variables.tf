variable "name_prefix" {
  description = "Prefix for ALB resources"
  type        = string
  default     = "codeskill"
}

variable "vpc_id" {
  description = "VPC ID where target groups are created"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for the ALB"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security Group ID for the ALB"
  type        = string
}

variable "certificate_arn" {
  description = "ACM Certificate ARN for HTTPS listener. If empty, HTTP listener will forward directly to targets."
  type        = string
  default     = ""
}

variable "ssl_policy" {
  description = "SSL policy for HTTPS listener"
  type        = string
  default     = "ELBSecurityPolicy-TLS13-1-2-2021-06"
}

variable "frontend_health_check_path" {
  description = "Health check path for frontend readiness target group"
  type        = string
  default     = "/health/ready"
}

variable "backend_health_check_path" {
  description = "Health check path for backend readiness target group"
  type        = string
  default     = "/api/health/ready"
}

variable "health_check_matcher" {
  description = "HTTP status codes considered healthy"
  type        = string
  default     = "200"
}

variable "deregistration_delay" {
  description = "Connection draining timeout in seconds"
  type        = number
  default     = 30
}

variable "idle_timeout" {
  description = "ALB idle timeout in seconds (tuned for long-lived WebSocket exam connections)"
  type        = number
  default     = 300
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection on the ALB"
  type        = bool
  default     = false
}

variable "target_group_name" {
  description = "Custom name for the application target group. If empty, defaults to name_prefix-fe-tg"
  type        = string
  default     = ""
}

variable "backend_stickiness_enabled" {
  description = "Enable stickiness on backend target group"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
