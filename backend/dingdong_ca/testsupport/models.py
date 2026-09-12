import uuid

from django.db import models


class TestFixture(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dataset = models.CharField(max_length=64)
    kind = models.CharField(max_length=32)
    subject_key = models.CharField(max_length=128)
    sequence = models.PositiveIntegerField(default=1)
    payload = models.JSONField()
    consumed_at = models.DateTimeField(null=True)

    class Meta:
        db_table = "test_fixture"
        constraints = [
            models.UniqueConstraint(
                fields=["dataset", "kind", "subject_key", "sequence"], name="fixture_natural_key"
            )
        ]
