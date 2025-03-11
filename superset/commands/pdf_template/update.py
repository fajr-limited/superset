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
import logging
from datetime import datetime
from functools import partial
from typing import Any, Optional

from flask import g
from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.base import BaseCommand, UpdateMixin
from superset.commands.pdf_template.exceptions import (
    PdfTemplateForbiddenError,
    PdfTemplateInvalidError,
    PdfTemplateNotFoundError,
    PdfTemplateUpdateFailedError,
)
from superset.commands.utils import update_tags, validate_tags
from superset.daos.pdf_template import PdfTemplateDAO
from superset.models.pdf_template import PdfTemplate
from superset.tags.models import ObjectType
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


def is_query_context_update(properties: dict[str, Any]) -> bool:
    return set(properties) == {"query_context", "query_context_generation"} and bool(
        properties.get("query_context_generation")
    )


class UpdatePdfTemplateCommand(UpdateMixin, BaseCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[PdfTemplate] = None

    @transaction(on_error=partial(on_error, reraise=PdfTemplateUpdateFailedError))
    def run(self) -> Model:
        self.validate()
        assert self._model

        # Update tags
        if (tags := self._properties.pop("tags", None)) is not None:
            update_tags(ObjectType.chart, self._model.id, self._model.tags, tags)


        return PdfTemplateDAO.update(self._model, self._properties)

    def validate(self) -> None:  # noqa: C901
        exceptions: list[ValidationError] = []
        tag_ids: Optional[list[int]] = self._properties.get("tags")

        # Validate/populate model exists
        self._model = PdfTemplateDAO.find_by_id(self._model_id)
        if not self._model:
            raise PdfTemplateNotFoundError()

        # validate tags
        try:
            validate_tags(ObjectType.chart, self._model.tags, tag_ids)
        except ValidationError as ex:
            exceptions.append(ex)

        if exceptions:
            raise PdfTemplateInvalidError(exceptions=exceptions)
