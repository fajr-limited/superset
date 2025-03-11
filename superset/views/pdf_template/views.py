from flask_appbuilder import expose, has_access
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _

from superset import security_manager
from superset.constants import MODEL_VIEW_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.models.pdf_template import PdfTemplate
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.views.base import DeleteMixin, DeprecateModelViewMixin, SupersetModelView
from superset.views.pdf_template.mixin import PdfTemplateMixin

class PdfTemplateModelView(DeprecateModelViewMixin, PdfTemplateMixin, SupersetModelView, DeleteMixin):
    route_base = "/pdf_template"
    datamodel = SQLAInterface(PdfTemplate)
    include_route_methods = RouteMethod.CRUD_SET | {
        RouteMethod.DOWNLOAD,
        RouteMethod.API_READ,
        RouteMethod.API_DELETE,
    }
    class_permission_name = "PdfTemplate"
    method_permission_name = MODEL_VIEW_RW_METHOD_PERMISSION_MAP

    def pre_add(self, item: "PdfTemplateModelView") -> None:
        json.validate_json(item.params)

    def pre_update(self, item: "PdfTemplateModelView") -> None:
        json.validate_json(item.params)
        security_manager.raise_for_ownership(item)

    def pre_delete(self, item: "PdfTemplateModelView") -> None:
        security_manager.raise_for_ownership(item)

    @expose(
        "/add",
        methods=(
            "GET",
            "POST",
        ),
    )
    @has_access
    def add(self) -> FlaskResponse:
        return super().render_app_template()

    @expose("/list/")
    @has_access
    def list(self) -> FlaskResponse:
        return super().render_app_template()
    


class PdfTemplateAsync(PdfTemplateModelView):
    route_base = "/pdf_templateasync"
    include_route_methods = {RouteMethod.API_READ}
    
    list_columns = ["id", "name", "data", "description"]
    show_columns = ["id", "name", "data", "description"]
    add_columns = ["name","data", "description"]
    edit_columns = ["name","data", "description"]
