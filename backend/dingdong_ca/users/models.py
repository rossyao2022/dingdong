"""Cookiecutter Django custom AbstractUser, extended before first migration."""

import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, blank=True)
    first_name = None
    last_name = None
    account_kind = models.CharField(max_length=16, default="staff")
    phone = models.CharField(max_length=16, null=True, blank=True)

    class Meta:
        db_table = "app_user"
        constraints = [
            models.CheckConstraint(
                condition=Q(account_kind__in=["parent", "staff"]), name="user_kind_valid"
            ),
            models.CheckConstraint(
                condition=Q(account_kind="staff")
                | (Q(phone__isnull=False, is_staff=False, is_superuser=False) & ~Q(phone="")),
                name="parent_requires_phone_no_staff",
            ),
            models.CheckConstraint(
                condition=Q(is_superuser=False) | Q(is_staff=True), name="superuser_is_staff"
            ),
            models.UniqueConstraint(
                fields=["phone"], condition=Q(account_kind="parent"), name="parent_phone_unique"
            ),
        ]
