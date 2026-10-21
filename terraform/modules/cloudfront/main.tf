terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

locals {
  has_s3_origin = var.enable_s3_origin && var.s3_bucket_regional_domain_name != ""
}

# -----------------------------------------------------------------------------
# 1. CloudFront Origin Access Control for S3 Media
# -----------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "s3_oac" {
  count                             = local.has_s3_origin ? 1 : 0
  name                              = "${var.name_prefix}-s3-oac"
  description                       = "OAC for ${var.name_prefix} files and avatars"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# -----------------------------------------------------------------------------
# 2. Primary CloudFront Edge Distribution
# -----------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "main" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "CodeSkill ${var.name_prefix} Edge Distribution"
  aliases         = var.cloudfront_certificate_arn != "" ? [var.domain_name] : []
  price_class     = var.price_class
  web_acl_id      = var.web_acl_arn != "" ? var.web_acl_arn : null

  # Origin 1: Application Load Balancer
  origin {
    domain_name = var.alb_dns_name
    origin_id   = "ALB-Origin"

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60
      origin_keepalive_timeout = 60
    }

    custom_header {
      name  = "X-Origin-Verify"
      value = var.origin_verify_secret
    }
  }

  # Origin 2: S3 Bucket for Media / Avatars (Conditional)
  dynamic "origin" {
    for_each = local.has_s3_origin ? [1] : []
    content {
      domain_name              = var.s3_bucket_regional_domain_name
      origin_id                = "S3-Origin"
      origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac[0].id
    }
  }

  # Behavior 1: Next.js Static Chunks (/_next/static/*) -> Long TTL Edge Caching
  ordered_cache_behavior {
    path_pattern           = "/_next/static/*"
    target_origin_id       = "ALB-Origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # AWS Managed CachingOptimized (TTL: 1 day to 1 year, gzip/brotli enabled)
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  # Behavior 2: Public Avatars (/avatars/*) -> Served Directly from S3 via OAC
  dynamic "ordered_cache_behavior" {
    for_each = local.has_s3_origin ? [1] : []
    content {
      path_pattern           = "/avatars/*"
      target_origin_id       = "S3-Origin"
      viewer_protocol_policy = "redirect-to-https"
      allowed_methods        = ["GET", "HEAD", "OPTIONS"]
      cached_methods         = ["GET", "HEAD"]
      compress               = true

      # AWS Managed CachingOptimized + CORS-S3Origin
      cache_policy_id          = "658327ea-f89d-4fab-a63d-7e88639e58f6"
      origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"
    }
  }

  # Behavior 3: Dynamic NestJS API (/api/*) -> No Cache, Forward All Request Headers
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "ALB-Origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # AWS Managed CachingDisabled
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    # AWS Managed AllViewerExceptHostHeader (preserves Authorization, Cookie, etc.)
    origin_request_policy_id = "b680b304-2454-46fb-9c6a-3ef310f60e9b"
  }

  # Behavior 4: Real-Time WebSockets (/socket.io/*) -> Pass-Through with Full Headers
  ordered_cache_behavior {
    path_pattern           = "/socket.io/*"
    target_origin_id       = "ALB-Origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = false

    # AWS Managed CachingDisabled
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    # AWS Managed AllViewer (preserves Upgrade, Connection, Sec-WebSocket-*, etc.)
    origin_request_policy_id = "216adef6-5c7f-47e4-b989-5492eafa07d3"
  }

  # Default Behavior: Next.js SSR Web Pages (Dynamic rendering per user request)
  default_cache_behavior {
    target_origin_id       = "ALB-Origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # Dynamic SSR: bypass shared edge cache to prevent cross-user session leakage
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id = "b680b304-2454-46fb-9c6a-3ef310f60e9b"
  }

  viewer_certificate {
    cloudfront_default_certificate = var.cloudfront_certificate_arn == "" ? true : null
    acm_certificate_arn            = var.cloudfront_certificate_arn != "" ? var.cloudfront_certificate_arn : null
    ssl_support_method             = var.cloudfront_certificate_arn != "" ? "sni-only" : null
    minimum_protocol_version       = var.cloudfront_certificate_arn != "" ? "TLSv1.2_2021" : null
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-cloudfront"
    }
  )
}
