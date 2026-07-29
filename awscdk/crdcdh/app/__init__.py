import aws_cdk as cdk
from aws_cdk import aws_iam as iam

from app.aspects import MyAspect
from app.stack import Stack


def build_stack(app, config, synthesizer=None):
    """Build the CRDC Data Hub stack for deployments and unit tests."""
    app.node.set_context("@aws-cdk/core:stackRelativeExports", "true")

    # Older CRDC Data Hub configs use resource_prefix where the shared
    # security tests expect the standard project setting.
    if not config.has_option("main", "project"):
        config.set("main", "project", config["main"]["resource_prefix"])

    stack_kwargs = {
        "stack_name": "{}-{}".format(
            config["main"]["resource_prefix"],
            config["main"]["tier"],
        ),
        "env": cdk.Environment(
            account=config["main"]["account_id"],
            region=config["main"]["region"],
        ),
    }
    if synthesizer is not None:
        stack_kwargs["synthesizer"] = synthesizer

    stack = Stack(app, **stack_kwargs)

    # Rename all roles to add the configured role prefix.
    cdk.Aspects.of(stack).add(MyAspect())

    # Apply the permission boundary to all roles when configured.
    if config.has_option("iam", "permission_boundary"):
        boundary = iam.ManagedPolicy.from_managed_policy_arn(
            stack,
            "Boundary",
            config["iam"]["permission_boundary"],
        )
        iam.PermissionsBoundary.of(stack).apply(boundary)

    config_tags = dict(
        setting.split(":") for setting in config["main"]["tags"].split(",")
    )
    tags = config_tags | {"Environment": config["main"]["tier"]}
    for tag, value in tags.items():
        cdk.Tags.of(stack).add(tag, value)

    return stack
