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
from flask_babel import lazy_gettext as _
from markupsafe import Markup

from superset.views.pdf_template.filters import PdfTemplateFilter


class PdfTemplateMixin:  # pylint: disable=too-few-public-methods
    list_title = _("Pdf Templates")
    show_title = _("Show Template")
    add_title = _("Add Template")
    edit_title = _("Edit Template")

    can_add = False
    search_columns = (
        "name",
        "description",
    )
    list_columns = ["id", "name", "data", "description"]
    show_columns = ["id", "name", "data", "description"]
    add_columns = ["name","data", "description"]
    edit_columns = ["name","data", "description"]
    order_columns = ["name","data", "description"]
    base_order = ("changed_on", "desc")
    description_columns = {
        "description": Markup(
            "The content here can be displayed as widget headers in the "
            "dashboard view. Supports "
            '<a href="https://daringfireball.net/projects/markdown/"">'
            "markdown</a>"
        ),
        "params": _(
            "These parameters are generated dynamically when clicking "
            "the save or overwrite button in the explore view. This JSON "
            "object is exposed here for reference and for power users who may "
            "want to alter specific parameters."
        ),
        "cache_timeout": _(
            "Duration (in seconds) of the caching timeout for this chart. "
            "Note this defaults to the datasource/table timeout if undefined."
        ),
    }
    base_filters = [["id", PdfTemplateFilter, lambda: []]]
    label_columns = {
        "cache_timeout": _("Cache Timeout"),
        "creator": _("Creator"),
        "description": _("Description"),
        "modified": _("Last Modified"),
        "name": _("Name"),
        "data": _("Data"),
    }
