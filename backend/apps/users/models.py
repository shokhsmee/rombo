from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Login account. Roles decide page access (see apps.access); is_superuser bypasses them."""

    TRACK = {
        "username": "Login", "first_name": "Ism", "last_name": "Familiya", "email": "Email", "phone": "Telefon",
        "is_active": "Faol", "is_superuser": "Superuser",
    }
    CHATTER_NAME = "Foydalanuvchi"

    phone = models.CharField("Telefon", max_length=32, blank=True, default="")
    roles = models.ManyToManyField("access.Role", related_name="users", blank=True)
    # Bumped on block / password change: every token carrying an older value is rejected.
    token_version = models.PositiveIntegerField(default=0, editable=False)

    class Meta:
        ordering = ["first_name", "last_name", "username"]
        verbose_name = "Foydalanuvchi"
        verbose_name_plural = "Foydalanuvchilar"

    @property
    def full_name(self) -> str:
        return self.get_full_name() or self.username

    def revoke_tokens(self) -> None:
        self.token_version += 1
