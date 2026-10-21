variable "domain_name" { type = string }
variable "alb_dns_name" {
  type    = string
  default = ""
}
variable "alb_zone_id" {
  type    = string
  default = ""
}
variable "target_dns_name" {
  description = "Target DNS name (CloudFront or ALB)"
  type        = string
  default     = ""
}
variable "target_zone_id" {
  description = "Target hosted zone ID (CloudFront Z2FDTNDATAQYW2 or ALB zone)"
  type        = string
  default     = ""
}
