# Build with the exact current ERP image ID; never rebuild unrelated ERP apps.
ARG ERP_BASE_IMAGE
FROM ${ERP_BASE_IMAGE}

COPY --chown=frappe:frappe erpnext/app/greenleaf_website /home/frappe/frappe-bench/apps/greenleaf_website

RUN uv pip install --quiet --no-deps \
    --python /home/frappe/frappe-bench/env/bin/python \
    -e /home/frappe/frappe-bench/apps/greenleaf_website

# This app has only native DocTypes/Page source, no public asset bundles.
# Inherit the base image's built Frappe/ERP assets without rebuilding them.
