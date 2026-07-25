ARG BASE_IMAGE
FROM ${BASE_IMAGE}

ARG CUSTOM_APPS_DIR

COPY --chown=frappe:frappe ${CUSTOM_APPS_DIR}/greenleaf /home/frappe/frappe-bench/apps/greenleaf
COPY --chown=frappe:frappe ${CUSTOM_APPS_DIR}/hrms /home/frappe/frappe-bench/apps/hrms
COPY --chown=frappe:frappe ${CUSTOM_APPS_DIR}/knowledge_base /home/frappe/frappe-bench/apps/knowledge_base
COPY --chown=frappe:frappe ${CUSTOM_APPS_DIR}/posawesome /home/frappe/frappe-bench/apps/posawesome
COPY --chown=frappe:frappe ${CUSTOM_APPS_DIR}/woocommerceconnector /home/frappe/frappe-bench/apps/woocommerceconnector
COPY --chown=frappe:frappe ${CUSTOM_APPS_DIR}/greenleaf_website /home/frappe/frappe-bench/apps/greenleaf_website

RUN set -eu; \
    if ! grep -q '^__version__' /home/frappe/frappe-bench/apps/knowledge_base/knowledge_base/__init__.py; then \
      printf '\n__version__ = "0.0.1"\n' \
        >> /home/frappe/frappe-bench/apps/knowledge_base/knowledge_base/__init__.py; \
    fi; \
    uv pip install --quiet \
      --python /home/frappe/frappe-bench/env/bin/python \
      'WooCommerce==3.0.0'; \
    site_packages="$(/home/frappe/frappe-bench/env/bin/python -c 'import site; print(site.getsitepackages()[0])')"; \
    for app in greenleaf hrms knowledge_base posawesome woocommerceconnector greenleaf_website; do \
      printf '%s\n' "/home/frappe/frappe-bench/apps/${app}" \
        >> "${site_packages}/greenleaf-production-rehearsal.pth"; \
    done; \
    /home/frappe/frappe-bench/env/bin/python -c \
      'import greenleaf, hrms, knowledge_base, posawesome, woocommerce, woocommerceconnector, greenleaf_website'
