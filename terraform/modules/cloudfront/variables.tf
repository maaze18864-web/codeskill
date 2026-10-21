variable "name_prefix" {
  description = "Prefix to apply to all resource names"
  type        = string
}

variable "domain_name" {
  description = "The primary domain name (CNAME alias) for the CloudFront distribution"
  type        = string
}

variable "alb_dns_name" {
  description = "DNS name of the primary Application Load Balancer"
  type        = string
}

variable "s3_bucket_regional_domain_name" {
  description = "Regional domain name of the S3 media bucket"
  type        = string
  default     = ""
}

variable "cloudfront_certificate_arn" {
  description = "ACM Certificate ARN in us-east-1 for CloudFront (leave empty for default *.cloudfront.net certificate)"
  type        = string
  default     = ""
}

variable "origin_verify_secret" {
  description = "Secret token injected as X-Origin-Verify header to ALB to prevent direct bypass"
  type        = string
  sensitive   = true
}

variable "web_acl_arn" {
  description = "Optional AWS WAFv2 Web ACL ARN (scope CLOUDFRONT in us-east-1)"
  type        = string
  default     = ""
}

variable "price_class" {
  description = "CloudFront price class (PriceClass_200 includes India, US, Europe, Asia, Middle East)"
  type        = string
  default     = "PriceClass_200"
}

variable "enable_s3_origin" {
  description = "Whether to attach S3 origin for /avatars/* media delivery via OAC"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags to attach to resources"
  type        = map(string)
  default     = {}
}
