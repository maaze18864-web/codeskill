output "namespace_id" {
  description = "Cloud Map namespace ID"
  value       = aws_service_discovery_private_dns_namespace.internal.id
}

output "namespace_arn" {
  description = "Cloud Map namespace ARN"
  value       = aws_service_discovery_private_dns_namespace.internal.arn
}

output "namespace_name" {
  description = "Cloud Map namespace name"
  value       = aws_service_discovery_private_dns_namespace.internal.name
}

output "piston_service_id" {
  description = "Piston Cloud Map Service ID"
  value       = aws_service_discovery_service.piston.id
}

output "piston_service_arn" {
  description = "Piston Cloud Map Service ARN"
  value       = aws_service_discovery_service.piston.arn
}

output "judge0_service_id" {
  description = "Judge0 Cloud Map Service ID"
  value       = aws_service_discovery_service.judge0.id
}

output "judge0_service_arn" {
  description = "Judge0 Cloud Map Service ARN"
  value       = aws_service_discovery_service.judge0.arn
}

output "piston_dns_name" {
  description = "Piston private DNS name"
  value       = "piston.${aws_service_discovery_private_dns_namespace.internal.name}"
}

output "judge0_dns_name" {
  description = "Judge0 private DNS name"
  value       = "judge0.${aws_service_discovery_private_dns_namespace.internal.name}"
}

output "piston_base_url" {
  description = "Base URL for Piston execution API"
  value       = "http://piston.${aws_service_discovery_private_dns_namespace.internal.name}:2001/api/v2"
}

output "judge0_base_url" {
  description = "Base URL for Judge0 submission API"
  value       = "http://judge0.${aws_service_discovery_private_dns_namespace.internal.name}:2358"
}

output "backend_service_id" {
  description = "Backend Cloud Map Service ID"
  value       = aws_service_discovery_service.backend.id
}

output "backend_dns_name" {
  description = "Backend private DNS name"
  value       = "backend.${aws_service_discovery_private_dns_namespace.internal.name}"
}

output "backend_base_url" {
  description = "Internal base URL for backend API"
  value       = "http://backend.${aws_service_discovery_private_dns_namespace.internal.name}:5001/api"
}
