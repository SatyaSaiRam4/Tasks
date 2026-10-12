"""Google sign-in: verifies an ID token from the app, on our own server.

The token is a JWT signed by Google. It is checked locally with PyJWT
against Google's published signing keys (fetched from GOOGLE_CERTS_URL and
cached), and only accepted when:
  - the RS256 signature is valid for one of Google's current keys,
  - it hasn't expired (and was issued in the past),
  - the issuer is Google,
  - the audience is one of our OAuth client IDs (GOOGLE_CLIENT_IDS),
  - it names a Google account (sub) and an email Google has verified.

Tokens are never logged.
"""

import logging

import jwt
from jwt import PyJWKClient

from app.core import config

logger = logging.getLogger("auth.google")

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"]
# Allowed clock difference between Google and this server.
LEEWAY_SECONDS = 30


class GoogleTokenInvalid(Exception):
    """The token is not a valid Google ID token for this app."""


class GoogleUnavailable(Exception):
    """Google's signing keys couldn't be fetched (network or Google outage)."""


# Keys are cached in memory and re-fetched when Google rotates them.
_jwks = PyJWKClient(GOOGLE_CERTS_URL, cache_keys=True, lifespan=3600, timeout=10)


def _signing_key(token: str):
    """The Google public key the token says it was signed with."""
    try:
        return _jwks.get_signing_key_from_jwt(token).key
    except jwt.PyJWKClientConnectionError as exc:
        raise GoogleUnavailable(str(exc)) from exc
    except (jwt.PyJWKClientError, jwt.DecodeError) as exc:
        raise GoogleTokenInvalid("Unknown or malformed token.") from exc


def verify_id_token(id_token: str) -> dict:
    """Returns {"sub", "email", "name"} for a valid token.

    Raises GoogleTokenInvalid for anything that isn't a genuine, current
    Google ID token issued to one of our client IDs, and GoogleUnavailable
    if Google's keys can't be reached.
    """
    audiences = config.GOOGLE_CLIENT_IDS
    if not audiences:
        raise GoogleTokenInvalid("Google sign-in is not configured on the server.")
    key = _signing_key(id_token)
    try:
        claims = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=audiences,
            issuer=GOOGLE_ISSUERS,
            leeway=LEEWAY_SECONDS,
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise GoogleTokenInvalid("The Google sign-in has expired. Please try again.") from exc
    except jwt.InvalidAudienceError as exc:
        raise GoogleTokenInvalid("The token was made for a different app.") from exc
    except jwt.InvalidIssuerError as exc:
        raise GoogleTokenInvalid("The token didn't come from Google.") from exc
    except jwt.InvalidTokenError as exc:
        raise GoogleTokenInvalid("The token couldn't be verified.") from exc

    email = (claims.get("email") or "").strip().lower()
    # email_verified is a JSON boolean in ID tokens; accept the string form too.
    if not email or str(claims.get("email_verified")).lower() != "true":
        raise GoogleTokenInvalid("Your Google account's email isn't verified.")
    name = (claims.get("name") or email.split("@")[0]).strip()
    return {"sub": str(claims["sub"]), "email": email, "name": name}
