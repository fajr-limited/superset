# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
# pylint: disable=too-many-lines
import logging
from datetime import datetime
from io import BytesIO
from typing import Any, cast, Optional
from zipfile import is_zipfile, ZipFile

from flask import redirect, request, Response, send_file, url_for
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.hooks import before_request
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import ngettext
from marshmallow import ValidationError
from werkzeug.wrappers import Response as WerkzeugResponse
from werkzeug.wsgi import FileWrapper

from superset import app, is_feature_enabled, thumbnail_cache
from superset.pdf_templates.filters import (
    PdfTemplateAllTextFilter,
    PdfTemplateCreatedByMeFilter,
    PdfTemplateFavoriteFilter,
    PdfTemplateFilter,
    PdfTemplateHasCreatedByFilter,
    PdfTemplateOwnedCreatedFavoredByMeFilter,
    PdfTemplateTagIdFilter,
    PdfTemplateTagNameFilter,
)
from superset.pdf_templates.schemas import (
    CHART_SCHEMAS,
    PdfTemplateCacheWarmUpRequestSchema,
    PdfTemplatePostSchema,
    PdfTemplatePutSchema,
    get_delete_ids_schema,
    get_export_ids_schema,
    get_fav_star_ids_schema,
    openapi_spec_methods_override,
    screenshot_query_schema,
    thumbnail_query_schema,
)
from superset.commands.pdf_template.create import CreatePdfTemplateCommand
from superset.commands.pdf_template.delete import DeletePdfTemplateCommand
from superset.commands.pdf_template.exceptions import (
    PdfTemplateCreateFailedError,
    PdfTemplateDeleteFailedError,
    PdfTemplateForbiddenError,
    PdfTemplateInvalidError,
    PdfTemplateNotFoundError,
    PdfTemplateUpdateFailedError,
)
from superset.commands.pdf_template.export import ExportPdfTemplatesCommand
from superset.commands.pdf_template.fave import AddFavoritePdfTemplateCommand
from superset.commands.pdf_template.unfave import DelFavoritePdfTemplateCommand
from superset.commands.pdf_template.update import UpdatePdfTemplateCommand
from superset.commands.pdf_template.warm_up_cache import PdfTemplateWarmUpCacheCommand
from superset.commands.exceptions import CommandException, TagForbiddenError
from superset.commands.importers.exceptions import (
    IncorrectFormatError,
    NoValidFilesFoundError,
)
from superset.commands.importers.v1.utils import get_contents_from_bundle
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP, RouteMethod
from superset.daos.pdf_template import PdfTemplateDAO
from superset.extensions import event_logger
from superset.models.pdf_template import PdfTemplate
from superset.tasks.thumbnails import cache_pdf_template_thumbnail
from superset.tasks.utils import get_current_user
from superset.utils import json
from superset.utils.screenshots import PdfTemplateScreenshot, DEFAULT_CHART_WINDOW_SIZE
from superset.utils.urls import get_url_path
from superset.views.base_api import (
    BaseSupersetModelRestApi,
    RelatedFieldFilter,
    requires_form_data,
    requires_json,
    statsd_metrics,
)
from superset.views.filters import BaseFilterRelatedUsers, FilterRelatedOwners

logger = logging.getLogger(__name__)
config = app.config


class PdfTemplateRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(PdfTemplate)

    resource_name = "pdf_template"
    allow_browser_login = True

    @before_request(only=["thumbnail", "screenshot", "cache_screenshot"])
    def ensure_thumbnails_enabled(self) -> Optional[Response]:
        if not is_feature_enabled("THUMBNAILS"):
            return self.response_404()
        return None

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {
        RouteMethod.EXPORT,
        RouteMethod.IMPORT,
        RouteMethod.RELATED,
        "bulk_delete",  # not using RouteMethod since locally defined
        "favorite_status",
        "add_favorite",
        "remove_favorite",
        "thumbnail",
        "screenshot",
        "cache_screenshot",
        "warm_up_cache",
    }
    class_permission_name = "PdfTemplate"
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    show_columns = [
        # "changed_on_delta_humanized",
        "description",
        "id",
        "data",
        "owners.first_name",
        "owners.id",
        "owners.last_name",
        "name",
        "tags.id",
        "tags.name",
        "tags.type",
    ]

    show_select_columns = show_columns
    list_columns = [
        "changed_by.first_name",
        "changed_by.last_name",
        "changed_by.id",
        "changed_by_name",
        "changed_on_delta_humanized",
        "changed_on_dttm",
        "changed_on_utc",
        "created_by.first_name",
        "created_by.id",
        "created_by.last_name",
        "created_by_name",
        "description",
        "id",
        "owners.first_name",
        "owners.id",
        "owners.last_name",
        "name",
        "tags.id",
        "tags.name",
        "tags.type",
        "data",
    ]
    list_select_columns = list_columns + ["changed_by_fk", "changed_on"]
    order_columns = [
        "changed_by.first_name",
        "changed_on_delta_humanized",
        "name",
    ]
    search_columns = [
        "created_by",
        "changed_by",
        # "last_saved_at",
        # "last_saved_by",
        "description",
        "id",
        "owners",
        "tags",
        "name",
    ]
    base_order = ("changed_on", "desc")
    base_filters = [["id", PdfTemplateFilter, lambda: []]]
    search_filters = {
        "id": [
            PdfTemplateFavoriteFilter,
            PdfTemplateOwnedCreatedFavoredByMeFilter,
        ],
        "name": [PdfTemplateAllTextFilter],
        "created_by": [PdfTemplateHasCreatedByFilter, PdfTemplateCreatedByMeFilter],
        "tags": [PdfTemplateTagNameFilter, PdfTemplateTagIdFilter],
    }
    # Will just affect _info endpoint
    edit_columns = ["name"]
    add_columns = edit_columns

    add_model_schema = PdfTemplatePostSchema()
    edit_model_schema = PdfTemplatePutSchema()

    openapi_spec_tag = "PdfTemplates"
    """ Override the name set for this collection of endpoints """
    openapi_spec_component_schemas = CHART_SCHEMAS

    apispec_parameter_schemas = {
        "screenshot_query_schema": screenshot_query_schema,
        "get_delete_ids_schema": get_delete_ids_schema,
        "get_export_ids_schema": get_export_ids_schema,
        "get_fav_star_ids_schema": get_fav_star_ids_schema,
    }
    """ Add extra schemas to the OpenAPI components schema section """
    openapi_spec_methods = openapi_spec_methods_override
    """ Overrides GET methods OpenApi descriptions """

    order_rel_fields = {
        "slices": ("name", "asc"),
        "owners": ("first_name", "asc"),
    }
    base_related_field_filters = {
        "owners": [["id", BaseFilterRelatedUsers, lambda: []]],
        "created_by": [["id", BaseFilterRelatedUsers, lambda: []]],
        "changed_by": [["id", BaseFilterRelatedUsers, lambda: []]],
    }
    related_field_filters = {
        "owners": RelatedFieldFilter("first_name", FilterRelatedOwners),
        "created_by": RelatedFieldFilter("first_name", FilterRelatedOwners),
        "changed_by": RelatedFieldFilter("first_name", FilterRelatedOwners),
    }

    allowed_rel_fields = {"owners", "created_by", "changed_by"}

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    @requires_json
    def post(self) -> Response:
        """Create a new pdf_template.
        ---
        post:
          summary: Create a new pdf_template
          requestBody:
            description: PdfTemplate schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: PdfTemplate added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            new_model = CreatePdfTemplateCommand(item).run()
            return self.response(201, id=new_model.id, result=item)
        except PdfTemplateInvalidError as ex:
            return self.response_422(message=ex.normalized_messages())
        except PdfTemplateCreateFailedError as ex:
            logger.error(
                "Error creating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/<pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @requires_json
    def put(self, pk: int) -> Response:
        """Update a pdf_template.
        ---
        put:
          summary: Update a pdf_template
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: PdfTemplate schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: PdfTemplate changed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: number
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.edit_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            changed_model = UpdatePdfTemplateCommand(pk, item).run()
            response = self.response(200, id=changed_model.id, result=item)
        except PdfTemplateNotFoundError:
            response = self.response_404()
        except PdfTemplateForbiddenError:
            response = self.response_403()
        except TagForbiddenError as ex:
            response = self.response(403, message=str(ex))
        except PdfTemplateInvalidError as ex:
            response = self.response_422(message=ex.normalized_messages())
        except PdfTemplateUpdateFailedError as ex:
            logger.error(
                "Error updating model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            response = self.response_422(message=str(ex))

        return response

    @expose("/<pk>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, pk: int) -> Response:
        """Delete a pdf_template.
        ---
        delete:
          summary: Delete a pdf_template
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: PdfTemplate delete
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            DeletePdfTemplateCommand([pk]).run()
            return self.response(200, message="OK")
        except PdfTemplateNotFoundError:
            return self.response_404()
        except PdfTemplateForbiddenError:
            return self.response_403()
        except PdfTemplateDeleteFailedError as ex:
            logger.error(
                "Error deleting model %s: %s",
                self.__class__.__name__,
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))

    @expose("/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_delete_ids_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.bulk_delete",
        log_to_statsd=False,
    )
    def bulk_delete(self, **kwargs: Any) -> Response:
        """Bulk delete pdf_templates.
        ---
        delete:
          summary: Bulk delete pdf_templates
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_delete_ids_schema'
          responses:
            200:
              description: PdfTemplates bulk delete
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        item_ids = kwargs["rison"]
        try:
            DeletePdfTemplateCommand(item_ids).run()
            return self.response(
                200,
                message=ngettext(
                    "Deleted %(num)d pdf_template", "Deleted %(num)d pdf_templates", num=len(item_ids)
                ),
            )
        except PdfTemplateNotFoundError:
            return self.response_404()
        except PdfTemplateForbiddenError:
            return self.response_403()
        except PdfTemplateDeleteFailedError as ex:
            return self.response_422(message=str(ex))

    @expose("/<pk>/cache_screenshot/", methods=("GET",))
    @protect()
    @rison(screenshot_query_schema)
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".cache_screenshot",
        log_to_statsd=False,
    )
    def cache_screenshot(self, pk: int, **kwargs: Any) -> WerkzeugResponse:
        """Compute and cache a screenshot.
        ---
        get:
          summary: Compute and cache a screenshot
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/screenshot_query_schema'
          responses:
            202:
              description: PdfTemplate async result
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/PdfTemplateCacheScreenshotResponseSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        rison_dict = kwargs["rison"]
        window_size = rison_dict.get("window_size") or DEFAULT_CHART_WINDOW_SIZE

        # Don't shrink the image if thumb_size is not specified
        thumb_size = rison_dict.get("thumb_size") or window_size

        pdf_template = cast(PdfTemplate, self.datamodel.get(pk, self._base_filters))
        if not pdf_template:
            return self.response_404()

        pdf_template_url = get_url_path("Superset.slice", slice_id=pdf_template.id)
        screenshot_obj = PdfTemplateScreenshot(pdf_template_url, pdf_template.digest)
        cache_key = screenshot_obj.cache_key(window_size, thumb_size)
        image_url = get_url_path(
            "PdfTemplateRestApi.screenshot", pk=pdf_template.id, digest=cache_key
        )

        def trigger_celery() -> WerkzeugResponse:
            logger.info("Triggering screenshot ASYNC")
            cache_pdf_template_thumbnail.delay(
                current_user=get_current_user(),
                pdf_template_id=pdf_template.id,
                force=True,
                window_size=window_size,
                thumb_size=thumb_size,
            )
            return self.response(
                202, cache_key=cache_key, pdf_template_url=pdf_template_url, image_url=image_url
            )

        return trigger_celery()

    @expose("/<pk>/screenshot/<digest>/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.screenshot",
        log_to_statsd=False,
    )
    def screenshot(self, pk: int, digest: str) -> WerkzeugResponse:
        """Get a computed screenshot from cache.
        ---
        get:
          summary: Get a computed screenshot from cache
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: path
            schema:
              type: string
            name: digest
          responses:
            200:
              description: PdfTemplate thumbnail image
              content:
               image/*:
                 schema:
                   type: string
                   format: binary
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        pdf_template = self.datamodel.get(pk, self._base_filters)

        # Making sure the pdf_template still exists
        if not pdf_template:
            return self.response_404()

        # fetch the pdf_template screenshot using the current user and cache if set
        if img := PdfTemplateScreenshot.get_from_cache_key(thumbnail_cache, digest):
            return Response(
                FileWrapper(img), mimetype="image/png", direct_passthrough=True
            )
        # TODO: return an empty image
        return self.response_404()

    @expose("/<pk>/thumbnail/<digest>/", methods=("GET",))
    @protect()
    @rison(thumbnail_query_schema)
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.thumbnail",
        log_to_statsd=False,
    )
    def thumbnail(self, pk: int, digest: str, **kwargs: Any) -> WerkzeugResponse:
        """Compute or get already computed pdf_template thumbnail from cache.
        ---
        get:
          summary: Get pdf_template thumbnail
          description: Compute or get already computed pdf_template thumbnail from cache.
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: path
            schema:
              type: string
            name: digest
          responses:
            200:
              description: PdfTemplate thumbnail image
              content:
               image/*:
                 schema:
                   type: string
                   format: binary
            302:
              description: Redirects to the current digest
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        pdf_template = cast(PdfTemplate, self.datamodel.get(pk, self._base_filters))
        if not pdf_template:
            return self.response_404()

        current_user = get_current_user()
        url = get_url_path("Superset.pdf_template", id=pdf_template.id)
        if kwargs["rison"].get("force", False):
            logger.info(
                "Triggering thumbnail compute (pdf_template id: %s) ASYNC", str(pdf_template.id)
            )
            cache_pdf_template_thumbnail.delay(
                current_user=current_user,
                pdf_template_id=pdf_template.id,
                force=True,
            )
            return self.response(202, message="OK Async")
        # fetch the pdf_template screenshot using the current user and cache if set
        screenshot = PdfTemplateScreenshot(url, pdf_template.digest).get_from_cache(
            cache=thumbnail_cache
        )
        # If not screenshot then send request to compute thumb to celery
        if not screenshot:
            self.incr_stats("async", self.thumbnail.__name__)
            logger.info(
                "Triggering thumbnail compute (pdf_template id: %s) ASYNC", str(pdf_template.id)
            )
            cache_pdf_template_thumbnail.delay(
                current_user=current_user,
                pdf_template_id=pdf_template.id,
                force=True,
            )
            return self.response(202, message="OK Async")
        # If digests
        if pdf_template.digest != digest:
            self.incr_stats("redirect", self.thumbnail.__name__)
            return redirect(
                url_for(
                    f"{self.__class__.__name__}.thumbnail", pk=pk, digest=pdf_template.digest
                )
            )
        self.incr_stats("from_cache", self.thumbnail.__name__)
        return Response(
            FileWrapper(screenshot), mimetype="image/png", direct_passthrough=True
        )

    @expose("/export/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_export_ids_schema)
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.export",
        log_to_statsd=False,
    )
    def export(self, **kwargs: Any) -> Response:
        """Download multiple pdf_templates as YAML files.
        ---
        get:
          summary: Download multiple pdf_templates as YAML files
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_export_ids_schema'
          responses:
            200:
              description: A zip file with pdf_template(s), dataset(s) and database(s) as YAML
              content:
                application/zip:
                  schema:
                    type: string
                    format: binary
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        requested_ids = kwargs["rison"]
        timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
        root = f"pdf_template_export_{timestamp}"
        filename = f"{root}.zip"

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            try:
                for file_name, file_content in ExportPdfTemplatesCommand(requested_ids).run():
                    with bundle.open(f"{root}/{file_name}", "w") as fp:
                        fp.write(file_content().encode())
            except PdfTemplateNotFoundError:
                return self.response_404()
        buf.seek(0)

        response = send_file(
            buf,
            mimetype="application/zip",
            as_attachment=True,
            download_name=filename,
        )
        if token := request.args.get("token"):
            response.set_cookie(token, "done", max_age=600)
        return response

    @expose("/favorite_status/", methods=("GET",))
    @protect()
    @safe
    @rison(get_fav_star_ids_schema)
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".favorite_status",
        log_to_statsd=False,
    )
    def favorite_status(self, **kwargs: Any) -> Response:
        """Check favorited pdf_templates for current user.
        ---
        get:
          summary: Check favorited pdf_templates for current user
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_fav_star_ids_schema'
          responses:
            200:
              description:
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/GetFavStarIdsSchema"
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        requested_ids = kwargs["rison"]
        pdf_templates = PdfTemplateDAO.find_by_ids(requested_ids)
        if not pdf_templates:
            return self.response_404()
        favorited_pdf_template_ids = PdfTemplateDAO.favorited_ids(pdf_templates)
        res = [
            {"id": request_id, "value": request_id in favorited_pdf_template_ids}
            for request_id in requested_ids
        ]
        return self.response(200, result=res)

    @expose("/<pk>/favorites/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".add_favorite",
        log_to_statsd=False,
    )
    def add_favorite(self, pk: int) -> Response:
        """Mark the pdf_template as favorite for the current user.
        ---
        post:
          summary: Mark the pdf_template as favorite for the current user
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: PdfTemplate added to favorites
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            AddFavoritePdfTemplateCommand(pk).run()
        except PdfTemplateNotFoundError:
            return self.response_404()
        except PdfTemplateForbiddenError:
            return self.response_403()

        return self.response(200, result="OK")

    @expose("/<pk>/favorites/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".remove_favorite",
        log_to_statsd=False,
    )
    def remove_favorite(self, pk: int) -> Response:
        """Remove the pdf_template from the user favorite list.
        ---
        delete:
          summary: Remove the pdf_template from the user favorite list
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: PdfTemplate removed from favorites
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            DelFavoritePdfTemplateCommand(pk).run()
        except PdfTemplateNotFoundError:
            self.response_404()
        except PdfTemplateForbiddenError:
            self.response_403()

        return self.response(200, result="OK")

    @expose("/warm_up_cache", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        f".warm_up_cache",
        log_to_statsd=False,
    )
    def warm_up_cache(self) -> Response:
        """Warm up the cache for the pdf_template.
        ---
        put:
          summary: Warm up the cache for the pdf_template
          description: >-
            Warms up the cache for the pdf_template.
            Note for slices a force refresh occurs.
            In terms of the `extra_filters` these can be obtained from records in the JSON
            encoded `logs.json` column associated with the `explore_json` action.
          requestBody:
            description: >-
              Identifies the pdf_template to warm up cache for, and any additional dashboard or
              filter context to use.
            required: true
            content:
              application/json:
                schema:
                  $ref: "#/components/schemas/PdfTemplateCacheWarmUpRequestSchema"
          responses:
            200:
              description: Each pdf_template's warmup status
              content:
                application/json:
                  schema:
                    $ref: "#/components/schemas/PdfTemplateCacheWarmUpResponseSchema"
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """  # noqa: E501
        try:
            body = PdfTemplateCacheWarmUpRequestSchema().load(request.json)
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            result = PdfTemplateWarmUpCacheCommand(
                body["pdf_template_id"],
                body.get("dashboard_id"),
                body.get("extra_filters"),
            ).run()
            return self.response(200, result=[result])
        except CommandException as ex:
            return self.response(ex.status, message=ex.message)

    @expose("/import/", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.import_",
        log_to_statsd=False,
    )
    @requires_form_data
    def import_(self) -> Response:
        """Import pdf_template(s) with associated datasets and databases.
        ---
        post:
          summary: Import pdf_template(s) with associated datasets and databases
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  type: object
                  properties:
                    formData:
                      description: upload file (ZIP)
                      type: string
                      format: binary
                    passwords:
                      description: >-
                        JSON map of passwords for each featured database in the
                        ZIP file. If the ZIP includes a database config in the path
                        `databases/MyDatabase.yaml`, the password should be provided
                        in the following format:
                        `{"databases/MyDatabase.yaml": "my_password"}`.
                      type: string
                    overwrite:
                      description: overwrite existing pdf_templates?
                      type: boolean
                    ssh_tunnel_passwords:
                      description: >-
                        JSON map of passwords for each ssh_tunnel associated to a
                        featured database in the ZIP file. If the ZIP includes a
                        ssh_tunnel config in the path `databases/MyDatabase.yaml`,
                        the password should be provided in the following format:
                        `{"databases/MyDatabase.yaml": "my_password"}`.
                      type: string
                    ssh_tunnel_private_keys:
                      description: >-
                        JSON map of private_keys for each ssh_tunnel associated to a
                        featured database in the ZIP file. If the ZIP includes a
                        ssh_tunnel config in the path `databases/MyDatabase.yaml`,
                        the private_key should be provided in the following format:
                        `{"databases/MyDatabase.yaml": "my_private_key"}`.
                      type: string
                    ssh_tunnel_private_key_passwords:
                      description: >-
                        JSON map of private_key_passwords for each ssh_tunnel associated
                        to a featured database in the ZIP file. If the ZIP includes a
                        ssh_tunnel config in the path `databases/MyDatabase.yaml`,
                        the private_key should be provided in the following format:
                        `{"databases/MyDatabase.yaml": "my_private_key_password"}`.
                      type: string
          responses:
            200:
              description: PdfTemplate import result
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        upload = request.files.get("formData")
        if not upload:
            return self.response_400()
        if not is_zipfile(upload):
            raise IncorrectFormatError("Not a ZIP file")
        with ZipFile(upload) as bundle:
            contents = get_contents_from_bundle(bundle)

        if not contents:
            raise NoValidFilesFoundError()

        # passwords = (
        #     json.loads(request.form["passwords"])
        #     if "passwords" in request.form
        #     else None
        # )
        # overwrite = request.form.get("overwrite") == "true"
        # ssh_tunnel_passwords = (
        #     json.loads(request.form["ssh_tunnel_passwords"])
        #     if "ssh_tunnel_passwords" in request.form
        #     else None
        # )
        # ssh_tunnel_private_keys = (
        #     json.loads(request.form["ssh_tunnel_private_keys"])
        #     if "ssh_tunnel_private_keys" in request.form
        #     else None
        # )
        # ssh_tunnel_priv_key_passwords = (
        #     json.loads(request.form["ssh_tunnel_private_key_passwords"])
        #     if "ssh_tunnel_private_key_passwords" in request.form
        #     else None
        # )

        # command = ImportPdfTemplatesCommand(
        #     contents,
        #     passwords=passwords,
        #     overwrite=overwrite,
        #     ssh_tunnel_passwords=ssh_tunnel_passwords,
        #     ssh_tunnel_private_keys=ssh_tunnel_private_keys,
        #     ssh_tunnel_priv_key_passwords=ssh_tunnel_priv_key_passwords,
        # )
        # command.run()
        return self.response(200, message="OK")
