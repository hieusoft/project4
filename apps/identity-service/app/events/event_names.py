"""Event routing keys — mirror of libs/events/src/event-names.ts.

Keep in sync with the shared TypeScript contract; these strings are the
RabbitMQ topic routing keys published to the `charity.events` exchange.
"""
from __future__ import annotations

# Identity-owned events (published by this service)
USER_REGISTERED = "user.registered"
USER_VERIFIED = "user.verified"
EMAIL_VERIFICATION_REQUESTED = "email.verification_requested"
EMAIL_VERIFIED = "email.verified"
PASSWORD_RESET_REQUESTED = "password.reset_requested"
PASSWORD_RESET_COMPLETED = "password.reset_completed"

# Events consumed by this service
REPORT_RESOLVED = "report.resolved"
