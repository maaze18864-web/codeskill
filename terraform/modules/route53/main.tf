terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

locals {
  alias_name    = var.target_dns_name != "" ? var.target_dns_name : var.alb_dns_name
  alias_zone_id = var.target_zone_id != "" ? var.target_zone_id : var.alb_zone_id
}

data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = local.alias_name
    zone_id                = local.alias_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "app_ipv6" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = local.alias_name
    zone_id                = local.alias_zone_id
    evaluate_target_health = true
  }
}
