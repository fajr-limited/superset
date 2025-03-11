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
from typing import Any

from flask_babel import lazy_gettext as _
from sqlalchemy import and_, or_
from sqlalchemy.orm import aliased
from sqlalchemy.orm.query import Query

from superset import db, security_manager
from superset.connectors.sqla import models
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import FavStar
from superset.models.pdf_template import PdfTemplate
from superset.tags.filters import BaseTagIdFilter, BaseTagNameFilter
from superset.utils.core import get_user_id
from superset.utils.filters import get_dataset_access_filters
from superset.views.base import BaseFilter
from superset.views.base_api import BaseFavoriteFilter


class PdfTemplateAllTextFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("All Text")
    arg_name = "pdf_template_all_text"

    def apply(self, query: Query, value: Any) -> Query:
        if not value:
            return query
        ilike_value = f"%{value}%"
        return query.filter(
            or_(
                PdfTemplate.name.ilike(ilike_value),
                PdfTemplate.description.ilike(ilike_value),
                SqlaTable.table_name.ilike(ilike_value),
            )
        )


class PdfTemplateFavoriteFilter(BaseFavoriteFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all pdf_templates that a user has favored
    """

    arg_name = "pdf_template_is_favorite"
    class_name = "pdf_template"
    model = PdfTemplate


class PdfTemplateTagNameFilter(BaseTagNameFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all pdf_templates associated with
    a certain tag (by its name).
    """

    arg_name = "pdf_template_tags"
    class_name = "pdf_template"
    model = PdfTemplate


class PdfTemplateTagIdFilter(BaseTagIdFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all pdf_templates associated with
    a certain tag (by its ID).
    """

    arg_name = "pdf_template_tag_id"
    class_name = "pdf_template"
    model = PdfTemplate


# class PdfTemplateCertifiedFilter(BaseFilter):  # pylint: disable=too-few-public-methods
#     """
#     Custom filter for the GET list that filters all certified pdf_templates
#     """

#     name = _("Is certified")
#     arg_name = "pdf_template_is_certified"

#     def apply(self, query: Query, value: Any) -> Query:
#         if value is True:
#             return query.filter(and_(PdfTemplate.certified_by.isnot(None)))
#         if value is False:
#             return query.filter(and_(PdfTemplate.certified_by.is_(None)))
#         return query


class PdfTemplateFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    def apply(self, query: Query, value: Any) -> Query:
        if security_manager.can_access_all_datasources():
            return query

        table_alias = aliased(SqlaTable)
        query = query.join(table_alias, self.model.datasource_id == table_alias.id)
        query = query.join(
            models.Database, table_alias.database_id == models.Database.id
        )
        return query.filter(get_dataset_access_filters(self.model))


class PdfTemplateHasCreatedByFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET list that filters all pdf_templates created by user
    """

    name = _("Has created by")
    arg_name = "pdf_template_has_created_by"

    def apply(self, query: Query, value: Any) -> Query:
        if value is True:
            return query.filter(and_(PdfTemplate.created_by_fk.isnot(None)))
        if value is False:
            return query.filter(and_(PdfTemplate.created_by_fk.is_(None)))
        return query


class PdfTemplateCreatedByMeFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    name = _("Created by me")
    arg_name = "pdf_template_created_by_me"

    def apply(self, query: Query, value: Any) -> Query:
        return query.filter(
            or_(
                PdfTemplate.created_by_fk  # pylint: disable=comparison-with-callable
                == get_user_id(),
                PdfTemplate.changed_by_fk  # pylint: disable=comparison-with-callable
                == get_user_id(),
            )
        )


class PdfTemplateOwnedCreatedFavoredByMeFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """
    Custom filter for the GET pdf_template that filters all pdf_templates the user
    owns, created, changed or favored.
    """

    name = _("Owned Created or Favored")
    arg_name = "pdf_template_owned_created_favored_by_me"

    def apply(self, query: Query, value: Any) -> Query:
        # If anonymous user filter nothing
        if security_manager.current_user is None:
            return query

        owner_ids_query = (
            db.session.query(PdfTemplate.id)
            .join(PdfTemplate.owners)
            .filter(security_manager.user_model.id == get_user_id())
        )

        return query.join(
            FavStar,
            and_(
                FavStar.user_id == get_user_id(),
                FavStar.class_name == "pdf_template",
                PdfTemplate.id == FavStar.obj_id,
            ),
            isouter=True,
        ).filter(
            # pylint: disable=comparison-with-callable
            or_(
                PdfTemplate.id.in_(owner_ids_query),
                PdfTemplate.created_by_fk == get_user_id(),
                PdfTemplate.changed_by_fk == get_user_id(),
                FavStar.user_id == get_user_id(),
            )
        )
