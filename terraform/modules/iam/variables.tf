variable "name_prefix" {
  description = "Prefix for IAM resource names"
  type        = string
  default     = "codeskill"
}

variable "s3_bucket_arn" {
  description = "ARN of S3 bucket for CodeSkill storage (optional)"
  type        = string
  default     = ""
}

variable "enable_s3" {
  description = "Enable S3 access policies and role attachments"
  type        = bool
  default     = false
}

variable "secrets_arn_prefix" {
  description = "ARN prefix for Secrets Manager secrets accessible by application"
  type        = string
  default     = ""
}

variable "db_secret_arn" {
  description = "ARN of the RDS database secret in AWS Secrets Manager"
  type        = string
  default     = ""
}

variable "ssm_parameter_arns" {
  description = "List of specific SSM parameter ARNs accessible by backend application instances"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}

variable "pm2_io_parameter_name" {
  description = "Optional SSM parameter path for frontend PM2.io monitoring"
  type        = string
  default     = ""
}
