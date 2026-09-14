"""运营后台表单：登录、账号、密码。错误信息一律用中文业务语言。"""

from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import AuthenticationForm, PasswordChangeForm
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from .permissions import ROLE_LABELS

ASSIGNABLE_ROLES = ["operations", "content", "technical", "account_admin"]


class OpsFormMixin:
    """把界面组件体系的表单类名统一注入到 Django 默认控件上。

    运营后台使用组件库的 form-control / form-select / form-check-input 样式，
    而 Django 默认渲染出来的控件没有任何类名。在这里集中注入，
    避免每个模板手写 class，也避免以后新增字段忘记加类名而出现"裸控件"。
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            widget = field.widget
            if isinstance(widget, (forms.CheckboxInput, forms.CheckboxSelectMultiple)):
                extra = "form-check-input"
            elif isinstance(widget, (forms.Select, forms.SelectMultiple)):
                extra = "form-select"
            else:
                extra = "form-control"
            classes = widget.attrs.get("class", "").split()
            if extra not in classes:
                widget.attrs["class"] = " ".join(classes + [extra])


class OpsLoginForm(OpsFormMixin, AuthenticationForm):
    """只允许工作人员登录；家长账号在运营后台不可用。"""

    username = forms.CharField(
        label="账号", widget=forms.TextInput(attrs={"autocomplete": "username"})
    )
    password = forms.CharField(
        label="密码",
        strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "current-password"}),
    )

    error_messages = {
        **AuthenticationForm.error_messages,
        "invalid_login": "账号或密码不正确，请重新输入。",
        "inactive": "该账号已停用，请联系管理员。",
    }

    def confirm_login_allowed(self, user):
        super().confirm_login_allowed(user)
        if not user.is_staff or getattr(user, "account_kind", None) != "staff":
            raise ValidationError("该账号不是运营后台账号，请使用家长端登录。", code="not_staff")


class StaffCreateForm(OpsFormMixin, forms.Form):
    username = forms.CharField(
        label="登录账号",
        max_length=150,
        help_text="用于登录，建议使用姓名拼音或工号，创建后不可修改。",
        widget=forms.TextInput(attrs={"autocomplete": "off", "placeholder": "例如 ops_zhangsan"}),
    )
    name = forms.CharField(
        label="姓名或称呼",
        max_length=255,
        help_text="显示在操作审计中的操作人。",
        widget=forms.TextInput(attrs={"autocomplete": "off"}),
    )
    password1 = forms.CharField(
        label="初始密码",
        strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
        help_text="至少 8 位，不能与账号过于相似。首次交付后请让本人自行修改。",
    )
    password2 = forms.CharField(
        label="确认初始密码",
        strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
    )
    roles = forms.MultipleChoiceField(
        label="角色",
        choices=[(code, ROLE_LABELS[code]) for code in ASSIGNABLE_ROLES],
        widget=forms.CheckboxSelectMultiple,
        help_text="角色决定可访问的菜单和可执行的操作，服务端会再次校验。",
    )

    def clean_username(self):
        username = self.cleaned_data["username"].strip()
        if get_user_model().objects.filter(username=username).exists():
            raise ValidationError("该登录账号已存在，请换一个。")
        return username

    def clean(self):
        data = super().clean()
        if data.get("password1") and data.get("password1") != data.get("password2"):
            self.add_error("password2", "两次输入的密码不一致。")
        if data.get("password1") and data.get("username"):
            try:
                validate_password(data["password1"])
            except ValidationError as exc:
                self.add_error("password1", exc)
        if not data.get("roles"):
            self.add_error("roles", "请至少选择一个角色。")
        return data

    def save(self):
        user = get_user_model().objects.create_user(
            username=self.cleaned_data["username"],
            password=self.cleaned_data["password1"],
            name=self.cleaned_data["name"].strip(),
            account_kind="staff",
            is_staff=True,
        )
        user.groups.set(Group.objects.filter(name__in=self.cleaned_data["roles"]))
        return user


class StaffPasswordResetForm(OpsFormMixin, forms.Form):
    password1 = forms.CharField(
        label="新密码",
        strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
    )
    password2 = forms.CharField(
        label="确认新密码",
        strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
    )

    def clean(self):
        data = super().clean()
        if data.get("password1") and data.get("password1") != data.get("password2"):
            self.add_error("password2", "两次输入的密码不一致。")
        if data.get("password1"):
            try:
                validate_password(data["password1"])
            except ValidationError as exc:
                self.add_error("password1", exc)
        return data


class OpsPasswordChangeForm(OpsFormMixin, PasswordChangeForm):
    """沿用 Django 的密码强度校验，只把提示语换成中文业务语言。"""

    error_messages = {
        **PasswordChangeForm.error_messages,
        "password_incorrect": "当前密码不正确，请重新输入。",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["old_password"].label = "当前密码"
        self.fields["new_password1"].label = "新密码"
        self.fields["new_password2"].label = "确认新密码"
