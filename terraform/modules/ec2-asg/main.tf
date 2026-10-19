terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_launch_template" "this" {
  name_prefix   = "${var.asg_name}-lt-"
  image_id      = var.ami_id
  instance_type = var.instance_type

  vpc_security_group_ids = var.security_group_ids

  iam_instance_profile {
    name = var.iam_instance_profile_name != "" ? var.iam_instance_profile_name : null
    arn  = var.iam_instance_profile_arn != "" ? var.iam_instance_profile_arn : null
  }

  user_data = base64encode(var.user_data)

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = var.http_put_response_hop_limit
  }

  block_device_mappings {
    device_name = "/dev/xvda"

    ebs {
      volume_size           = var.root_volume_size
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags = merge(
      var.tags,
      {
        Name = "${var.asg_name}-instance"
        Tier = var.service_tier
      }
    )
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "this" {
  name                = var.asg_name
  vpc_zone_identifier = var.subnet_ids
  target_group_arns   = var.target_group_arns

  min_size         = var.min_size
  max_size         = var.max_size
  desired_capacity = var.desired_capacity

  health_check_type         = var.health_check_type
  health_check_grace_period = var.health_check_grace_period
  default_cooldown          = 120

  launch_template {
    id      = aws_launch_template.this.id
    version = aws_launch_template.this.latest_version
  }

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = var.min_healthy_percentage
      instance_warmup        = var.instance_warmup
      skip_matching          = true
      auto_rollback          = true
    }
    triggers = ["tag"]
  }

  termination_policies = ["OldestLaunchTemplate", "OldestInstance", "Default"]

  dynamic "tag" {
    for_each = merge(
      var.tags,
      {
        Name    = "${var.asg_name}-instance"
        Service = var.service_tier
      }
    )
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }

  lifecycle {
    create_before_destroy = true
    ignore_changes        = [load_balancers]
  }
}

# CPU Target Tracking Auto Scaling Policy
resource "aws_autoscaling_policy" "cpu" {
  count                  = var.enable_cpu_scaling ? 1 : 0
  name                   = "${var.asg_name}-cpu-target-tracking"
  policy_type            = "TargetTrackingScaling"
  autoscaling_group_name = aws_autoscaling_group.this.name

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value     = var.cpu_target_utilization
    disable_scale_in = false
  }
}

# Scheduled Scaling: Scale Up for Scheduled Exam Sessions
resource "aws_autoscaling_schedule" "scale_up_exam" {
  count                  = var.scheduled_exam_scale_up_cron != "" ? 1 : 0
  scheduled_action_name  = "${var.asg_name}-exam-scale-up"
  min_size               = var.exam_min_capacity
  max_size               = var.exam_max_capacity
  desired_capacity       = var.exam_desired_capacity
  recurrence             = var.scheduled_exam_scale_up_cron
  time_zone              = "Asia/Kolkata"
  autoscaling_group_name = aws_autoscaling_group.this.name
}

# Scheduled Scaling: Scale Down after Exam Sessions
resource "aws_autoscaling_schedule" "scale_down_post_exam" {
  count                  = var.scheduled_exam_scale_down_cron != "" ? 1 : 0
  scheduled_action_name  = "${var.asg_name}-exam-scale-down"
  min_size               = var.min_size
  max_size               = var.max_size
  desired_capacity       = var.desired_capacity
  recurrence             = var.scheduled_exam_scale_down_cron
  time_zone              = "Asia/Kolkata"
  autoscaling_group_name = aws_autoscaling_group.this.name
}
