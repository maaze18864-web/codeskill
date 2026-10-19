variable "aws_region" {
  description = "AWS deployment region"
  type        = string
  default     = "ap-south-1"
}

variable "domain_name" {
  description = "Production platform domain"
  type        = string
  default     = "codeskill.novaserve.cloud"
}

variable "certificate_arn" {
  description = "ACM Certificate ARN for HTTPS listener"
  type        = string
  default     = "arn:aws:acm:ap-south-1:239939507154:certificate/29148a30-541b-4859-82ee-a8f8eda07ed8"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "azs" {
  type    = list(string)
  default = ["ap-south-1a", "ap-south-1b"]
}

variable "public_subnets" {
  type    = list(string)
  default = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_app_subnets" {
  type    = list(string)
  default = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "private_db_subnets" {
  type    = list(string)
  default = ["10.0.20.0/24", "10.0.21.0/24"]
}

variable "ami_id" {
  description = "Base AMI ID for application launch templates"
  type        = string
  default     = "ami-03054015e26069645" # Amazon Linux 2023 in ap-south-1
}

variable "db_name" {
  type    = string
  default = "codeskill"
}

variable "db_username" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  type      = string
  default   = ""
  sensitive = true
}

variable "db_instance_class" {
  description = "RDS PostgreSQL instance class (x86_64 to match ap-south-1 availability zone capacity)"
  type        = string
  default     = "db.t3.medium"
}

# Image tags for immutable deployments
variable "frontend_image_tag" {
  description = "Docker image tag or immutable commit SHA for frontend container"
  type        = string
  default     = "v2.0.0"
}

variable "backend_image_tag" {
  description = "Docker image tag or immutable commit SHA for backend container"
  type        = string
  default     = "v2.0.0"
}

variable "piston_image_tag" {
  description = "Docker image tag for piston container"
  type        = string
  default     = "v2.0.0"
}

variable "judge0_image_tag" {
  description = "Docker image tag for judge0 container"
  type        = string
  default     = "v2.0.0"
}

# Sizing and Instance Types (Production capacity for 1,000 concurrent users)
variable "frontend_instance_type" {
  description = "EC2 instance type for Next.js frontend"
  type        = string
  default     = "t3.medium"
}

variable "backend_instance_type" {
  description = "EC2 instance type for NestJS backend"
  type        = string
  default     = "t3.medium"
}

variable "piston_instance_type" {
  description = "EC2 instance type for Piston execution engine (compute/RAM for concurrent sandbox runs)"
  type        = string
  default     = "t3.large"
}

variable "judge0_instance_type" {
  description = "EC2 instance type for Judge0 execution engine"
  type        = string
  default     = "t3.medium"
}

variable "backend_env_parameter_name" {
  description = "SSM SecureString containing backend dotenv configuration, including a unique JWT_SECRET"
  type        = string
  default     = "/codeskill-prod/production/backend_env"
}

# Scheduled Scaling for 2,000 Concurrent Examination Hours
variable "exam_scale_up_cron" {
  description = "Cron expression for pre-exam horizontal scaling (e.g., '30 3 * * 1-5' for 9 AM IST)"
  type        = string
  default     = ""
}

variable "exam_scale_down_cron" {
  description = "Cron expression for post-exam scale in"
  type        = string
  default     = ""
}

variable "pm2_io_parameter_name" {
  description = "SSM SecureString JSON containing PM2_SECRET_KEY and PM2_PUBLIC_KEY; empty disables PM2.io linking"
  type        = string
  default     = ""
}

variable "asg_instance_warmup" {
  description = "Instance warmup duration in seconds for Auto Scaling Group rolling refreshes"
  type        = number
  default     = 120
}
