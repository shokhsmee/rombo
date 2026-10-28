from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    """?page=1&size=25  ->  {"items": [...], "total": 120, "page": 1, "size": 25}"""

    page_size = 25
    page_size_query_param = "size"
    max_page_size = 200

    def get_paginated_response(self, data):
        return Response({
            "items": data,
            "total": self.page.paginator.count,
            "page": self.page.number,
            "size": self.get_page_size(self.request),
        })

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "properties": {
                "items": schema,
                "total": {"type": "integer"},
                "page": {"type": "integer"},
                "size": {"type": "integer"},
            },
        }
