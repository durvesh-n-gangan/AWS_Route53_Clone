"""One error format for the whole API: {"error": {"code", "message", "details"}}.

Services raise `AppError` with a Route53-style code (for example `NoSuchHostedZone`);
the handlers below turn it, and every framework error, into that shape.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

_STATUS_CODES: dict[int, str] = {
    400: "BadRequest",
    401: "Unauthenticated",
    403: "AccessDenied",
    404: "NotFound",
    405: "MethodNotAllowed",
    409: "Conflict",
    422: "InvalidInput",
}


class AppError(Exception):
    """A failure the client can act on, carrying its HTTP status and error code."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def error_body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def _json_error(
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=error_body(code, message, details),
        headers=headers,
    )


async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
    return _json_error(exc.status_code, exc.code, exc.message, exc.details)


async def _handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    fields = []
    for err in exc.errors():
        location = [str(part) for part in err.get("loc", ())]
        # Drop the leading "body"/"query"/"path" marker so clients get the field path.
        field_path = location[1:] if len(location) > 1 else location
        fields.append({"field": ".".join(field_path), "message": err.get("msg", "Invalid value")})
    return _json_error(
        422, "InvalidInput", "The request contains invalid values.", {"fields": fields}
    )


async def _handle_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = _STATUS_CODES.get(exc.status_code, "Error")
    message = exc.detail if isinstance(exc.detail, str) else "Request failed."
    return _json_error(exc.status_code, code, message, headers=getattr(exc, "headers", None))


async def _handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return _json_error(500, "InternalError", "An unexpected error occurred. Try again later.")


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _handle_app_error)
    app.add_exception_handler(RequestValidationError, _handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, _handle_http_error)
    app.add_exception_handler(Exception, _handle_unexpected_error)
