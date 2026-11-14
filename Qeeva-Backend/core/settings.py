"""
Django settings for the Qeeva backend (Django 5.2 LTS).

Every environment-specific value comes from environment variables (or a local ``.env``
file that Git ignores), so no secret is ever committed. See ``.env.example``.

https://docs.djangoproject.com/en/5.2/topics/settings/
"""

from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from core.env import (
    env_bool,
    env_int,
    env_list,
    env_required,
    load_env_file,
    parse_database_url,
)

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Local development convenience. Real environment variables always take priority.
load_env_file(BASE_DIR / ".env")


# --- Core security settings -------------------------------------------------------------

SECRET_KEY = env_required("DJANGO_SECRET_KEY")

# Off unless explicitly enabled; must stay off in production.
DEBUG = env_bool("DJANGO_DEBUG", default=False)

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS")

# Cookies are only used by the Django admin (the API itself uses bearer tokens), but they are
# still sent over HTTPS only whenever DEBUG is off.
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
# HSTS and the HTTPS redirect depend on where the server is hosted; they are set at deployment.


# --- Application definition -------------------------------------------------------------

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"


# --- Database (Supabase PostgreSQL) -----------------------------------------------------
# Use Supabase's direct connection or its SESSION pooler (port 5432).
# Only if you use the TRANSACTION pooler (port 6543) set DB_DISABLE_SERVER_SIDE_CURSORS=true;
# Django's documentation requires this for transaction-pooling mode.

DATABASES = {
    "default": {
        **parse_database_url(env_required("DATABASE_URL")),
        "CONN_MAX_AGE": env_int("DB_CONN_MAX_AGE", default=0),
        "DISABLE_SERVER_SIDE_CURSORS": env_bool("DB_DISABLE_SERVER_SIDE_CURSORS", default=False),
    }
}


# --- Supabase Auth ----------------------------------------------------------------------
# Django never creates or stores users. It only verifies the access token that Supabase Auth
# issued, using the project's public signing keys (JWKS).

SUPABASE_URL = env_required("SUPABASE_URL").rstrip("/")
if not SUPABASE_URL.startswith("https://") and not DEBUG:
    raise ImproperlyConfigured("SUPABASE_URL must start with https:// when DEBUG is off.")

SUPABASE_JWT_ISSUER = f"{SUPABASE_URL}/auth/v1"
SUPABASE_JWKS_URL = f"{SUPABASE_JWT_ISSUER}/.well-known/jwks.json"
SUPABASE_JWT_AUDIENCE = "authenticated"


# --- Django REST framework --------------------------------------------------------------
# Secure by default: every endpoint requires a valid Supabase token unless it opts out.

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["common.auth.SupabaseJWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "UNAUTHENTICATED_USER": None,
}


# --- Password validation (used by the Django admin only) --------------------------------

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# --- Internationalization ---------------------------------------------------------------

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


# --- Static files and defaults ----------------------------------------------------------

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
