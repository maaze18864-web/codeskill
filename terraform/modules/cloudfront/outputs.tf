output "distribution_id" {
  description = "The identifier for the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.id
}

output "distribution_arn" {
  description = "The ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.main.arn
}

output "distribution_domain_name" {
  description = "The domain name corresponding to the distribution (e.g. d604721fxaaqy9.cloudfront.net)"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "distribution_hosted_zone_id" {
  description = "The CloudFront Route 53 zone ID (always Z2FDTNDATAQYW2)"
  value       = aws_cloudfront_distribution.main.hosted_zone_id
}

output "s3_oac_id" {
  description = "The ID of the Origin Access Control for S3"
  value       = length(aws_cloudfront_origin_access_control.s3_oac) > 0 ? aws_cloudfront_origin_access_control.s3_oac[0].id : null
}
