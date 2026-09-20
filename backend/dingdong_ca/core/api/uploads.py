"""Bounded in-memory multipart parsing, with no TemporaryFileUploadHandler fallback."""

from io import BytesIO

from django.core.exceptions import RequestDataTooBig, TooManyFieldsSent, TooManyFilesSent
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.core.files.uploadhandler import FileUploadHandler
from rest_framework.parsers import MultiPartParser

from .common import ApiError

MAX_FILE = 1024 * 1024
MAX_TOTAL = 5 * MAX_FILE
SLOTS = [f"slot_{i}" for i in range(1, 6)]


class MemoryOnlyUploadHandler(FileUploadHandler):
    def __init__(self, request):
        super().__init__(request)
        self.total = 0
        self.seen = set()
        request._ca_upload_buffers = []

    def new_file(self, field_name, file_name, content_type, *args, **kwargs):
        if field_name not in SLOTS or field_name in self.seen:
            raise ApiError("INPUT_SLOTS_INVALID", 422, "文件槽位重复或不合法")
        self.seen.add(field_name)
        super().new_file(field_name, file_name, content_type, *args, **kwargs)
        self.file = BytesIO()
        self.request._ca_upload_buffers.append(self.file)

    def receive_data_chunk(self, raw_data, start):
        self.total += len(raw_data)
        if start + len(raw_data) > MAX_FILE or self.total > MAX_TOTAL:
            raise ApiError("INPUT_TOO_LARGE", 413, "输入超过大小限制")
        self.file.write(raw_data)
        return None

    def file_complete(self, file_size):
        self.file.seek(0)
        return InMemoryUploadedFile(
            self.file, self.field_name, "synthetic.png", self.content_type, file_size, self.charset
        )


class BoundedMultipartParser(MultiPartParser):
    def parse(self, stream, media_type=None, parser_context=None):
        request = parser_context["request"]
        raw = request._request
        try:
            length = int(raw.META.get("CONTENT_LENGTH") or 0)
        except ValueError:
            raise ApiError("INVALID_JSON", 400, "请求长度不合法") from None
        if length > MAX_TOTAL + 65536:
            raise ApiError("INPUT_TOO_LARGE", 413, "请求超过大小限制")
        raw.upload_handlers = [MemoryOnlyUploadHandler(raw)]
        try:
            return super().parse(stream, media_type, parser_context)
        except (RequestDataTooBig, TooManyFieldsSent, TooManyFilesSent):
            raise ApiError("INPUT_TOO_LARGE", 413, "输入超过限制") from None


def validate_synthetic_input(request):
    from dingdong_ca.testsupport.synthetic import synthetic_png

    from .common import validate
    from .inputs import SubmitInput

    data = request.data
    if set(request.FILES) != set(SLOTS) or set(data) != {"request_id", "revision", *SLOTS}:
        raise ApiError("INPUT_SLOTS_INVALID", 422, "必须提供五个指定槽位")
    if any(len(data.getlist(k)) != 1 for k in data):
        raise ApiError("INPUT_SLOTS_INVALID", 422, "不允许重复字段")
    fields = validate(SubmitInput, {"request_id": data["request_id"], "revision": data["revision"]})
    for i, slot in enumerate(SLOTS, 1):
        f = request.FILES[slot]
        if f.content_type != "image/png" or f.read(MAX_FILE + 1) != synthetic_png(i):
            raise ApiError("INPUT_SLOTS_INVALID", 422, "样例图片不符合要求，请重新提交")
    return fields
