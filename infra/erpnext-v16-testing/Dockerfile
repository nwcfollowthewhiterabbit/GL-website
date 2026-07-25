FROM frappe/erpnext:v16.14.0

COPY --chown=frappe:frappe greenleaf_website /home/frappe/frappe-bench/apps/greenleaf_website

RUN uv pip install --quiet --no-deps \
    --python /home/frappe/frappe-bench/env/bin/python \
    -e /home/frappe/frappe-bench/apps/greenleaf_website
