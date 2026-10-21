variable "name_prefix" { type = string }
variable "alb_arn" {
  type    = string
  default = ""
}
variable "scope" {
  description = "The scope of this Web ACL. Valid values are REGIONAL or CLOUDFRONT."
  type        = string
  default     = "REGIONAL"
}
