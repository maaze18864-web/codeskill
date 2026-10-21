terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_service_discovery_private_dns_namespace" "internal" {
  name        = var.namespace_name
  description = "Private Cloud Map DNS namespace for CodeSkill execution services"
  vpc         = var.vpc_id

  tags = merge(
    var.tags,
    {
      Name = var.namespace_name
    }
  )
}

resource "aws_service_discovery_service" "piston" {
  name = "piston"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.internal.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = merge(
    var.tags,
    {
      Name    = "piston-discovery-service"
      Service = "piston"
    }
  )
}

resource "aws_service_discovery_service" "judge0" {
  name = "judge0"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.internal.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = merge(
    var.tags,
    {
      Name    = "judge0-discovery-service"
      Service = "judge0"
    }
  )
}

resource "aws_service_discovery_service" "backend" {
  name = "backend"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.internal.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = merge(
    var.tags,
    {
      Name    = "backend-discovery-service"
      Service = "backend"
    }
  )
}
