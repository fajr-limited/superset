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


from typing import Any, Optional, Union

from flask import g

from superset.commands.base import BaseCommand
from superset.commands.pdf_template.exceptions import (
    PdfTemplateInvalidError,
    WarmUpCachePdfTemplateNotFoundError,
)
from superset.extensions import db
from superset.models.pdf_template import PdfTemplate
from superset.utils import json
from superset.utils.core import error_msg_from_exception
from superset.views.utils import get_dashboard_extra_filters, get_form_data, get_viz
from superset.viz import viz_types


class PdfTemplateWarmUpCacheCommand(BaseCommand):
    def __init__(
        self,
        chart_or_id: Union[int, PdfTemplate],
        extra_filters: Optional[str],
    ):
        self._chart_or_id = chart_or_id
        self._extra_filters = extra_filters

    def run(self) -> dict[str, Any]:
        self.validate()
        chart: PdfTemplate = self._chart_or_id  # type: ignore

        return {"chart_id": chart.id}
    
    def validate(self) -> None:
        if isinstance(self._chart_or_id, PdfTemplate):
            return
        chart = db.session.query(PdfTemplate).filter_by(id=self._chart_or_id).scalar()
        if not chart:
            raise WarmUpCachePdfTemplateNotFoundError()
        self._chart_or_id = chart
