"""Exercise role naming against real synthesized CDK resources."""

import importlib.util
from pathlib import Path

import aws_cdk as cdk
from aws_cdk import aws_iam as iam, aws_s3 as s3
from aws_cdk.assertions import Template
import pytest


# Load the aspect independently of the deployment stack and its environment.
spec = importlib.util.spec_from_file_location(
    "role_aspects", Path(__file__).parents[2] / "app" / "aspects.py"
)
aspects = importlib.util.module_from_spec(spec)
spec.loader.exec_module(aspects)


@pytest.mark.parametrize("prefix", ["power-user", "long-prefix-" * 3, None])
def test_role_names_include_s3_auto_delete_provider(tmp_path, monkeypatch, prefix):
    monkeypatch.chdir(tmp_path)
    config = "[main]\ntier = dev-cdk\n[iam]\n"
    if prefix is not None:
        config += f"role_prefix = {prefix}\n"
    (tmp_path / "config.ini").write_text(config)
    app = cdk.App(outdir=str(tmp_path / "cdk.out"))
    stack = cdk.Stack(app, "TestStack")
    iam.Role(stack, "ApplicationRole", assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"))
    s3.Bucket(
        stack, "Bucket", auto_delete_objects=True,
        removal_policy=cdk.RemovalPolicy.DESTROY,
    )
    cdk.Aspects.of(stack).add(aspects.MyAspect())

    roles = Template.from_stack(stack).find_resources("AWS::IAM::Role")
    assert len(roles) == 2
    assert any("S3AutoDeleteObjects" in logical_id for logical_id in roles)
    for logical_id, role in roles.items():
        name = role["Properties"].get("RoleName")
        if prefix is None:
            assert name is None
        else:
            assert name == f"{prefix}-dev-cdk-{logical_id}"[:64]
