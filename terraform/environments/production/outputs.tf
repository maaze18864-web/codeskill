output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer"
  value       = module.alb.alb_dns_name
}

output "frontend_target_group_arn" {
  description = "ARN of the frontend target group"
  value       = module.alb.frontend_target_group_arn
}

output "backend_target_group_arn" {
  description = "ARN of the backend target group"
  value       = module.alb.backend_target_group_arn
}

output "ecr_repositories" {
  description = "Amazon ECR repository URLs for each service tier"
  value       = module.ecr.repository_urls
}

output "service_discovery_endpoints" {
  description = "Internal Cloud Map private DNS endpoints for execution engines"
  value = {
    piston = module.service_discovery.piston_base_url
    judge0 = module.service_discovery.judge0_base_url
  }
}

output "asg_names" {
  description = "Names of the four independent Auto Scaling Groups"
  value = {
    frontend = module.frontend_asg.asg_name
    backend  = module.backend_asg.asg_name
    piston   = module.piston_asg.asg_name
    judge0   = module.judge0_asg.asg_name
  }
}

output "rds_endpoint" {
  description = "Endpoint of the private PostgreSQL RDS instance"
  value       = module.rds.endpoint
}

output "redis_endpoint" {
  description = "Configuration endpoint of the ElastiCache Redis cluster"
  value       = module.redis.endpoint
}

