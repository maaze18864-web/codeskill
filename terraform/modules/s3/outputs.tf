output "bucket_id" {
  value = aws_s3_bucket.main.id
}

output "bucket_name" {
  value = aws_s3_bucket.main.id
}

output "bucket_arn" {
  value = aws_s3_bucket.main.arn
}

output "bucket_regional_domain_name" {
  description = "Regional domain name of the S3 bucket for CloudFront origin"
  value       = aws_s3_bucket.main.bucket_regional_domain_name
}
