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
from functools import partial
from typing import Optional

from flask_babel import lazy_gettext as _

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.pdf_template.exceptions import (
    PdfTemplateDeleteFailedError,
    PdfTemplateDeleteFailedReportsExistError,
    PdfTemplateForbiddenError,
    PdfTemplateNotFoundError,
)
from superset.daos.pdf_template import PdfTemplateDAO
from superset.daos.report import ReportScheduleDAO
from superset.exceptions import SupersetSecurityException
from superset.models.pdf_template import PdfTemplate
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DeletePdfTemplateCommand(BaseCommand):
    def __init__(self, model_ids: list[int]):
        self._model_ids = model_ids
        self._models: Optional[list[PdfTemplate]] = None

    @transaction(on_error=partial(on_error, reraise=PdfTemplateDeleteFailedError))
    def run(self) -> None:
        self.validate()
        assert self._models
        PdfTemplateDAO.delete(self._models)

    def validate(self) -> None:
        # Validate/populate model exists
        self._models = PdfTemplateDAO.find_by_ids(self._model_ids)
        if not self._models or len(self._models) != len(self._model_ids):
            raise PdfTemplateNotFoundError()
        
        # Check ownership
        for model in self._models:
            try:
                security_manager.raise_for_ownership(model)
            except SupersetSecurityException as ex:
                raise PdfTemplateForbiddenError() from ex
