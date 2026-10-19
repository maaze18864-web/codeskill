variable "asg_name" {
  description = "Name of the Auto Scaling Group"
  type        = string
}

variable "service_tier" {
  description = "Service tier name (frontend, backend, piston, judge0)"
  type        = string
}

variable "ami_id" {
  description = "AMI ID for the Launch Template"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3a.small"
}

variable "http_put_response_hop_limit" {
  description = "Desired HTTP PUT response hop limit for IMDSv2 (1 restricts metadata token retrieval to host only, blocking container hop)"
  type        = number
  default     = 1
}

variable "security_group_ids" {
  description = "List of security group IDs"
  type        = list(string)
}

variable "subnet_ids" {
  description = "List of subnet IDs where instances can be launched"
  type        = list(string)
}

variable "target_group_arns" {
  description = "List of ALB target group ARNs to register with"
  type        = list(string)
  default     = []
}

variable "iam_instance_profile_name" {
  description = "IAM instance profile name"
  type        = string
  default     = ""
}

variable "iam_instance_profile_arn" {
  description = "IAM instance profile ARN"
  type        = string
  default     = ""
}

variable "user_data" {
  description = "User data script to bootstrap the instance"
  type        = string
  default     = "#!/bin/bash\nexit 0"
}

variable "root_volume_size" {
  description = "Root EBS volume size in GB"
  type        = number
  default     = 30
}

variable "min_size" {
  description = "Minimum ASG size"
  type        = number
  default     = 1
}

variable "max_size" {
  description = "Maximum ASG size"
  type        = number
  default     = 2
}

variable "desired_capacity" {
  description = "Desired ASG capacity"
  type        = number
  default     = 1
}

variable "health_check_type" {
  description = "Health check type (ELB or EC2)"
  type        = string
  default     = "EC2"
}

variable "health_check_grace_period" {
  description = "Health check grace period in seconds"
  type        = number
  default     = 180
}

variable "min_healthy_percentage" {
  description = "Minimum percentage of healthy instances during rolling refresh"
  type        = number
  default     = 50
}

variable "instance_warmup" {
  description = "Instance warmup time in seconds for rolling refresh"
  type        = number
  default     = 180
}

variable "enable_cpu_scaling" {
  description = "Whether to attach a target tracking CPU auto-scaling policy"
  type        = bool
  default     = true
}

variable "cpu_target_utilization" {
  description = "Target average CPU percentage"
  type        = number
  default     = 70.0
}

variable "scheduled_exam_scale_up_cron" {
  description = "Cron expression for pre-exam scale up (e.g., '0 8 * * 1-5' for 8 AM UTC)"
  type        = string
  default     = ""
}

variable "scheduled_exam_scale_down_cron" {
  description = "Cron expression for post-exam scale down"
  type        = string
  default     = ""
}

variable "exam_min_capacity" {
  description = "Minimum capacity during exam sessions"
  type        = number
  default     = 2
}

variable "exam_desired_capacity" {
  description = "Desired capacity during exam sessions"
  type        = number
  default     = 2
}

variable "exam_max_capacity" {
  description = "Maximum capacity during exam sessions"
  type        = number
  default     = 4
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}
