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
from flask_babel import _
from marshmallow.validate import ValidationError

from superset.commands.exceptions import (
    CommandException,
    CommandInvalidError,
    CreateFailedError,
    DeleteFailedError,
    ForbiddenError,
    ImportFailedError,
    UpdateFailedError,
)


class TimeRangeAmbiguousError(ValidationError):
    """
    Time range is ambiguous error.
    """

    def __init__(self, human_readable: str) -> None:
        super().__init__(
            _(
                "Time string is ambiguous."
                " Please specify [%(human_readable)s ago]"
                " or [%(human_readable)s later].",
                human_readable=human_readable,
            ),
            field_name="time_range",
        )


class TimeRangeParseFailError(ValidationError):
    def __init__(self, human_readable: str) -> None:
        super().__init__(
            _(
                "Cannot parse time string [%(human_readable)s]",
                human_readable=human_readable,
            ),
            field_name="time_range",
        )


class TimeDeltaAmbiguousError(ValidationError):
    """
    Time delta is ambiguous error.
    """

    def __init__(self, human_readable: str) -> None:
        super().__init__(
            _(
                "Time delta is ambiguous."
                " Please specify [%(human_readable)s ago]"
                " or [%(human_readable)s later].",
                human_readable=human_readable,
            ),
            field_name="time_range",
        )


class DatabaseNotFoundValidationError(ValidationError):
    """
    Marshmallow validation error for database does not exist
    """

    def __init__(self) -> None:
        super().__init__(_("Database does not exist"), field_name="database")


class PdfTemplateNotFoundError(CommandException):
    message = "PdfTemplate not found."


class PdfTemplateInvalidError(CommandInvalidError):
    message = _("PdfTemplate parameters are invalid.")


class PdfTemplateCreateFailedError(CreateFailedError):
    message = _("PdfTemplate could not be created.")


class PdfTemplateUpdateFailedError(UpdateFailedError):
    message = _("PdfTemplate could not be updated.")


class PdfTemplateDeleteFailedError(DeleteFailedError):
    message = _("PdfTemplates could not be deleted.")


class PdfTemplateDeleteFailedReportsExistError(PdfTemplateDeleteFailedError):
    message = _("There are associated alerts or reports")


class PdfTemplateAccessDeniedError(ForbiddenError):
    message = _("You don't have access to this chart.")


class PdfTemplateForbiddenError(ForbiddenError):
    message = _("Changing this chart is forbidden")


class PdfTemplateImportError(ImportFailedError):
    message = _("Import chart failed for an unknown reason")


class WarmUpCachePdfTemplateNotFoundError(CommandException):
    status = 404
    message = _("PdfTemplate not found")


class PdfTemplateFaveError(CommandException):
    message = _("Error faving chart")


class PdfTemplateUnfaveError(CommandException):
    message = _("Error unfaving chart")
